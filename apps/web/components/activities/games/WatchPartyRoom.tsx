'use client';

import type { ActivitySessionDto } from '@dracord/types';
import { useEffect, useRef, useState } from 'react';
import { useUserPreferences } from '@/lib/user-preferences';

/** Watch party: moderatör medya + Three.js lounge + karakter. */
export function WatchPartyRoom({
  session,
  isHost,
  onPatch,
}: {
  session: ActivitySessionDto;
  userId?: string;
  isHost: boolean;
  onPatch: (state: Record<string, unknown>) => Promise<void>;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { prefs, setSection } = useUserPreferences();
  const avatar = prefs.avatar3d;
  const [urlDraft, setUrlDraft] = useState(String(session.state.mediaUrl ?? ''));
  const mediaUrl = String(session.state.mediaUrl ?? '');
  const playing = Boolean(session.state.playing);
  const at = Number(session.state.at ?? 0);

  useEffect(() => {
    setUrlDraft(mediaUrl);
  }, [mediaUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !mediaUrl) return;
    if (Math.abs(v.currentTime - at) > 1.25) {
      try {
        v.currentTime = at;
      } catch {
        // ignore
      }
    }
    if (playing) void v.play().catch(() => undefined);
    else v.pause();
  }, [playing, at, mediaUrl]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const THREE = await import('three');
      if (disposed) return;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1b26);
      const camera = new THREE.PerspectiveCamera(
        60,
        el.clientWidth / Math.max(1, el.clientHeight),
        0.1,
        100,
      );
      camera.position.set(0, 2.2, 5.5);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      el.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0x8866aa, 0.55));
      const light = new THREE.DirectionalLight(0xffffff, 1.1);
      light.position.set(3, 6, 4);
      scene.add(light);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 10),
        new THREE.MeshStandardMaterial({ color: 0x2a2d3a }),
      );
      floor.rotation.x = -Math.PI / 2;
      scene.add(floor);

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(4.5, 2.5),
        new THREE.MeshStandardMaterial({ color: 0x111122, emissive: 0x222244 }),
      );
      screen.position.set(0, 2.1, -3.2);
      scene.add(screen);

      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.7, 4, 8),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(avatar.color) }),
      );
      body.position.set(avatar.x, 1.0, avatar.z);
      scene.add(body);

      const keys = new Set<string>();
      const onKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
      const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const speed = 0.04 * (avatar.speed || 1);
        if (keys.has('w') || keys.has('arrowup')) body.position.z -= speed;
        if (keys.has('s') || keys.has('arrowdown')) body.position.z += speed;
        if (keys.has('a') || keys.has('arrowleft')) body.position.x -= speed;
        if (keys.has('d') || keys.has('arrowright')) body.position.x += speed;
        body.position.x = Math.max(-5, Math.min(5, body.position.x));
        body.position.z = Math.max(-2, Math.min(4, body.position.z));
        camera.position.x = body.position.x * 0.35;
        camera.lookAt(screen.position);
        renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
        camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      };
      window.addEventListener('resize', onResize);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('resize', onResize);
        setSection('avatar3d', {
          x: body.position.x,
          z: body.position.z,
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [avatar.color, avatar.speed, avatar.x, avatar.z, setSection]);

  return (
    <div className="absolute inset-0 flex flex-col md:flex-row min-h-0 bg-surface-container-lowest">
      <div className="flex-1 min-h-[180px] md:min-h-0 relative" ref={mountRef}>
        <p className="absolute top-2 left-2 z-[2] font-label-sm text-white/80 bg-black/40 px-2 py-1 rounded">
          WASD · XP {avatar.xp}
        </p>
      </div>
      <div className="w-full md:w-72 shrink-0 border-t md:border-t-0 md:border-l border-surface-container-high flex flex-col p-space-sm gap-space-sm bg-surface-container-low overflow-y-auto">
        {isHost ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="font-label-sm text-on-surface-variant">Medya URL</span>
              <input
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://… mp4"
                className="h-9 px-2 rounded-lg bg-surface-container-highest outline-none font-body-sm"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                void onPatch({ mediaUrl: urlDraft.trim(), playing: false, at: 0 })
              }
              className="h-9 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            >
              Uygula
            </button>
            <button
              type="button"
              className="h-9 rounded-lg bg-surface-container-high font-label-sm"
              onClick={() =>
                void onPatch({
                  playing: !playing,
                  at: videoRef.current?.currentTime ?? at,
                })
              }
            >
              {playing ? 'Duraklat' : 'Oynat'}
            </button>
          </>
        ) : (
          <p className="font-body-sm text-on-surface-variant">
            Moderatör medyayı kontrol ediyor.
          </p>
        )}
        {mediaUrl ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            className="w-full rounded-lg bg-black max-h-40"
            controls={isHost}
            playsInline
          />
        ) : (
          <div className="rounded-lg bg-surface-container h-24 flex items-center justify-center font-label-sm text-outline">
            Medya yok
          </div>
        )}
        <label className="flex flex-col gap-1">
          <span className="font-label-sm text-on-surface-variant">Karakter rengi</span>
          <input
            type="color"
            value={avatar.color}
            onChange={(e) => setSection('avatar3d', { color: e.target.value })}
            className="h-9 w-full rounded cursor-pointer"
          />
        </label>
        <button
          type="button"
          className="h-9 rounded-lg bg-surface-container-high font-label-sm"
          onClick={() =>
            setSection('avatar3d', {
              xp: avatar.xp + 10,
              speed: Math.min(2, avatar.speed + 0.05),
            })
          }
        >
          Karakter geliştir (+XP)
        </button>
      </div>
    </div>
  );
}
