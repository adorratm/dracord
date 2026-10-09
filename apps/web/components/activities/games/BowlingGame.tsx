'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Line, Mesh, PerspectiveCamera, Quaternion } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import {
  disposeObject,
  playerLabel,
  pointerNdc,
  type GameProps,
} from '../three/sceneUtils';

type FrameState = { rolls: number[]; complete: boolean };

type LastRoll = {
  by: string;
  pins: number;
  knocked: number[];
  standing: number[];
  tx: number;
  t: number;
};

const ALL_PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const LANE_HALF = 1.6;
const START_Z = 10;
const PIN_Z = -8;
const BALL_R = 0.3;
const PIN_R = 0.17;

/** Zar dizisinden frame listesi */
function parseFrames(rolls: number[]): FrameState[] {
  const frames: FrameState[] = [];
  let i = 0;
  for (let f = 0; f < 10 && i < rolls.length; f++) {
    if (f < 9) {
      if (rolls[i] === 10) {
        frames.push({ rolls: [10], complete: true });
        i += 1;
      } else {
        const r = rolls.slice(i, i + 2);
        frames.push({ rolls: r, complete: r.length === 2 });
        i += r.length;
      }
    } else {
      const r = rolls.slice(i, i + 3);
      const first = r[0] ?? 0;
      const second = r[1];
      const needThird = first === 10 || (second !== undefined && first + second === 10);
      const complete = needThird ? r.length === 3 : r.length >= 2;
      frames.push({ rolls: r, complete });
      i += r.length;
    }
  }
  return frames;
}

function scoreRolls(rolls: number[]): number {
  let score = 0;
  let i = 0;
  for (let f = 0; f < 10; f++) {
    const a = rolls[i];
    if (a === undefined) break;
    if (a === 10) {
      score += 10 + (rolls[i + 1] ?? 0) + (rolls[i + 2] ?? 0);
      i += 1;
    } else {
      const b = rolls[i + 1];
      if (b !== undefined && a + b === 10) score += 10 + (rolls[i + 2] ?? 0);
      else score += a + (b ?? 0);
      i += 2;
    }
  }
  return score;
}

function readFrames(raw: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.map((n) => Math.max(0, Math.min(10, Number(n) || 0)));
    }
  }
  return out;
}

/** Sıradaki atıcı: oyuncular frame frame sırayla oynar; bitti ise null */
function nextShooter(playerIds: string[], frames: Record<string, number[]>): string | null {
  const parsed = playerIds.map((id) => parseFrames(frames[id] ?? []));
  for (let f = 0; f < 10; f++) {
    for (let p = 0; p < playerIds.length; p++) {
      const fr = parsed[p]![f];
      if (!fr || !fr.complete) return playerIds[p]!;
    }
  }
  return null;
}

function readLastRoll(raw: unknown): LastRoll | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => n >= 0 && n < 10) : []);
  return {
    by: String(o.by ?? ''),
    pins: Number(o.pins ?? 0),
    knocked: arr(o.knocked),
    standing: Array.isArray(o.standing) ? arr(o.standing) : ALL_PINS,
    tx: Number(o.tx ?? 0),
    t: Number(o.t ?? 0),
  };
}

type Pin = {
  id: number;
  bx: number;
  bz: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  fallen: boolean;
  fall: number;
  axis: [number, number];
  active: boolean;
  mesh: Mesh;
};

export function BowlingGame(props: GameProps) {
  const { session, userId, canPlay } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const syncRef = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);

  const frames = readFrames(session.state.frames);
  const shooter = nextShooter(session.playerIds, frames);
  const myTurn = canPlay && !!userId && shooter === userId;
  const finished = session.playerIds.length > 0 && shooter === null;
  const lastRoll = readLastRoll(session.state.lastRoll);

  useEffect(() => {
    syncRef.current?.();
  }, [session.state.frames, session.state.lastRoll, session.state.turn]);

  const onReady = useCallback((api: ThreeSceneApi) => {
    const { THREE, scene, renderer } = api;
    const camera = api.camera as PerspectiveCamera;
    camera.position.set(0, 3.1, 15.5);
    camera.lookAt(0, 0.4, -5);
    const dom = renderer.domElement;
    const root = new THREE.Group();
    scene.add(root);

    // --- Hat ---
    const laneMat = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.35 });
    const lane = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2, 0.2, 24), laneMat);
    lane.position.set(0, -0.1, -1);
    lane.receiveShadow = true;
    root.add(lane);
    const gutterMat = new THREE.MeshStandardMaterial({ color: 0x1b1d2b, roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 24), gutterMat);
      g.position.set(sx * (LANE_HALF + 0.3), -0.2, -1);
      root.add(g);
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.05, 24),
        new THREE.MeshBasicMaterial({ color: 0xbd93f9 }),
      );
      rail.position.set(sx * (LANE_HALF + 0.62), 0.02, -1);
      root.add(rail);
    }
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x3b2a2a });
    const arrowGeo = new THREE.ConeGeometry(0.1, 0.35, 3);
    for (let i = -2; i <= 2; i++) {
      const a = new THREE.Mesh(arrowGeo, arrowMat);
      a.rotation.x = -Math.PI / 2;
      a.position.set(i * 0.55, 0.006, 3 - Math.abs(i) * 0.6);
      root.add(a);
    }
    const foul = new THREE.Mesh(
      new THREE.BoxGeometry(LANE_HALF * 2, 0.01, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff5555 }),
    );
    foul.position.set(0, 0.006, START_Z + 0.7);
    root.add(foul);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1c1f33, roughness: 0.8 }),
    );
    back.position.set(0, 1.8, -12.6);
    root.add(back);
    const backNeon = new THREE.Mesh(
      new THREE.BoxGeometry(7.4, 0.08, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xbd93f9 }),
    );
    backNeon.position.set(0, 3.2, -12.4);
    root.add(backNeon);

    // --- Labutlar ---
    const prof: [number, number][] = [
      [0, 0],
      [0.11, 0],
      [0.15, 0.1],
      [0.17, 0.26],
      [0.14, 0.48],
      [0.08, 0.68],
      [0.065, 0.8],
      [0.09, 0.92],
      [0.1, 1.04],
      [0.07, 1.14],
      [0, 1.17],
    ];
    const pinGeo = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      16,
    );
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xf8f8f2, roughness: 0.3 });
    const ringGeo = new THREE.TorusGeometry(0.075, 0.022, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xff5555, roughness: 0.4 });
    const pins: Pin[] = [];
    {
      let id = 0;
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i <= row; i++) {
          const mesh = new THREE.Mesh(pinGeo, pinMat);
          mesh.castShadow = true;
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.88;
          mesh.add(ring);
          const bx = (i - row / 2) * 0.72;
          const bz = PIN_Z - row * 0.62;
          mesh.position.set(bx, 0, bz);
          root.add(mesh);
          pins.push({
            id: id++,
            bx,
            bz,
            x: bx,
            z: bz,
            vx: 0,
            vz: 0,
            fallen: false,
            fall: 0,
            axis: [0, -1],
            active: true,
            mesh,
          });
        }
      }
    }

    // --- Top ---
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 28, 20),
      new THREE.MeshStandardMaterial({
        color: 0x6d3fc0,
        roughness: 0.15,
        metalness: 0.4,
        emissive: 0x2a1450,
      }),
    );
    ballMesh.castShadow = true;
    root.add(ballMesh);
    const ball = { x: 0, z: START_Z, vx: 0, vz: 0, active: false, gutter: 0 };
    const resetBall = () => {
      ball.x = 0;
      ball.z = START_Z;
      ball.vx = 0;
      ball.vz = 0;
      ball.active = false;
      ball.gutter = 0;
      ballMesh.position.set(0, BALL_R, START_Z);
    };
    resetBall();

    const aimGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.02, START_Z),
      new THREE.Vector3(0, 0.02, PIN_Z),
    ]);
    const aimLine: Line = new THREE.Line(
      aimGeo,
      new THREE.LineBasicMaterial({ color: 0xbd93f9, transparent: true, opacity: 0.9 }),
    );
    aimLine.visible = false;
    root.add(aimLine);

    // --- Durum ---
    type Mode = 'idle' | 'sim' | 'replay';
    let mode: Mode = 'idle';
    let modeTime = 0;
    let replay: LastRoll | null = null;
    let seenT: number | null = null;
    let pendingSync = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let aimTx = 0;
    let raf = 0;
    let last = performance.now();
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const q: Quaternion = new THREE.Quaternion();
    const axis3 = new THREE.Vector3();

    const resetPins = (standing: number[]) => {
      for (const p of pins) {
        p.x = p.bx;
        p.z = p.bz;
        p.vx = 0;
        p.vz = 0;
        p.fallen = false;
        p.fall = 0;
        p.active = standing.includes(p.id);
        p.mesh.visible = p.active;
        p.mesh.position.set(p.bx, 0, p.bz);
        p.mesh.quaternion.identity();
      }
    };

    const sync = () => {
      if (mode !== 'idle') {
        pendingSync = true;
        return;
      }
      pendingSync = false;
      const lr = readLastRoll(propsRef.current.session.state.lastRoll);
      const uid = propsRef.current.userId;
      if (seenT === null) {
        seenT = lr?.t ?? 0;
      } else if (lr && lr.t !== seenT) {
        seenT = lr.t;
        if (lr.by !== uid) {
          // Başkasının atışını görsel olarak oynat
          const before = pins.filter((p) => p.active).map((p) => p.id);
          if (before.length === 0) resetPins(ALL_PINS);
          replay = lr;
          mode = 'replay';
          modeTime = 0;
          ball.active = true;
          aimLine.visible = false;
          return;
        }
      }
      resetPins(lr?.standing ?? ALL_PINS);
      resetBall();
    };
    syncRef.current = sync;
    sync();

    const finishSim = () => {
      const p = propsRef.current;
      const knocked = pins.filter((pin) => pin.active && pin.fallen).map((pin) => pin.id);
      const standingBefore = pins.filter((pin) => pin.active).map((pin) => pin.id);
      const standingAfter = standingBefore.filter((id) => !knocked.includes(id));
      const uid = p.userId;
      const frames = readFrames(p.session.state.frames);
      if (!uid) {
        mode = 'idle';
        return;
      }
      const rolls = [...(frames[uid] ?? []), knocked.length];
      const parsed = parseFrames(rolls);
      const lastFrame = parsed[parsed.length - 1];
      const reset = (lastFrame?.complete ?? false) || standingAfter.length === 0;
      const roll: LastRoll = {
        by: uid,
        pins: knocked.length,
        knocked,
        standing: reset ? ALL_PINS : standingAfter,
        tx: Number(aimTx.toFixed(3)),
        t: Date.now(),
      };
      seenT = roll.t;
      const turn = Number(p.session.state.turn ?? 0);
      mode = 'idle';
      setBusy(true);
      void p
        .onPatch({ frames: { ...frames, [uid]: rolls }, turn: turn + 1, lastRoll: roll })
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
          // Devrilen labutları kısa süre göster, sonra süpür
          settleTimer = setTimeout(() => {
            settleTimer = null;
            if (mode === 'idle') {
              const lr = readLastRoll(propsRef.current.session.state.lastRoll);
              resetPins(lr?.standing ?? ALL_PINS);
              resetBall();
            }
          }, 1400);
        });
    };

    const collide = (
      ax: number,
      az: number,
      avx: number,
      avz: number,
      am: number,
      ar: number,
      b: { x: number; z: number; vx: number; vz: number },
      bm: number,
      br: number,
    ) => {
      const dx = b.x - ax;
      const dz = b.z - az;
      const dist = Math.hypot(dx, dz);
      const min = ar + br;
      if (dist >= min || dist < 1e-6) return null;
      const nx = dx / dist;
      const nz = dz / dist;
      const vrel = (avx - b.vx) * nx + (avz - b.vz) * nz;
      const push = min - dist;
      let ja = 0;
      if (vrel > 0) ja = ((1 + 0.85) * vrel) / (1 / am + 1 / bm);
      return { nx, nz, push, ja };
    };

    const simStep = (h: number) => {
      // top
      if (ball.active) {
        ball.x += ball.vx * h;
        ball.z += ball.vz * h;
        if (Math.abs(ball.x) > LANE_HALF - 0.05 && ball.gutter === 0) {
          ball.gutter = Math.sign(ball.x);
          ball.vx = 0;
        }
        if (ball.gutter !== 0) {
          const target = ball.gutter * (LANE_HALF + 0.3);
          ball.x += (target - ball.x) * Math.min(1, h * 10);
        }
        const bm = 5;
        for (const pin of pins) {
          if (!pin.active) continue;
          const c = collide(ball.x, ball.z, ball.vx, ball.vz, bm, BALL_R, pin, 1, PIN_R);
          if (c) {
            ball.vx -= (c.ja * c.nx) / bm;
            ball.vz -= (c.ja * c.nz) / bm;
            pin.vx += c.ja * c.nx;
            pin.vz += c.ja * c.nz;
            pin.x += c.nx * c.push;
            pin.z += c.nz * c.push;
          }
        }
        // top ters dönmesin
        if (ball.vz > -4 && ball.gutter === 0 && ball.z < PIN_Z + 1) ball.vz = Math.min(ball.vz, -4);
      }
      // labutlar
      for (let i = 0; i < pins.length; i++) {
        const p = pins[i]!;
        if (!p.active) continue;
        p.x += p.vx * h;
        p.z += p.vz * h;
        const sp = Math.hypot(p.vx, p.vz);
        if (sp > 0) {
          const ns = Math.max(0, sp - 3 * h);
          p.vx *= ns / sp;
          p.vz *= ns / sp;
        }
        if (p.x > 2.1) {
          p.x = 2.1;
          p.vx *= -0.4;
        } else if (p.x < -2.1) {
          p.x = -2.1;
          p.vx *= -0.4;
        }
        if (p.z < -11.6) {
          p.z = -11.6;
          p.vz *= -0.3;
        }
        if (!p.fallen && (sp > 0.7 || Math.hypot(p.x - p.bx, p.z - p.bz) > 0.32)) {
          p.fallen = true;
          const l = Math.hypot(p.vx, p.vz) || 1;
          const dx = sp > 0.05 ? p.vx / l : ball.vx / (Math.hypot(ball.vx, ball.vz) || 1);
          const dz = sp > 0.05 ? p.vz / l : ball.vz / (Math.hypot(ball.vx, ball.vz) || 1);
          p.axis = [dz, -dx];
        }
        for (let j = i + 1; j < pins.length; j++) {
          const o = pins[j]!;
          if (!o.active) continue;
          const c = collide(p.x, p.z, p.vx, p.vz, 1, PIN_R, o, 1, PIN_R);
          if (c) {
            p.vx -= (c.ja * c.nx) / 1;
            p.vz -= (c.ja * c.nz) / 1;
            o.vx += c.ja * c.nx;
            o.vz += c.ja * c.nz;
            o.x += c.nx * c.push * 0.5;
            o.z += c.nz * c.push * 0.5;
            p.x -= c.nx * c.push * 0.5;
            p.z -= c.nz * c.push * 0.5;
          }
        }
      }
    };

    const syncMeshes = (dt: number) => {
      ballMesh.position.set(ball.x, ball.gutter ? BALL_R - 0.12 : BALL_R, ball.z);
      ballMesh.rotation.x -= (ball.vz * dt) / BALL_R * -1;
      for (const p of pins) {
        if (!p.active) continue;
        p.mesh.position.set(p.x, 0, p.z);
        if (p.fallen && p.fall < 1) p.fall = Math.min(1, p.fall + dt * 3.2);
        if (p.fall > 0) {
          axis3.set(p.axis[0], 0, p.axis[1]).normalize();
          q.setFromAxisAngle(axis3, (Math.PI / 2) * 0.96 * p.fall);
          p.mesh.quaternion.copy(q);
          p.mesh.position.y = 0.1 * p.fall;
        }
      }
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const p = propsRef.current;
      const sh = nextShooter(p.session.playerIds, readFrames(p.session.state.frames));
      const my = p.canPlay && !!p.userId && sh === p.userId;

      if (mode === 'sim') {
        modeTime += dt;
        for (let i = 0; i < 8; i++) simStep(dt / 8);
        syncMeshes(dt);
        let moving = false;
        for (const pin of pins) if (pin.active && Math.hypot(pin.vx, pin.vz) > 0.08) moving = true;
        const ballDone = ball.z < PIN_Z - 3.8 || modeTime > 5;
        if (ballDone) {
          ball.vx = 0;
          ball.vz = 0;
        }
        if ((ballDone && !moving && modeTime > 1.2) || modeTime > 7) finishSim();
      } else if (mode === 'replay' && replay) {
        modeTime += dt;
        const dur = 1.1;
        const k = Math.min(1, modeTime / dur);
        ball.x = replay.tx * k * 0.9;
        ball.z = START_Z + (PIN_Z - START_Z) * k;
        ball.vz = -16;
        if (k >= 1 && !pins.some((pin) => pin.fallen)) {
          for (const pin of pins) {
            if (!pin.active || !replay.knocked.includes(pin.id)) continue;
            pin.fallen = true;
            const a = pin.id * 2.399;
            pin.vx = Math.sin(a) * 2.2;
            pin.vz = -Math.abs(Math.cos(a)) * 2.8 - 0.8;
            pin.axis = [pin.vz, -pin.vx];
          }
        }
        if (k >= 1) {
          for (const pin of pins) {
            if (!pin.active || !pin.fallen) continue;
            pin.x += pin.vx * dt;
            pin.z = Math.max(-11.6, pin.z + pin.vz * dt);
            pin.vx *= 0.94;
            pin.vz *= 0.94;
          }
        }
        syncMeshes(dt);
        if (modeTime > 2.6) {
          mode = 'idle';
          replay = null;
          const lr = readLastRoll(p.session.state.lastRoll);
          resetPins(lr?.standing ?? ALL_PINS);
          resetBall();
          if (pendingSync) sync();
        }
      } else {
        aimLine.visible = my && !busyRef.current;
        dom.style.cursor = aimLine.visible ? 'crosshair' : 'default';
        if (aimLine.visible) {
          const pos = aimGeo.attributes.position!;
          pos.setXYZ(1, aimTx, 0.02, PIN_Z);
          pos.needsUpdate = true;
          aimGeo.computeBoundingSphere();
        }
      }
    };
    loop();

    const toLane = (e: PointerEvent) => {
      const ndc = pointerNdc(e, dom);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        aimTx = Math.max(-LANE_HALF + 0.1, Math.min(LANE_HALF - 0.1, hit.x));
      }
    };
    const onMove = (e: PointerEvent) => {
      if (mode === 'idle') toLane(e);
    };
    const onDown = (e: PointerEvent) => {
      const p = propsRef.current;
      const sh = nextShooter(p.session.playerIds, readFrames(p.session.state.frames));
      if (mode !== 'idle' || busyRef.current || !p.canPlay || !p.userId || sh !== p.userId) return;
      toLane(e);
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      const lr = readLastRoll(p.session.state.lastRoll);
      resetPins(lr?.standing ?? ALL_PINS);
      resetBall();
      const noise = (Math.random() - 0.5) * 0.05;
      const dx = aimTx - 0;
      const dz = PIN_Z - START_Z;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx / len, -dz / len) + noise;
      const speed = 16;
      ball.vx = Math.sin(ang) * speed;
      ball.vz = -Math.cos(ang) * speed;
      ball.active = true;
      mode = 'sim';
      modeTime = 0;
      aimLine.visible = false;
    };
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerdown', onDown);

    return () => {
      cancelAnimationFrame(raf);
      if (settleTimer) clearTimeout(settleTimer);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerdown', onDown);
      syncRef.current = null;
      scene.remove(root);
      disposeObject(root);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busyRef = useRef(false);
  busyRef.current = busy;

  const totals = session.playerIds.map((id) => {
    const rolls = frames[id] ?? [];
    const parsed = parseFrames(rolls);
    return {
      id,
      score: scoreRolls(rolls),
      frame: Math.min(10, Math.max(1, parsed.filter((f) => f.complete).length + (finished ? 0 : 1))),
      rolls,
    };
  });
  const best = totals.reduce((a, b) => (b.score > a.score ? b : a), totals[0]);

  const statusText = finished
    ? 'Oyun bitti'
    : !canPlay
      ? 'İzleyici'
      : busy
        ? 'Atış gönderiliyor…'
        : myTurn
          ? 'Senin sıran — şeride tıkla ve yuvarla'
          : 'Rakip atıyor';

  return (
    <ThreeSceneHost className="absolute inset-0" onReady={onReady}>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
        <span className="inline-flex w-fit rounded-lg border border-[#bd93f9]/50 bg-[#11131e]/80 px-3 py-1 text-xs font-semibold text-[#f8f8f2]">
          Bowling · {statusText}
        </span>
        {lastRoll && (
          <span className="inline-flex w-fit rounded-lg bg-[#11131e]/70 px-3 py-1 text-[11px] text-[#bd93f9]">
            Son atış: {lastRoll.pins === 10 ? 'STRIKE!' : `${lastRoll.pins} labut`} ·{' '}
            {playerLabel(session, lastRoll.by, userId)}
          </span>
        )}
      </div>
      <div className="pointer-events-none absolute right-3 top-3 min-w-[170px] rounded-lg border border-[#bd93f9]/30 bg-[#11131e]/85 p-2 text-[11px] text-[#f8f8f2]">
        <p className="mb-1 font-semibold text-[#bd93f9]">Skor tablosu</p>
        {totals.map((t) => (
          <div
            key={t.id}
            className={`flex justify-between gap-3 ${t.id === shooter ? 'text-[#50fa7b]' : ''}`}
          >
            <span>
              {playerLabel(session, t.id, userId)}
              {t.id === shooter ? ' ▸' : ''}
            </span>
            <span>
              {t.score} · K{t.frame}
            </span>
          </div>
        ))}
        {finished && best && (
          <p className="mt-1 text-[#f1fa8c]">Kazanan: {playerLabel(session, best.id, userId)}</p>
        )}
      </div>
    </ThreeSceneHost>
  );
}
