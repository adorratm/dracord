import { useEffect, useRef } from 'react';
import type { ActivityKind } from '@dracord/types';
import * as THREE from 'three';
import { colors } from '@dracord/app-theme';

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) {
      for (const key of Object.keys(m) as (keyof typeof m)[]) {
        const v = m[key];
        if (v && typeof v === 'object' && 'minFilter' in (v as object)) {
          (v as THREE.Texture).dispose();
        }
      }
      m.dispose();
    }
  });
}

/** Basit Three.js sahne — native desktop oyun hostu (WebView yok) */
export function GameCanvas({
  kind,
  label,
  height = '100%',
}: {
  kind: ActivityKind;
  label: string;
  height?: number | string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const w = el.clientWidth || 640;
    const h = typeof height === 'number' ? height : el.clientHeight || 360;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.bg);
    const camera = new THREE.PerspectiveCamera(45, w / Math.max(1, h), 0.1, 100);
    camera.position.set(0, 2.2, 4.5);
    camera.lookAt(0, 0.4, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1.1);
    light.position.set(2, 5, 3);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xbd93f9, 0.35));

    const table = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.12, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1a5c3a }),
    );
    table.position.y = 0.2;
    scene.add(table);

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xbd93f9, emissive: 0x4a2a7a }),
    );
    orb.position.set(0, 0.7, 0);
    scene.add(orb);

    let raf = 0;
    const tick = () => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      orb.rotation.y += 0.02;
      orb.position.y = 0.7 + Math.sin(performance.now() / 500) * 0.08;
      renderer.render(scene, camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      if (!alive) return;
      const nw = el.clientWidth || w;
      const nh = typeof height === 'number' ? height : el.clientHeight || h;
      camera.aspect = nw / Math.max(1, nh);
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
    });
    ro.observe(el);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposeObject3D(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === el) {
        el.removeChild(renderer.domElement);
      }
    };
  }, [kind, height]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute',
          left: 12,
          top: 12,
          padding: '6px 10px',
          borderRadius: 8,
          background: 'rgba(17,19,30,0.85)',
          color: colors.primary,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {label} · Three.js native
      </div>
    </div>
  );
}
