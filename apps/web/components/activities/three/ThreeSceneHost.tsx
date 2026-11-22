'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@dracord/ui';
import { graphicsProfile, onGraphicsQualityChange } from './graphicsQuality';

export type ThreeSceneApi = {
  THREE: typeof import('three');
  scene: import('three').Scene;
  camera: import('three').PerspectiveCamera | import('three').OrthographicCamera;
  renderer: import('three').WebGLRenderer;
  root: HTMLDivElement;
};

type Props = {
  className?: string;
  orthographic?: boolean;
  /** Sahne kurulumu; dispose döndürülebilir */
  onReady: (api: ThreeSceneApi) => void | (() => void);
  children?: ReactNode;
};

/** Ortak WebGL host — resize + rAF döngüsü */
export function ThreeSceneHost({ className, orthographic, onReady, children }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let disposed = false;
    let frame = 0;
    let cleanupScene: void | (() => void);
    let renderer: import('three').WebGLRenderer | null = null;
    let ro: ResizeObserver | null = null;
    let offQuality: (() => void) | null = null;
    let anisoTimer: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      const THREE = await import('three');
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x11131e);

      const w = el.clientWidth || 640;
      const h = el.clientHeight || 360;
      const aspect = w / Math.max(1, h);

      let camera: import('three').PerspectiveCamera | import('three').OrthographicCamera;
      if (orthographic) {
        const d = 12;
        camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, -100, 1000);
        camera.position.set(18, 18, 18);
        camera.lookAt(0, 1, 0);
      } else {
        camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 200);
        camera.position.set(0, 8, 14);
        camera.lookAt(0, 0, 0);
      }

      let profile = graphicsProfile();
      renderer = new THREE.WebGLRenderer({
        antialias: profile.antialias,
        alpha: false,
        powerPreference: 'high-performance',
      });
      let dpr = profile.maxDpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // Düşük exposure — spotlar renkleri yıkamasın
      renderer.toneMappingExposure = 0.88;
      el.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
      });

      // Nötr baz + belirgin gölge (hemi düşük → gölgeler daha koyu)
      const hemi = new THREE.HemisphereLight(0xf2efe6, 0x1a2030, 0.38);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xfff4e8, 1.05);
      key.position.set(4, 18, 5);
      key.castShadow = true;
      key.shadow.mapSize.set(profile.shadowMap, profile.shadowMap);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 50;
      key.shadow.camera.left = -14;
      key.shadow.camera.right = 14;
      key.shadow.camera.top = 14;
      key.shadow.camera.bottom = -14;
      key.shadow.bias = -0.00035;
      key.shadow.normalBias = 0.035;
      key.shadow.radius = 2.5;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xd8e4f5, 0.18);
      fill.position.set(-8, 10, -5);
      scene.add(fill);

      cleanupScene = onReadyRef.current({ THREE, scene, camera, renderer, root: el });

      // Doku keskinliği: eğik açıdaki zemin/çuha/pist bulanık olmasın — GPU'nun en yüksek anizotropisi
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const seen = new WeakSet<object>();
      const sharpen = () => {
        scene.traverse((o) => {
          const m = (o as unknown as { material?: unknown }).material;
          const mats = (Array.isArray(m) ? m : m ? [m] : []) as Array<Record<string, unknown>>;
          for (const mat of mats) {
            for (const k of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'emissiveMap']) {
              const t = mat[k] as { anisotropy?: number; needsUpdate?: boolean } | null | undefined;
              if (!t || seen.has(t)) continue;
              seen.add(t);
              if ((t.anisotropy ?? 1) < maxAniso) {
                t.anisotropy = maxAniso;
                t.needsUpdate = true;
              }
            }
          }
        });
      };
      sharpen();
      anisoTimer = setInterval(sharpen, 2000);

      const applyProfile = () => {
        if (!renderer) return;
        profile = graphicsProfile();
        dpr = profile.maxDpr;
        renderer.setPixelRatio(dpr);
        if (key.shadow.mapSize.x !== profile.shadowMap) {
          key.shadow.mapSize.set(profile.shadowMap, profile.shadowMap);
          key.shadow.map?.dispose();
          key.shadow.map = null as unknown as typeof key.shadow.map;
        }
        onResize();
      };
      offQuality = onGraphicsQualityChange(applyProfile);

      // Dinamik çözünürlük (Otomatik): ilk 6 sn (sahne yüklenirken takılır) sayılmaz; ~2 sn ortalama
      // < 30 fps → %15 düşür; ≥ 50 fps 4 sn → geri çık (mobil WebView çoğu zaman 60'a kilitli değil)
      const warmUntil = performance.now() + 6000;
      let last = performance.now();
      let acc = 0;
      let frames = 0;
      let goodFor = 0;
      const tick = () => {
        if (disposed || !renderer) return;
        frame = requestAnimationFrame(tick);
        renderer.render(scene, camera);
        const now = performance.now();
        acc += now - last;
        last = now;
        frames++;
        if (acc >= 2000) {
          const fps = (frames * 1000) / acc;
          acc = 0;
          frames = 0;
          if (!profile.adaptive || document.hidden || now < warmUntil) return;
          if (fps < 30 && dpr > profile.minDpr) {
            dpr = Math.max(profile.minDpr, Math.round(dpr * 0.85 * 100) / 100);
            renderer.setPixelRatio(dpr);
            onResize();
            goodFor = 0;
          } else if (fps >= 50 && dpr < profile.maxDpr) {
            goodFor += 2;
            if (goodFor >= 4) {
              dpr = Math.min(profile.maxDpr, Math.round((dpr + 0.25) * 100) / 100);
              renderer.setPixelRatio(dpr);
              onResize();
              goodFor = 0;
            }
          } else goodFor = 0;
        }
      };
      tick();

      function onResize() {
        if (!renderer || !hostRef.current) return;
        const nw = hostRef.current.clientWidth;
        const nh = hostRef.current.clientHeight;
        if (nw < 2 || nh < 2) return;
        const na = nw / nh;
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = na;
          camera.updateProjectionMatrix();
        } else {
          const d = 12;
          camera.left = -d * na;
          camera.right = d * na;
          camera.top = d;
          camera.bottom = -d;
          camera.updateProjectionMatrix();
        }
        renderer.setSize(nw, nh, false);
      }
      ro = new ResizeObserver(onResize);
      ro.observe(el);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro?.disconnect();
      offQuality?.();
      if (anisoTimer) clearInterval(anisoTimer);
      try {
        cleanupScene?.();
      } catch {
        /* ignore */
      }
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
        renderer = null;
      }
    };
  }, [orthographic]);

  return (
    <div className={cn('relative w-full h-full min-h-[240px] bg-surface-dim', className)}>
      <div ref={hostRef} className="absolute inset-0" />
      {children}
    </div>
  );
}
