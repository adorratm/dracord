'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Material, Mesh, PerspectiveCamera, Texture } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import { disposeObject, pointerNdc, type GameProps } from '../three/sceneUtils';
import {
  resolveWatchMedia,
  watchMediaHint,
  type WatchMediaRef,
} from '@/lib/watch-party-media';
import {
  WatchEmbedPlayer,
  type EmbedPlayerHandle,
} from '@/components/activities/games/WatchEmbedPlayer';

type Props = Omit<GameProps, 'canPlay'> & {
  canPlay?: boolean;
  /** Verilmezse session.hostUserId === userId kullanılır */
  isHost?: boolean;
};

const AVATAR_COLORS = [0xbd93f9, 0xff79c6, 0x8be9fd, 0x50fa7b, 0xffb86c, 0xf1fa8c, 0xff5555];

function hashColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WatchPartyRoom(props: Props) {
  const { session, userId, onPatch } = props;
  const isHost = props.isHost ?? (!!userId && session.hostUserId === userId);
  const propsRef = useRef({ ...props, isHost });
  propsRef.current = { ...props, isHost };
  const syncRef = useRef<(() => void) | null>(null);

  const state = session.state;
  const mediaUrl = typeof state.mediaUrl === 'string' ? state.mediaUrl : '';
  const playing = Boolean(state.playing);
  const at = Number(state.at) || 0;

  const media = useMemo(() => (mediaUrl ? resolveWatchMedia(mediaUrl) : null), [mediaUrl]);
  const isEmbed = Boolean(media && !media.isDirectFile);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const embedPlayerRef = useRef<EmbedPlayerHandle | null>(null);
  const loadedUrlRef = useRef<string | null>(null);
  const needApplyRef = useRef(true);
  const pendingSeekRef = useRef<number | null>(null);
  const fallbackRef = useRef(false);
  const overlayHostRef = useRef<HTMLDivElement | null>(null);
  const uiRef = useRef({ overlay: false, ready: false, hasMedia: false, isEmbed: false });

  const [urlInput, setUrlInput] = useState(mediaUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [needGesture, setNeedGesture] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [overlay, setOverlay] = useState(false);
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  /** panel = yüzen pencere, wall = 3D duvar, fullscreen = tarayıcı tam ekran */
  const [cinemaMode, setCinemaMode] = useState<'panel' | 'wall' | 'fullscreen'>('panel');
  const [panelSize, setPanelSize] = useState({ w: 720, h: 405 });
  const cinemaShellRef = useRef<HTMLDivElement | null>(null);
  const resizingRef = useRef<{
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // Duvar modunda dosya videosu VideoTexture'a gider; embed duvar overlay'inde kalır
  const wallFileMode = cinemaMode === 'wall' && !isEmbed && Boolean(mediaUrl);
  const showCinemaChrome = Boolean(mediaUrl) && cinemaMode !== 'wall';
  const showWallEmbed = Boolean(mediaUrl) && cinemaMode === 'wall' && isEmbed;

  // Duvar + dosya: VideoTexture; diğer durumlarda 3D ekranda yer tutucu
  uiRef.current.overlay = Boolean(mediaUrl) && !wallFileMode;
  uiRef.current.hasMedia = mediaUrl !== '';
  uiRef.current.isEmbed = false;

  useEffect(() => {
    setUrlInput(mediaUrl);
  }, [mediaUrl]);

  const getVideo = useCallback(() => {
    if (!videoRef.current) {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.playsInline = true;
      v.muted = true;
      v.preload = 'auto';
      v.className = 'h-full w-full rounded-lg bg-black object-contain';
      v.controls = false;
      videoRef.current = v;
    }
    return videoRef.current;
  }, []);

  // Doğrudan dosya — video olayları
  useEffect(() => {
    if (isEmbed) return;
    const v = getVideo();
    const onMeta = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0);
      if (pendingSeekRef.current !== null) {
        v.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
    };
    const onTime = () => setCurrent(v.currentTime);
    const onCanPlay = () => {
      uiRef.current.ready = true;
    };
    const onError = () => {
      const url = loadedUrlRef.current;
      if (url && !fallbackRef.current) {
        fallbackRef.current = true;
        v.removeAttribute('crossorigin');
        v.crossOrigin = null;
        v.src = url;
        v.load();
        setOverlay(true);
        return;
      }
      setMediaError('Medya oynatılamadı — bağlantıyı veya platformu kontrol et');
    };
    const onEnded = () => {
      const p = propsRef.current;
      if (p.isHost) void p.onPatch({ playing: false, at: v.duration || 0 }).catch(() => undefined);
    };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('error', onError);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('error', onError);
      v.removeEventListener('ended', onEnded);
    };
  }, [getVideo, isEmbed]);

  // Dosya medya senkronu
  useEffect(() => {
    if (isEmbed) {
      loadedUrlRef.current = null;
      return;
    }
    const v = getVideo();
    if (loadedUrlRef.current !== mediaUrl) {
      loadedUrlRef.current = mediaUrl;
      fallbackRef.current = false;
      uiRef.current.ready = false;
      needApplyRef.current = true;
      pendingSeekRef.current = null;
      setOverlay(false);
      setMediaError(null);
      setDuration(0);
      setCurrent(0);
      v.crossOrigin = 'anonymous';
      if (mediaUrl) {
        v.src = mediaUrl;
        v.load();
      } else {
        v.pause();
        v.removeAttribute('src');
        v.load();
      }
    }
    if (!mediaUrl) return;
    if (isHost && !needApplyRef.current) return;
    needApplyRef.current = false;

    const skew = Date.now() - new Date(session.updatedAt).getTime();
    const comp = playing && skew > 0 && skew < 10_000 ? skew / 1000 : 0;
    const expected = at + comp;
    const threshold = isHost ? 0.5 : 2;
    if (v.readyState >= 1) {
      if (Math.abs(v.currentTime - expected) > threshold) v.currentTime = expected;
    } else if (expected > 0.5) {
      pendingSeekRef.current = expected;
    }
    if (playing) {
      v.play()
        .then(() => setNeedGesture(false))
        .catch(() => setNeedGesture(true));
    } else {
      v.pause();
    }
  }, [mediaUrl, playing, at, session.updatedAt, isHost, getVideo, isEmbed]);

  // Dosya videosunu panele veya (duvar modunda) texture için DOM'dan ayır
  useEffect(() => {
    if (isEmbed) return;
    const v = getVideo();
    const host = overlayHostRef.current;
    if (cinemaMode === 'wall') {
      // Duvar: VideoTexture — DOM'dan çıkar
      if (v.parentElement) v.remove();
      setOverlay(false);
      return;
    }
    if (host) {
      host.appendChild(v);
      setOverlay(true);
    }
  }, [getVideo, isEmbed, cinemaMode, mediaUrl]);

  useEffect(() => {
    if (isEmbed) return;
    const v = getVideo();
    v.muted = muted;
    v.volume = volume;
  }, [muted, volume, getVideo, isEmbed]);

  // Host kalp atışı
  useEffect(() => {
    if (!isHost || !playing || !mediaUrl) return;
    const id = setInterval(() => {
      if (isEmbed) {
        const t = embedPlayerRef.current?.getCurrentTime() ?? current;
        void propsRef.current
          .onPatch({ at: Math.round(t * 1000) / 1000, playing: true })
          .catch(() => undefined);
        return;
      }
      const v = videoRef.current;
      if (!v || v.paused) return;
      void propsRef.current
        .onPatch({ at: Math.round(v.currentTime * 1000) / 1000, playing: true })
        .catch(() => undefined);
    }, 12_000);
    return () => clearInterval(id);
  }, [isHost, playing, mediaUrl, isEmbed, current]);

  useEffect(() => {
    syncRef.current?.();
  }, [session.playerIds, session.spectatorIds, session.hostUserId, userId]);

  const send = useCallback(
    async (patch: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await onPatch(patch);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'İşlem başarısız');
      } finally {
        setBusy(false);
      }
    },
    [onPatch],
  );

  const loadUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    const resolved = resolveWatchMedia(url);
    if (!resolved) {
      setError('Geçersiz bağlantı (yalnızca http/https)');
      return;
    }
    needApplyRef.current = true;
    setCinemaMode('panel');
    void send({ mediaUrl: resolved.sourceUrl, playing: false, at: 0 });
  };

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
      setCinemaMode('panel');
      return;
    }
    // Shell mount olsun (duvar+dosya modundan da)
    setCinemaMode('fullscreen');
  }, []);

  useEffect(() => {
    if (cinemaMode !== 'fullscreen') return;
    const el = cinemaShellRef.current;
    if (el && !document.fullscreenElement) {
      void el.requestFullscreen().catch(() => undefined);
    }
  }, [cinemaMode, mediaUrl]);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) {
        setCinemaMode((m) => (m === 'fullscreen' ? 'panel' : m));
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Pencere / konteyner boyutu değişince panel oranını koru (max genişlik)
  useEffect(() => {
    const onResize = () => {
      setPanelSize((prev) => {
        const maxW = Math.min(window.innerWidth * 0.94, 1100);
        const w = Math.min(prev.w, maxW);
        const h = Math.round((w * 9) / 16);
        if (w === prev.w && h === prev.h) return prev;
        return { w, h };
      });
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onResizePointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: panelSize.w,
      startH: panelSize.h,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizePointerMove = (e: ReactPointerEvent) => {
    const r = resizingRef.current;
    if (!r) return;
    const dw = e.clientX - r.startX;
    const w = Math.min(1100, Math.max(320, r.startW + dw));
    const h = Math.round((w * 9) / 16);
    setPanelSize({ w, h });
  };
  const onResizePointerUp = (e: ReactPointerEvent) => {
    resizingRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const togglePlay = () => {
    if (!mediaUrl) return;
    if (isEmbed) {
      const t = embedPlayerRef.current?.getCurrentTime() ?? current;
      if (playing) {
        embedPlayerRef.current?.pause();
        void send({ playing: false, at: t });
      } else {
        embedPlayerRef.current?.play();
        setNeedGesture(false);
        void send({ playing: true, at: t });
      }
      return;
    }
    const v = getVideo();
    if (playing) {
      v.pause();
      void send({ playing: false, at: v.currentTime });
    } else {
      void v
        .play()
        .then(() => setNeedGesture(false))
        .catch(() => setNeedGesture(true));
      void send({ playing: true, at: v.currentTime });
    }
  };
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  const commitSeek = (t: number) => {
    if (isEmbed) {
      embedPlayerRef.current?.seek(t);
      setSeekDraft(null);
      void send({ at: t, playing });
      return;
    }
    const v = getVideo();
    v.currentTime = t;
    setSeekDraft(null);
    void send({ at: t, playing });
  };

  const resync = () => {
    if (isEmbed) {
      const t = embedPlayerRef.current?.getCurrentTime() ?? current;
      void send({ at: t, playing });
      return;
    }
    const v = getVideo();
    void send({ at: v.currentTime, playing: !v.paused });
  };

  const forceGesturePlay = () => {
    if (isEmbed) {
      embedPlayerRef.current?.play();
      setNeedGesture(false);
      return;
    }
    const v = getVideo();
    void v
      .play()
      .then(() => setNeedGesture(false))
      .catch(() => undefined);
  };

  const onReady = useCallback(
    (api: ThreeSceneApi) => {
      const { THREE, scene, renderer } = api;
      const camera = api.camera as PerspectiveCamera;
      const dom = renderer.domElement;
      const root = new THREE.Group();
      scene.add(root);
      const textures: Texture[] = [];
      const mats: Material[] = [];

      const std = (color: number, roughness = 0.7, extra: Record<string, unknown> = {}) => {
        const m = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
        mats.push(m);
        return m;
      };
      const box = (
        w: number,
        h: number,
        d: number,
        x: number,
        y: number,
        z: number,
        mat: Material,
      ) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        root.add(m);
        return m;
      };

      box(26, 0.3, 26, 0, -0.15, 0, std(0x1c1f33, 0.85));
      box(26, 10, 0.3, 0, 5, -9, std(0x151826, 0.9));
      box(0.3, 10, 26, -13, 5, 0, std(0x151826, 0.9));
      box(0.3, 10, 26, 13, 5, 0, std(0x151826, 0.9));
      const neonMat = new THREE.MeshBasicMaterial({ color: 0xbd93f9 });
      mats.push(neonMat);
      const neonLine = (w: number, h: number, x: number, y: number, z: number) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), neonMat);
        m.position.set(x, y, z);
        root.add(m);
      };
      neonLine(18, 0.08, 0, 0.6, -8.8);
      neonLine(18, 0.08, 0, 6.4, -8.8);
      const rug = new THREE.Mesh(new THREE.CircleGeometry(6, 40), std(0x44307a, 0.95));
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0, 0.01, 1.5);
      root.add(rug);

      const mkPlaceholder = (text: string, sub: string) => {
        const cv = document.createElement('canvas');
        cv.width = 640;
        cv.height = 360;
        const ctx = cv.getContext('2d')!;
        const g = ctx.createLinearGradient(0, 0, 640, 360);
        g.addColorStop(0, '#1b1633');
        g.addColorStop(1, '#2d1f55');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 640, 360);
        ctx.strokeStyle = '#bd93f9';
        ctx.lineWidth = 6;
        ctx.strokeRect(12, 12, 616, 336);
        ctx.fillStyle = '#f8f8f2';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(text, 320, 170);
        ctx.fillStyle = '#bd93f9';
        ctx.font = '22px sans-serif';
        ctx.fillText(sub, 320, 215);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.push(tex);
        const m = new THREE.MeshBasicMaterial({ map: tex });
        mats.push(m);
        return m;
      };
      const matNone = mkPlaceholder('Watch Party', 'YouTube · Vimeo · TikTok · …');
      const matLoading = mkPlaceholder('Yükleniyor…', 'Medya hazırlanıyor');
      const matOverlay = mkPlaceholder('Sinema paneli açık', 'Platform videosu üstte oynuyor');
      const videoTex = new THREE.VideoTexture(getVideo());
      videoTex.colorSpace = THREE.SRGBColorSpace;
      textures.push(videoTex);
      const matVideo = new THREE.MeshBasicMaterial({ map: videoTex });
      mats.push(matVideo);

      const screen: Mesh = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 5.85), matNone);
      screen.position.set(0, 3.9, -8.7);
      root.add(screen);
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(10.9, 6.35, 0.2),
        std(0x0b0c14, 0.4, { emissive: 0x24104a }),
      );
      frame.position.set(0, 3.9, -8.82);
      root.add(frame);
      const glow = new THREE.PointLight(0xbd93f9, 1.4, 22);
      glow.position.set(0, 4, -6);
      root.add(glow);

      const couchMat = std(0x6d3fc0, 0.8);
      const couchDark = std(0x44307a, 0.8);
      box(7.2, 0.7, 2, 0, 0.45, 3, couchMat);
      box(7.2, 1.6, 0.6, 0, 1.2, 3.9, couchDark);
      box(0.6, 1.1, 2, -3.9, 0.8, 3, couchDark);
      box(0.6, 1.1, 2, 3.9, 0.8, 3, couchDark);
      box(2.2, 0.5, 1.2, 0, 0.25, -0.2, std(0x2a2f4d, 0.6));

      const people = new THREE.Group();
      root.add(people);
      const headGeo = new THREE.SphereGeometry(0.32, 16, 12);
      const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.5, 4, 10);
      const crownGeo = new THREE.ConeGeometry(0.2, 0.28, 5);
      const crownMat = new THREE.MeshBasicMaterial({ color: 0xf1fa8c });
      mats.push(crownMat);
      const personMats = new Map<number, Material>();
      const personMat = (c: number, me: boolean) => {
        const key = c + (me ? 1 : 0) * 0x1000000;
        let m = personMats.get(key);
        if (!m) {
          m = new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.5,
            emissive: me ? c : 0x000000,
            emissiveIntensity: me ? 0.35 : 0,
          });
          personMats.set(key, m);
        }
        return m;
      };
      const sync = () => {
        for (let i = people.children.length - 1; i >= 0; i--) people.remove(people.children[i]!);
        const p = propsRef.current;
        const ids = [...p.session.playerIds, ...p.session.spectatorIds].slice(0, 14);
        ids.forEach((id, i) => {
          const row = i < 7 ? 0 : 1;
          const col = i % 7;
          const x = (col - 3) * 0.9;
          const z = row === 0 ? 3.1 : 5.4;
          const y = row === 0 ? 1.15 : 0.5;
          const mat = personMat(hashColor(id), id === p.userId);
          const g = new THREE.Group();
          const body = new THREE.Mesh(bodyGeo, mat);
          const head = new THREE.Mesh(headGeo, mat);
          head.position.y = 0.72;
          g.add(body, head);
          if (id === p.session.hostUserId) {
            const c = new THREE.Mesh(crownGeo, crownMat);
            c.position.y = 1.15;
            g.add(c);
          }
          g.position.set(x, y, z);
          g.rotation.y = Math.PI;
          g.userData.phase = i * 0.7;
          people.add(g);
        });
      };
      syncRef.current = sync;
      sync();

      const raycaster = new THREE.Raycaster();
      let px = 0;
      let py = 0;
      let tx = 0;
      let ty = 0;
      let downX = 0;
      let downY = 0;
      const onMove = (e: PointerEvent) => {
        const n = pointerNdc(e, dom);
        px = n.x;
        py = n.y;
      };
      const onDown = (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
      };
      const onUp = (e: PointerEvent) => {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
        if (!propsRef.current.isHost) return;
        const n = pointerNdc(e, dom);
        raycaster.setFromCamera(new THREE.Vector2(n.x, n.y), camera);
        if (raycaster.intersectObject(screen, false).length > 0) togglePlayRef.current();
      };
      dom.addEventListener('pointermove', onMove);
      dom.addEventListener('pointerdown', onDown);
      dom.addEventListener('pointerup', onUp);

      let raf = 0;
      let t0 = performance.now();
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const t = (now - t0) / 1000;
        tx += (px - tx) * 0.06;
        ty += (py - ty) * 0.06;
        const asp = camera.aspect || 1.7;
        const f = Math.max(1, 1.7 / asp);
        camera.position.set(tx * 1.6, 3.4 + ty * 0.5, (10.5 + 1) * f);
        camera.lookAt(0, 2.9, -6);
        const ui = uiRef.current;
        const v = videoRef.current;
        const ready = !!v && v.readyState >= 2;
        const next = !ui.hasMedia
          ? matNone
          : ui.overlay
            ? matOverlay
            : ready
              ? matVideo
              : matLoading;
        if (screen.material !== next) screen.material = next;
        if (!ui.overlay && ready && videoTex) videoTex.needsUpdate = true;
        people.children.forEach((c) => {
          c.position.y += Math.sin(t * 2 + (c.userData.phase as number)) * 0.0015;
        });
      };
      loop();
      t0 = performance.now();

      return () => {
        cancelAnimationFrame(raf);
        dom.removeEventListener('pointermove', onMove);
        dom.removeEventListener('pointerdown', onDown);
        dom.removeEventListener('pointerup', onUp);
        syncRef.current = null;
        scene.remove(root);
        disposeObject(root);
        mats.forEach((m) => m.dispose());
        personMats.forEach((m) => m.dispose());
        textures.forEach((tx2) => tx2.dispose());
        headGeo.dispose();
        bodyGeo.dispose();
        crownGeo.dispose();
        try {
          videoRef.current?.pause();
          videoRef.current?.removeAttribute('src');
          videoRef.current?.load();
          videoRef.current?.remove();
        } catch {
          /* ignore */
        }
        videoRef.current = null;
      };
    },
    [getVideo],
  );

  const total = duration || 0;
  const shown = seekDraft ?? current;
  const syncNote =
    media && !media.syncable
      ? `${media.label}: herkes aynı içeriği görür; oynatma senkronu sınırlı olabilir`
      : media
        ? `${media.label} · senkron oynatma`
        : null;

  return (
    <div className="absolute inset-0">
      <ThreeSceneHost className="absolute inset-0" onReady={onReady}>
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-1">
          <span className="inline-flex w-fit rounded-lg border border-[#bd93f9]/50 bg-[#11131e]/80 px-3 py-1 text-xs font-semibold text-[#f8f8f2]">
            Watch Party · {isHost ? 'Moderatörsün' : 'İzleyici — moderatör kontrol ediyor'}
          </span>
          <span className="inline-flex w-fit rounded-lg bg-[#11131e]/70 px-3 py-1 text-[11px] text-[#bd93f9]">
            {session.playerIds.length + session.spectatorIds.length} kişi odada
            {mediaUrl
              ? ` · ${playing ? 'Oynatılıyor' : 'Duraklatıldı'}${media ? ` · ${media.label}` : ''} · ${fmt(current)}`
              : ''}
          </span>
          {syncNote && (
            <span className="pointer-events-auto inline-flex w-fit max-w-sm rounded-lg bg-[#11131e]/80 px-3 py-1 text-[11px] text-[#ccc3d3]">
              {syncNote}
            </span>
          )}
          {mediaError && (
            <span className="inline-flex w-fit rounded-lg bg-[#ff5555]/20 px-3 py-1 text-[11px] text-[#ff5555]">
              {mediaError}
            </span>
          )}
        </div>

        {/* Sinema: panel / tam ekran / duvar (embed) */}
        {mediaUrl && (showCinemaChrome || showWallEmbed) && (
          <div
            ref={cinemaShellRef}
            className={
              cinemaMode === 'fullscreen'
                ? 'fixed inset-0 z-[80] flex flex-col bg-black'
                : showWallEmbed
                  ? 'absolute left-1/2 top-[18%] z-30 flex w-[min(56vw,640px)] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-[#bd93f9]/35 bg-black shadow-xl'
                  : 'absolute left-1/2 top-[10%] z-30 flex -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-[#bd93f9]/40 bg-black shadow-2xl'
            }
            style={
              cinemaMode === 'panel'
                ? { width: panelSize.w, maxWidth: '94vw' }
                : showWallEmbed
                  ? undefined
                  : undefined
            }
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#44307a] bg-[#11131e]/95 px-3 py-1.5">
              <span className="truncate text-xs text-[#f8f8f2]">
                {media?.label ?? 'Medya'}
                {cinemaMode === 'wall' ? ' · duvar' : ''}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {cinemaMode !== 'wall' && (
                  <button
                    type="button"
                    className="rounded-md px-2 py-0.5 text-xs text-[#bd93f9] hover:bg-[#44307a]/50"
                    onClick={() => {
                      if (document.fullscreenElement) void document.exitFullscreen();
                      setCinemaMode('wall');
                    }}
                    title="3D duvara küçült"
                  >
                    Duvara
                  </button>
                )}
                {cinemaMode === 'wall' && (
                  <button
                    type="button"
                    className="rounded-md px-2 py-0.5 text-xs text-[#bd93f9] hover:bg-[#44307a]/50"
                    onClick={() => setCinemaMode('panel')}
                  >
                    Pencere
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-md px-2 py-0.5 text-xs text-[#bd93f9] hover:bg-[#44307a]/50"
                  onClick={() => void toggleFullscreen()}
                >
                  {cinemaMode === 'fullscreen' ? 'Çık' : 'Tam ekran'}
                </button>
              </div>
            </div>
            <div
              className="relative w-full bg-black"
              style={
                cinemaMode === 'fullscreen'
                  ? { flex: 1, minHeight: 0 }
                  : cinemaMode === 'panel'
                    ? { height: panelSize.h, maxHeight: '70vh' }
                    : { aspectRatio: '16 / 9' }
              }
            >
              {isEmbed && media ? (
                <WatchEmbedPlayer
                  media={media as WatchMediaRef}
                  playing={playing}
                  at={at}
                  isHost={isHost}
                  muted={muted}
                  volume={volume}
                  className="absolute inset-0 h-full w-full overflow-hidden bg-black [&_iframe]:!absolute [&_iframe]:!inset-0 [&_iframe]:!h-full [&_iframe]:!w-full [&_iframe]:!max-h-none [&_iframe]:!max-w-none"
                  playerRef={embedPlayerRef}
                  onTime={(t, d) => {
                    setCurrent(t);
                    if (d > 0) setDuration(d);
                  }}
                  onEnded={() => {
                    if (isHost) {
                      void send({
                        playing: false,
                        at: embedPlayerRef.current?.getDuration() ?? current,
                      });
                    }
                  }}
                  onReady={() => {
                    uiRef.current.ready = true;
                    if (playing) setNeedGesture(false);
                  }}
                />
              ) : (
                <div
                  ref={overlayHostRef}
                  className="absolute inset-0 [&>video]:absolute [&>video]:inset-0 [&>video]:h-full [&>video]:w-full [&>video]:object-contain"
                />
              )}
              {cinemaMode === 'panel' && (
                <div
                  role="separator"
                  aria-label="Boyutu değiştir"
                  onPointerDown={onResizePointerDown}
                  onPointerMove={onResizePointerMove}
                  onPointerUp={onResizePointerUp}
                  className="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-se-resize touch-none"
                  style={{
                    background:
                      'linear-gradient(135deg, transparent 50%, #bd93f9 50%)',
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Duvar + dosya: video 3D ekranda; kontroller */}
        {mediaUrl && cinemaMode === 'wall' && !isEmbed && (
          <button
            type="button"
            onClick={() => setCinemaMode('panel')}
            className="absolute right-3 top-3 z-30 rounded-lg border border-[#bd93f9]/50 bg-[#11131e]/90 px-3 py-1.5 text-xs font-semibold text-[#bd93f9]"
          >
            Pencereyi aç
          </button>
        )}
        {mediaUrl && cinemaMode === 'wall' && !isEmbed && (
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="absolute right-3 top-14 z-30 rounded-lg border border-[#bd93f9]/50 bg-[#11131e]/90 px-3 py-1.5 text-xs font-semibold text-[#bd93f9]"
          >
            Tam ekran
          </button>
        )}

        {needGesture && mediaUrl && (
          <button
            type="button"
            onClick={forceGesturePlay}
            className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[#bd93f9] px-5 py-2 text-sm font-semibold text-[#11131e] shadow-lg"
          >
            ▶ Oynatmak için tıkla
          </button>
        )}

        <div className="absolute bottom-3 left-1/2 z-30 flex w-[min(720px,94%)] -translate-x-1/2 flex-col gap-2 rounded-xl border border-[#bd93f9]/30 bg-[#11131e]/90 p-2.5 text-[#f8f8f2]">
          {isHost && (
            <div className="flex gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadUrl();
                }}
                placeholder={watchMediaHint()}
                className="min-w-0 flex-1 rounded-lg border border-[#44307a] bg-[#1c1f33] px-3 py-1.5 text-xs outline-none focus:border-[#bd93f9]"
              />
              <button
                type="button"
                disabled={busy || !urlInput.trim()}
                onClick={loadUrl}
                className="rounded-lg bg-[#bd93f9] px-3 py-1.5 text-xs font-semibold text-[#11131e] disabled:opacity-50"
              >
                Yükle
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {isHost && (
              <>
                <button
                  type="button"
                  disabled={busy || !mediaUrl}
                  onClick={togglePlay}
                  className="rounded-lg bg-[#44307a] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {playing ? '⏸ Duraklat' : '▶ Oynat'}
                </button>
                <button
                  type="button"
                  disabled={busy || !mediaUrl}
                  onClick={resync}
                  className="rounded-lg bg-[#282a36] px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Senkronla
                </button>
              </>
            )}
            <span className="w-10 shrink-0 text-right text-[11px] tabular-nums">{fmt(shown)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, total || (media?.syncable ? 1 : 1))}
              step={0.5}
              value={Math.min(shown, Math.max(1, total || 1))}
              disabled={!isHost || !mediaUrl || !media?.syncable || total === 0}
              onChange={(e) => setSeekDraft(Number(e.target.value))}
              onPointerUp={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
              onKeyUp={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
              className="min-w-0 flex-1 accent-[#bd93f9]"
            />
            <span className="w-10 shrink-0 text-[11px] tabular-nums">{fmt(total)}</span>
            <button
              type="button"
              onClick={() => {
                setMuted((m) => !m);
                forceGesturePlay();
              }}
              className="rounded-lg bg-[#282a36] px-2 py-1.5 text-xs"
              title={muted ? 'Sesi aç' : 'Sesi kapat'}
            >
              {muted ? '🔇 Sesi aç' : '🔊'}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="hidden w-16 accent-[#bd93f9] sm:block"
              aria-label="Ses"
            />
          </div>
          {error && <p className="text-[11px] text-[#ff5555]">{error}</p>}
        </div>
      </ThreeSceneHost>
    </div>
  );
}
