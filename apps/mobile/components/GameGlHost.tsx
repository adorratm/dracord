import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) m.dispose();
  });
}

/** expo-gl + three oyun hostu — işlevsel parity */
export function GameGlHost({ kind }: { kind: ActivityKind }) {
  const raf = useRef(0);
  const alive = useRef(true);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelAnimationFrame(raf.current);
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      if (scene) disposeObject3D(scene);
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
      sceneRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    // Önceki bağlam kaldıysa temizle (GLView yeniden create edebilir)
    cancelAnimationFrame(raf.current);
    if (sceneRef.current) disposeObject3D(sceneRef.current);
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current.forceContextLoss();
    }

    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
    const canvas = {
      width,
      height,
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      clientHeight: height,
      clientWidth: width,
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl as unknown as WebGLRenderingContext,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(colors.bg);
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(45, width / Math.max(1, height), 0.1, 100);
    camera.position.set(0, 2.2, 4.5);
    camera.lookAt(0, 0.4, 0);
    scene.add(new THREE.AmbientLight(0xbd93f9, 0.4));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(2, 5, 3);
    scene.add(light);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.12, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x1a5c3a }),
    );
    table.position.y = 0.2;
    scene.add(table);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0xbd93f9, emissive: 0x4a2a7a }),
    );
    orb.position.set(0, 0.7, 0);
    scene.add(orb);

    const tick = () => {
      if (!alive.current) return;
      raf.current = requestAnimationFrame(tick);
      orb.rotation.y += 0.02;
      orb.position.y = 0.7 + Math.sin(Date.now() / 500) * 0.08;
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    tick();
  }, []);

  return (
    <View style={styles.wrap}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{GAME_KIND_LABEL[kind]} · expo-gl</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minHeight: 220, backgroundColor: colors.bg },
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
});
