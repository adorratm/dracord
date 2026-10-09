'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Line, Mesh, PerspectiveCamera, Texture } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import {
  disposeObject,
  isMyTurn,
  pointerNdc,
  round4,
  type GameProps,
} from '../three/sceneUtils';

type Ball = { id: number; x: number; y: number; vx: number; vy: number; sunk?: boolean };

type Body = {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  sunk: boolean;
  tx: number;
  tz: number;
  mesh: Mesh;
};

/** Normalize koordinat -> dünya: x ∈ [0,1] => ±W/2, y ∈ [0,1] => ±D/2 */
const W = 10;
const D = 5;
const R = 0.2;
const HX = 4.8;
const HZ = 2.3;
const POCKET_R = 0.46;
const POCKETS: [number, number][] = [
  [-4.9, -2.4],
  [0, -2.45],
  [4.9, -2.4],
  [-4.9, 2.4],
  [0, 2.45],
  [4.9, 2.4],
];
const CUE_START = { x: -3, z: 0 };
const BALL_COLORS = [
  '#f8f8f2',
  '#f1fa8c',
  '#8be9fd',
  '#ff5555',
  '#bd93f9',
  '#ffb86c',
  '#50fa7b',
  '#ff79c6',
  '#282a36',
];
const RACK_ORDER = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];

function toNorm(x: number, z: number) {
  return { x: round4(x / W + 0.5), y: round4(z / D + 0.5) };
}

function defaultBalls(): Ball[] {
  const balls: Ball[] = [{ id: 0, ...toNorm(CUE_START.x, CUE_START.z), vx: 0, vy: 0 }];
  let k = 0;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      const id = RACK_ORDER[k++]!;
      const wx = 2 + row * (Math.sqrt(3) * R + 0.005);
      const wz = (i - row / 2) * (2 * R + 0.012);
      balls.push({ id, ...toNorm(wx, wz), vx: 0, vy: 0 });
    }
  }
  return balls;
}

function parseBalls(raw: unknown): Ball[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: Ball[] = [];
  for (const b of raw) {
    if (!b || typeof b !== 'object') return null;
    const o = b as Record<string, unknown>;
    const id = Number(o.id);
    const x = Number(o.x);
    const y = Number(o.y);
    if (!Number.isInteger(id) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    out.push({ id, x, y, vx: 0, vy: 0, sunk: Boolean(o.sunk) });
  }
  return out;
}

export function BilliardsGame(props: GameProps) {
  const { session, canPlay } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const syncRef = useRef<(() => void) | null>(null);
  const [power, setPower] = useState(0);
  const [busy, setBusy] = useState(false);

  const myTurn = isMyTurn(props);
  const remaining = (parseBalls(session.state.balls) ?? defaultBalls()).filter(
    (b) => b.id !== 0 && !b.sunk,
  ).length;

  useEffect(() => {
    syncRef.current?.();
  }, [session.state.balls, session.state.turn]);

  const onReady = useCallback((api: ThreeSceneApi) => {
    const { THREE, scene, renderer } = api;
    const camera = api.camera as PerspectiveCamera;
    camera.position.set(0, 8.8, 6.4);
    camera.lookAt(0, 0, 0.2);
    const dom = renderer.domElement;

    const root = new THREE.Group();
    scene.add(root);
    const textures: Texture[] = [];

    // --- Masa ---
    const wood = new THREE.MeshStandardMaterial({ color: 0x3b2a4f, roughness: 0.6 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.7, 6.4), wood);
    base.position.y = -0.4;
    root.add(base);
    const felt = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.1, D),
      new THREE.MeshStandardMaterial({ color: 0x1f6b3f, roughness: 0.95 }),
    );
    felt.position.y = -0.05;
    felt.receiveShadow = true;
    root.add(felt);
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x2c1f40, roughness: 0.7 });
    const cush = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), cushionMat);
      m.position.set(x, 0.14, z);
      root.add(m);
    };
    cush(11.4, 0.7, 0, -2.85);
    cush(11.4, 0.7, 0, 2.85);
    cush(0.7, 5.0, -5.35, 0);
    cush(0.7, 5.0, 5.35, 0);
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xbd93f9 });
    const neon = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), neonMat);
      m.position.set(x, 0.31, z);
      root.add(m);
    };
    neon(10.1, 0.04, 0, -2.5);
    neon(10.1, 0.04, 0, 2.5);
    neon(0.04, 5.0, -5.05, 0);
    neon(0.04, 5.0, 5.05, 0);
    const pocketGeo = new THREE.CircleGeometry(POCKET_R * 0.9, 24);
    const pocketMat = new THREE.MeshBasicMaterial({ color: 0x050508 });
    for (const [px, pz] of POCKETS) {
      const m = new THREE.Mesh(pocketGeo, pocketMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(px, 0.012, pz);
      root.add(m);
    }

    // --- Toplar ---
    const ballGeo = new THREE.SphereGeometry(R, 28, 20);
    const bodies = new Map<number, Body>();
    for (let id = 0; id <= 15; id++) {
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 64;
      const ctx = cv.getContext('2d')!;
      const color = BALL_COLORS[id === 0 ? 0 : id <= 8 ? id : id - 8]!;
      if (id >= 9) {
        ctx.fillStyle = '#f8f8f2';
        ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = color;
        ctx.fillRect(0, 16, 128, 32);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 128, 64);
      }
      if (id > 0) {
        for (const cx of [32, 96]) {
          ctx.fillStyle = '#f8f8f2';
          ctx.beginPath();
          ctx.arc(cx, 32, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(id), cx, 33);
        }
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      textures.push(tex);
      const mesh = new THREE.Mesh(
        ballGeo,
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.2, metalness: 0.1 }),
      );
      mesh.castShadow = true;
      mesh.position.y = R;
      root.add(mesh);
      bodies.set(id, { id, x: 0, z: 0, vx: 0, vz: 0, sunk: false, tx: 0, tz: 0, mesh });
    }

    // --- Nişan çizgisi + isteka ---
    const aimGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
    ]);
    const aimLine: Line = new THREE.Line(
      aimGeo,
      new THREE.LineBasicMaterial({ color: 0xbd93f9, transparent: true, opacity: 0.85 }),
    );
    aimLine.visible = false;
    root.add(aimLine);
    const CUE_LEN = 4;
    const cueMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.045, CUE_LEN, 12),
      new THREE.MeshStandardMaterial({ color: 0xffb86c, roughness: 0.4 }),
    );
    cueMesh.visible = false;
    root.add(cueMesh);

    // --- Durum ---
    let simulating = false;
    let pendingSync = false;
    let snapped = false;
    let simTime = 0;
    let aimActive = false;
    let aimX = 0;
    let aimZ = 0;
    let lastPower = -1;
    let raf = 0;
    let last = performance.now();
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R);
    const hit = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tmpAxis = new THREE.Vector3();
    const tmpDir = new THREE.Vector3();

    const rollMesh = (b: Body, dx: number, dz: number) => {
      const d = Math.hypot(dx, dz);
      if (d < 1e-5) return;
      tmpAxis.set(dz, 0, -dx).normalize();
      b.mesh.rotateOnWorldAxis(tmpAxis, d / R);
    };

    const placeMesh = (b: Body) => {
      b.mesh.position.set(b.x, R, b.z);
      b.mesh.visible = !b.sunk;
    };

    const sync = () => {
      if (simulating) {
        pendingSync = true;
        return;
      }
      pendingSync = false;
      const balls = parseBalls(propsRef.current.session.state.balls) ?? defaultBalls();
      for (const b of balls) {
        const body = bodies.get(b.id);
        if (!body) continue;
        body.tx = (b.x - 0.5) * W;
        body.tz = (b.y - 0.5) * D;
        body.sunk = Boolean(b.sunk);
        if (!snapped || body.sunk) {
          body.x = body.tx;
          body.z = body.tz;
          placeMesh(body);
        }
      }
      snapped = true;
    };
    syncRef.current = sync;
    sync();

    const finishShot = () => {
      simulating = false;
      const cue = bodies.get(0)!;
      if (cue.sunk) {
        cue.sunk = false;
        cue.x = CUE_START.x;
        cue.z = CUE_START.z;
        for (const b of bodies.values()) {
          if (b.id === 0 || b.sunk) continue;
          if (Math.hypot(b.x - cue.x, b.z - cue.z) < 2 * R + 0.02) cue.x -= 0.5;
        }
      }
      const out: Ball[] = [];
      for (const b of [...bodies.values()].sort((a, c) => a.id - c.id)) {
        b.vx = 0;
        b.vz = 0;
        b.tx = b.x;
        b.tz = b.z;
        placeMesh(b);
        const n = toNorm(b.x, b.z);
        out.push({ id: b.id, x: n.x, y: n.y, vx: 0, vy: 0, ...(b.sunk ? { sunk: true } : {}) });
      }
      const p = propsRef.current;
      const turn = Number(p.session.state.turn ?? 0);
      setBusy(true);
      void p
        .onPatch({ balls: out, turn: turn + 1 })
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
          if (pendingSync) sync();
        });
    };

    const integrate = (h: number) => {
      const list = [...bodies.values()].filter((b) => !b.sunk);
      for (const b of list) {
        b.x += b.vx * h;
        b.z += b.vz * h;
        const sp = Math.hypot(b.vx, b.vz);
        if (sp > 0) {
          const ns = Math.max(0, sp - 2.5 * h);
          b.vx *= ns / sp;
          b.vz *= ns / sp;
        }
        if (sp > 0.001) rollMesh(b, b.vx * h, b.vz * h);
        for (const [px, pz] of POCKETS) {
          if (Math.hypot(b.x - px, b.z - pz) < POCKET_R) {
            b.sunk = true;
            b.vx = 0;
            b.vz = 0;
            b.x = px;
            b.z = pz;
            b.mesh.visible = false;
            break;
          }
        }
        if (b.sunk) continue;
        if (b.x > HX - R) {
          b.x = HX - R;
          b.vx = -b.vx * 0.8;
        } else if (b.x < -HX + R) {
          b.x = -HX + R;
          b.vx = -b.vx * 0.8;
        }
        if (b.z > HZ - R) {
          b.z = HZ - R;
          b.vz = -b.vz * 0.8;
        } else if (b.z < -HZ + R) {
          b.z = -HZ + R;
          b.vz = -b.vz * 0.8;
        }
      }
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i]!;
          const c = list[j]!;
          if (a.sunk || c.sunk) continue;
          const dx = c.x - a.x;
          const dz = c.z - a.z;
          const dist = Math.hypot(dx, dz);
          if (dist >= 2 * R || dist < 1e-6) continue;
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = (2 * R - dist) / 2;
          a.x -= nx * overlap;
          a.z -= nz * overlap;
          c.x += nx * overlap;
          c.z += nz * overlap;
          const vrel = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
          if (vrel > 0) {
            a.vx -= vrel * nx;
            a.vz -= vrel * nz;
            c.vx += vrel * nx;
            c.vz += vrel * nz;
          }
        }
      }
    };

    const updateAim = () => {
      const cue = bodies.get(0)!;
      const p = propsRef.current;
      const show = !simulating && isMyTurn(p) && !cue.sunk;
      aimLine.visible = show;
      cueMesh.visible = show;
      dom.style.cursor = show ? 'crosshair' : 'default';
      if (!show) {
        if (lastPower !== 0) {
          lastPower = 0;
          setPower(0);
        }
        return;
      }
      let dx = aimX - cue.x;
      let dz = aimZ - cue.z;
      let dist = Math.hypot(dx, dz);
      if (dist < 1e-4) {
        dx = 1;
        dz = 0;
        dist = 1e-4;
      }
      dx /= Math.max(dist, 1e-4);
      dz /= Math.max(dist, 1e-4);
      if (dist < 1e-3) dist = 0.5;
      const pw = Math.min(1, Math.max(0.1, dist / 6));
      const pos = aimGeo.attributes.position!;
      pos.setXYZ(0, cue.x, R, cue.z);
      pos.setXYZ(1, cue.x + dx * 3, R, cue.z + dz * 3);
      pos.needsUpdate = true;
      aimGeo.computeBoundingSphere();
      tmpDir.set(-dx, 0, -dz);
      const gap = 0.3 + pw * 0.9;
      cueMesh.position.set(
        cue.x + tmpDir.x * (gap + CUE_LEN / 2),
        R + 0.05,
        cue.z + tmpDir.z * (gap + CUE_LEN / 2),
      );
      cueMesh.quaternion.setFromUnitVectors(up, tmpDir);
      const pct = Math.round(pw * 100);
      if (pct !== lastPower) {
        lastPower = pct;
        setPower(pct);
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (simulating) {
        simTime += dt;
        const sub = 6;
        for (let i = 0; i < sub; i++) integrate(dt / sub);
        for (const b of bodies.values()) if (!b.sunk) b.mesh.position.set(b.x, R, b.z);
        let moving = false;
        for (const b of bodies.values()) {
          if (!b.sunk && Math.hypot(b.vx, b.vz) > 0.06) moving = true;
        }
        if (!moving || simTime > 14) finishShot();
      } else {
        const k = Math.min(1, dt * 9);
        for (const b of bodies.values()) {
          if (b.sunk) continue;
          const ox = b.x;
          const oz = b.z;
          b.x += (b.tx - b.x) * k;
          b.z += (b.tz - b.z) * k;
          rollMesh(b, b.x - ox, b.z - oz);
          placeMesh(b);
        }
        updateAim();
      }
    };
    loop();

    const toTable = (e: PointerEvent) => {
      const ndc = pointerNdc(e, dom);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        aimX = hit.x;
        aimZ = hit.z;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (simulating) return;
      toTable(e);
    };
    const onDown = (e: PointerEvent) => {
      if (simulating || !isMyTurn(propsRef.current)) return;
      aimActive = true;
      toTable(e);
    };
    const onUp = (e: PointerEvent) => {
      if (!aimActive) return;
      aimActive = false;
      if (simulating || !isMyTurn(propsRef.current)) return;
      toTable(e);
      const cue = bodies.get(0)!;
      if (cue.sunk) return;
      let dx = aimX - cue.x;
      let dz = aimZ - cue.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.05) return;
      dx /= dist;
      dz /= dist;
      const pw = Math.min(1, Math.max(0.1, dist / 6));
      const speed = 3 + pw * 10;
      cue.vx = dx * speed;
      cue.vz = dz * speed;
      simulating = true;
      simTime = 0;
      aimLine.visible = false;
      cueMesh.visible = false;
      setPower(0);
      lastPower = 0;
    };
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);

    return () => {
      cancelAnimationFrame(raf);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      syncRef.current = null;
      scene.remove(root);
      disposeObject(root);
      textures.forEach((t) => t.dispose());
    };
  }, []);

  const statusText = !canPlay
    ? 'İzleyici'
    : busy
      ? 'Hamle gönderiliyor…'
      : myTurn
        ? 'Senin sıran — masada nişan al, bırakarak vur'
        : 'Rakip oynuyor';

  return (
    <ThreeSceneHost className="absolute inset-0" onReady={onReady}>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
        <span className="inline-flex w-fit items-center rounded-lg border border-[#bd93f9]/50 bg-[#11131e]/80 px-3 py-1 text-xs font-semibold text-[#f8f8f2]">
          Bilardo · {statusText}
        </span>
        <span className="inline-flex w-fit rounded-lg bg-[#11131e]/70 px-3 py-1 text-[11px] text-[#bd93f9]">
          Masada kalan top: {remaining} · Tur {Number(session.state.turn ?? 0) + 1}
        </span>
      </div>
      {myTurn && !busy && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 w-56 -translate-x-1/2">
          <div className="mb-1 text-center text-[11px] text-[#f8f8f2]/80">Güç %{power}</div>
          <div className="h-2 overflow-hidden rounded-full bg-[#282a36]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#50fa7b] via-[#f1fa8c] to-[#ff5555]"
              style={{ width: `${power}%` }}
            />
          </div>
        </div>
      )}
    </ThreeSceneHost>
  );
}
