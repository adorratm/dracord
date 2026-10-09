'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@dracord/ui';

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

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      renderer.shadowMap.enabled = true;
      el.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, {
        width: '100%',
        height: '100%',
        display: 'block',
        touchAction: 'none',
      });

      const amb = new THREE.AmbientLight(0x9b8ec4, 0.85);
      scene.add(amb);
      const key = new THREE.DirectionalLight(0xffe0c0, 1.4);
      key.position.set(8, 14, 6);
      key.castShadow = true;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x6272a4, 0.55);
      fill.position.set(-6, 8, -4);
      scene.add(fill);
      const neon = new THREE.PointLight(0xbd93f9, 1.2, 28);
      neon.position.set(0, 3, 0);
      scene.add(neon);

      cleanupScene = onReadyRef.current({ THREE, scene, camera, renderer, root: el });

      const tick = () => {
        if (disposed || !renderer) return;
        frame = requestAnimationFrame(tick);
        renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
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
      };
      ro = new ResizeObserver(onResize);
      ro.observe(el);
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro?.disconnect();
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
