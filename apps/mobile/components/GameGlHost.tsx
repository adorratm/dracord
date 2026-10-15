import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';
import type { ActivityKind } from '@dracord/types';
import { GAME_KIND_LABEL } from '@dracord/game-core';
import { colors } from '@dracord/app-theme';

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material;
    if (!mat) return;
    for (const m of Array.isArray(mat) ? mat : [mat]) m.dispose();
  });
}

/** expo-gl eksik WebGL uzantı / pixelStore gürültüsünü kes */
function patchExpoGl(gl: ExpoWebGLRenderingContext) {
  const skipPixel = new Set([0x9240, 0x9241, 0x9243]);
  const origPixel = gl.pixelStorei.bind(gl);
  gl.pixelStorei = ((pname: number, param: number) => {
    if (skipPixel.has(pname)) return;
    try {
      origPixel(pname, param);
    } catch {
      /* EXGL */
    }
  }) as typeof gl.pixelStorei;

  const origExt = gl.getExtension.bind(gl);
  gl.getExtension = ((name: string) => {
    if (name === 'WEBGL_lose_context') {
      return {
        loseContext: () => undefined,
        restoreContext: () => undefined,
      };
    }
    try {
      return origExt(name);
    } catch {
      return null;
    }
  }) as typeof gl.getExtension;
}

function lambert(color: number, emissive = 0x000000) {
  return new THREE.MeshLambertMaterial({ color, emissive });
}

/** Oyun türüne göre okunabilir sahne (Lambert — expo-gl PBR yok) */
function buildScene(kind: ActivityKind, scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(3, 6, 4);
  scene.add(sun);

  const root = new THREE.Group();
  root.name = 'gameRoot';
  scene.add(root);

  if (kind === 'billiards') {
    const felt = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 2.2), lambert(0x0d5c2e));
    felt.position.y = 0.05;
    root.add(felt);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 2.4), lambert(0x4a2a12));
    rail.position.y = 0;
    root.add(rail);
    const colorsBall = [0xffffff, 0xffd700, 0x1e90ff, 0xff2222, 0x222222, 0x9b59b6];
    colorsBall.forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), lambert(c));
      b.position.set(-1.2 + i * 0.45, 0.22, (i % 2) * 0.25 - 0.1);
      root.add(b);
    });
  } else if (kind === 'tavla') {
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 3.2), lambert(0x5c3a1e));
    board.position.y = 0.06;
    root.add(board);
    for (let i = 0; i < 12; i++) {
      const tri = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 1.2, 3),
        lambert(i % 2 === 0 ? 0xd4a574 : 0x2a1a0a),
      );
      tri.rotation.x = Math.PI;
      tri.position.set(-2.0 + i * 0.35, 0.7, i < 6 ? -1.1 : 1.1);
      root.add(tri);
    }
    for (let i = 0; i < 8; i++) {
      const chip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16),
        lambert(i < 4 ? 0xf5f0e6 : 0x6b3fa0),
      );
      chip.position.set(-1.6 + (i % 4) * 0.35, 0.18, i < 4 ? -0.9 : 0.9);
      root.add(chip);
    }
  } else if (kind === 'bowling') {
    const lane = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 5.5), lambert(0xd2b48c));
    lane.position.set(0, 0.04, 0);
    root.add(lane);
    const gutterL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 5.5), lambert(0x333333));
    gutterL.position.set(-0.75, 0.03, 0);
    root.add(gutterL);
    const gutterR = gutterL.clone();
    gutterR.position.x = 0.75;
    root.add(gutterR);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c <= r; c++) {
        const pin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.08, 0.35, 10),
          lambert(0xf5f5f5, 0x222222),
        );
        pin.position.set((c - r / 2) * 0.22, 0.25, -2.0 - r * 0.2);
        root.add(pin);
      }
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), lambert(0x2c3e8c));
    ball.name = 'bowlBall';
    ball.position.set(0, 0.22, 2.0);
    root.add(ball);
  } else if (kind === 'okey') {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.12, 32), lambert(0x1a5c3a));
    table.position.y = 0.06;
    root.add(table);
    const tileColors = [0xe74c3c, 0x2ecc71, 0x3498db, 0x111111];
    for (let i = 0; i < 14; i++) {
      const t = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.06, 0.38),
        lambert(tileColors[i % 4]!),
      );
      t.position.set(-1.8 + i * 0.28, 0.2, 1.4);
      root.add(t);
    }
  } else if (kind === 'blackjack') {
    const felt = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), lambert(0x0f5132));
    felt.rotation.x = -Math.PI / 2;
    felt.position.y = 0.02;
    root.add(felt);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.08, 8, 48), lambert(0x6b3a1f));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.06;
    root.add(rim);
    for (let i = 0; i < 5; i++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.7), lambert(0xf8f8f2));
      card.position.set(-0.9 + i * 0.45, 0.12, 0.8);
      card.rotation.y = (i - 2) * 0.08;
      root.add(card);
    }
    for (let i = 0; i < 2; i++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.7), lambert(i === 1 ? 0x1a1a2e : 0xf8f8f2));
      card.position.set(-0.2 + i * 0.5, 0.12, -1.0);
      root.add(card);
    }
  } else {
    // watch_party / diğer
    const stage = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.8), lambert(0x1a5c3a));
    stage.position.y = 0.2;
    root.add(stage);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 18), lambert(0xbd93f9, 0x4a2a7a));
    orb.name = 'orb';
    orb.position.set(0, 0.75, 0);
    root.add(orb);
  }

  return root;
}

function cameraFor(kind: ActivityKind, aspect: number) {
  const cam = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
  if (kind === 'bowling') {
    cam.position.set(0, 2.4, 4.8);
    cam.lookAt(0, 0.3, -0.5);
  } else if (kind === 'tavla') {
    cam.position.set(0, 5.5, 0.2);
    cam.lookAt(0, 0, 0);
  } else if (kind === 'okey') {
    cam.position.set(0, 4.2, 3.2);
    cam.lookAt(0, 0.2, 0.4);
  } else if (kind === 'blackjack') {
    cam.position.set(0, 3.8, 3.6);
    cam.lookAt(0, 0.1, 0);
  } else {
    cam.position.set(0, 3.2, 4.2);
    cam.lookAt(0, 0.3, 0);
  }
  return cam;
}

/**
 * expo-gl + three oyun hostu.
 * - WEBGL_lose_context stub (uyarı yok)
 * - getContext her zaman gl (Three r163+ / WebGL2)
 * - kind’a özel sahne
 */
export function GameGlHost({
  kind,
  height = 300,
}: {
  kind: ActivityKind;
  height?: number;
}) {
  const raf = useRef(0);
  const alive = useRef(true);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const [glError, setGlError] = useState<string | null>(null);
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  const [glKey, setGlKey] = useState(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelAnimationFrame(raf.current);
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      if (scene) disposeObject3D(scene);
      // forceContextLoss çağırma — expo-gl WEBGL_lose_context desteklemez
      if (renderer) renderer.dispose();
      sceneRef.current = null;
      rendererRef.current = null;
      glRef.current = null;
    };
  }, []);

  // kind değişince GL’i yeniden kur
  useEffect(() => {
    setGlKey((k) => k + 1);
  }, [kind]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height: h } = e.nativeEvent.layout;
    if (width > 0 && h > 0) {
      setLayout((prev) =>
        Math.abs(prev.w - width) > 1 || Math.abs(prev.h - h) > 1
          ? { w: width, h }
          : prev,
      );
    }
  }, []);

  const onContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      try {
        cancelAnimationFrame(raf.current);
        if (sceneRef.current) disposeObject3D(sceneRef.current);
        if (rendererRef.current) rendererRef.current.dispose();

        patchExpoGl(gl);
        glRef.current = gl;

        let width = gl.drawingBufferWidth || Math.round(layout.w) || 1;
        let height = gl.drawingBufferHeight || Math.round(layout.h) || 1;
        // Android bazen 0 buffer ile açılır — layout’a düş
        if (width < 2 || height < 2) {
          width = Math.max(2, Math.round(layout.w) || 320);
          height = Math.max(2, Math.round(layout.h) || height);
        }

        // Three’ye context parametresi VERME — Expo WebGL2 instanceof tuzağı
        // getContext her tip için aynı gl’i döndür
        const canvas = {
          width,
          height,
          style: {},
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          clientWidth: width,
          clientHeight: height,
          getContext: () => gl,
        } as unknown as HTMLCanvasElement;

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
        });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(new THREE.Color(colors.bg), 1);
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        rendererRef.current = renderer;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(colors.bg);
        sceneRef.current = scene;
        const camera = cameraFor(kind, width / Math.max(1, height));
        const root = buildScene(kind, scene);

        setGlError(null);

        const t0 = Date.now();
        const tick = () => {
          if (!alive.current) return;
          raf.current = requestAnimationFrame(tick);
          const t = (Date.now() - t0) / 1000;
          const orb = root.getObjectByName('orb');
          if (orb) {
            orb.rotation.y += 0.02;
            orb.position.y = 0.75 + Math.sin(t * 2) * 0.08;
          }
          const ball = root.getObjectByName('bowlBall');
          if (ball) {
            ball.position.z = 2.0 - ((t * 0.8) % 3.8);
            ball.rotation.x -= 0.08;
          }
          root.rotation.y = kind === 'tavla' || kind === 'okey' ? 0 : Math.sin(t * 0.25) * 0.08;
          renderer.render(scene, camera);
          gl.endFrameEXP();
        };
        tick();
      } catch (e) {
        setGlError(e instanceof Error ? e.message : 'GL başlatılamadı');
      }
    },
    [kind, layout.w, layout.h],
  );

  const ready = layout.w > 8 && layout.h > 8;

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={onLayout}
      collapsable={false}
    >
      {glError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>{GAME_KIND_LABEL[kind]}</Text>
          <Text style={styles.errorText}>{glError}</Text>
        </View>
      ) : ready ? (
        <GLView
          key={`${glKey}-${Math.round(layout.w)}x${Math.round(layout.h)}`}
          style={StyleSheet.absoluteFill}
          onContextCreate={onContextCreate}
          collapsable={false}
        />
      ) : (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Sahne hazırlanıyor…</Text>
        </View>
      )}
      <View style={styles.badge} pointerEvents="none">
        <Text style={styles.badgeText}>{GAME_KIND_LABEL[kind]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: colors.bg,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  badge: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(17,19,30,0.85)',
  },
  badgeText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: { color: colors.text, fontWeight: '800', fontSize: 16 },
  errorText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
