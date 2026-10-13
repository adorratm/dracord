'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Group, Line, Object3D, PerspectiveCamera, Quaternion } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import {
  disposeObject,
  labelFor,
  pointerNdc,
  type GameProps,
} from '../three/sceneUtils';
import { GameHud, GameHudButton } from '../three/GameHud';
import { addGameVenue } from '../three/sceneVenue';
import {
  createAssetBag,
  makeBowlingBall,
  makeBowlingPin,
  makeWoodMaterial,
} from '../three/gameAssets';
import { GameAudio } from '@/lib/game-audio';

type FrameState = { rolls: number[]; complete: boolean };

type LastRoll = {
  by: string;
  pins: number;
  knocked: number[];
  /** Atış sonrası ayakta kalan (veya frame bitince ALL_PINS) */
  standing: number[];
  /** Atış öncesi ayakta — rakip replay için */
  standingBefore: number[];
  /** Hedef x (labut hattı) */
  tx: number;
  /** Atış yönü — replay ile aynı yörünge */
  vx: number;
  vz: number;
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
  const knocked = arr(o.knocked);
  const standing = Array.isArray(o.standing) ? arr(o.standing) : ALL_PINS;
  let standingBefore = Array.isArray(o.standingBefore) ? arr(o.standingBefore) : null;
  if (!standingBefore) {
    if (knocked.length === 0) standingBefore = standing.length ? standing : ALL_PINS;
    else if (standing.length === 10) standingBefore = ALL_PINS;
    else standingBefore = [...new Set([...knocked, ...standing])].sort((a, b) => a - b);
  }
  const tx = Number(o.tx ?? 0);
  const vx = Number(o.vx);
  const vz = Number(o.vz);
  return {
    by: String(o.by ?? ''),
    pins: Number(o.pins ?? 0),
    knocked,
    standing,
    standingBefore: standingBefore.length ? standingBefore : ALL_PINS,
    tx,
    vx: Number.isFinite(vx) ? vx : tx * 0.55,
    vz: Number.isFinite(vz) && vz < 0 ? vz : -16,
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
  mesh: Object3D;
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
    const disposeVenue = addGameVenue(THREE, scene, root, 'bowling', {
      renderer,
      playRadius: 4,
    });
    const assets = createAssetBag();
    GameAudio.unlock();

    // --- Hat ---
    const laneMat = makeWoodMaterial(THREE, assets, 'warm');
    laneMat.roughness = 0.32;
    laneMat.clearcoat = 0.45;
    const lane = new THREE.Mesh(new THREE.BoxGeometry(LANE_HALF * 2, 0.2, 24), laneMat);
    lane.position.set(0, -0.1, -1);
    lane.receiveShadow = true;
    lane.castShadow = true;
    root.add(lane);
    // Approach halı (oyuncu tarafı)
    const approach = new THREE.Mesh(
      new THREE.BoxGeometry(LANE_HALF * 2 + 2.4, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2438, roughness: 0.92 }),
    );
    approach.position.set(0, -0.14, 10.2);
    approach.receiveShadow = true;
    root.add(approach);
    const gutterMat = new THREE.MeshPhysicalMaterial({
      color: 0x1b1d2b,
      roughness: 0.55,
      metalness: 0.35,
    });
    for (const sx of [-1, 1]) {
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 24), gutterMat);
      g.position.set(sx * (LANE_HALF + 0.3), -0.2, -1);
      root.add(g);
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.05, 24),
        new THREE.MeshPhysicalMaterial({
          color: 0xbd93f9,
          emissive: 0xbd93f9,
          emissiveIntensity: 0.65,
          roughness: 0.35,
        }),
      );
      rail.position.set(sx * (LANE_HALF + 0.62), 0.02, -1);
      root.add(rail);
    }
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0x3b2a2a, roughness: 0.8 });
    const arrowGeo = new THREE.ConeGeometry(0.1, 0.35, 3);
    for (let i = -2; i <= 2; i++) {
      const a = new THREE.Mesh(arrowGeo, arrowMat);
      a.rotation.x = -Math.PI / 2;
      a.position.set(i * 0.55, 0.006, 3 - Math.abs(i) * 0.6);
      root.add(a);
    }
    const foul = new THREE.Mesh(
      new THREE.BoxGeometry(LANE_HALF * 2, 0.01, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xff5555, emissive: 0xff2222, emissiveIntensity: 0.4 }),
    );
    foul.position.set(0, 0.006, START_Z + 0.7);
    root.add(foul);
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4, 0.3),
      new THREE.MeshPhysicalMaterial({ color: 0x1c1f33, roughness: 0.7, metalness: 0.15 }),
    );
    back.position.set(0, 1.8, -12.6);
    root.add(back);
    const backNeon = new THREE.Mesh(
      new THREE.BoxGeometry(7.4, 0.08, 0.05),
      new THREE.MeshPhysicalMaterial({
        color: 0xff79c6,
        emissive: 0xff79c6,
        emissiveIntensity: 0.55,
      }),
    );
    backNeon.position.set(0, 3.2, -12.4);
    root.add(backNeon);

    // --- Pinsetter makinesi (karşı uç) ---
    const pinsetter = new THREE.Group();
    pinsetter.position.set(0, 0, PIN_Z - 0.35);
    root.add(pinsetter);
    const metalMat = new THREE.MeshPhysicalMaterial({
      color: 0x4a5168,
      roughness: 0.35,
      metalness: 0.75,
    });
    const darkMetal = new THREE.MeshPhysicalMaterial({
      color: 0x2a2e3c,
      roughness: 0.45,
      metalness: 0.65,
    });
    const housing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 1.8), darkMetal);
    housing.position.set(0, 2.55, -1.1);
    pinsetter.add(housing);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 2.0), metalMat);
    hood.position.set(0, 3.4, -1.0);
    pinsetter.add(hood);
    for (const sx of [-1, 1] as const) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.8, 0.14), metalMat);
      post.position.set(sx * 2.0, 1.6, -0.4);
      pinsetter.add(post);
    }
    // Taşıyıcı (labutları indiren kollar)
    const carriage = new THREE.Group();
    carriage.position.set(0, 2.35, 0.15);
    pinsetter.add(carriage);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.2), metalMat);
    carriage.add(bar);
    {
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i <= row; i++) {
          const gx = (i - row / 2) * 0.72;
          const gz = -row * 0.62;
          const arm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8),
            metalMat,
          );
          arm.position.set(gx, -0.35, gz);
          carriage.add(arm);
          const claw = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.08, 0.16),
            new THREE.MeshPhysicalMaterial({
              color: 0xbd93f9,
              emissive: 0xbd93f9,
              emissiveIntensity: 0.25,
              roughness: 0.4,
              metalness: 0.4,
            }),
          );
          claw.position.set(gx, -0.62, gz);
          carriage.add(claw);
        }
      }
    }
    // Süpürücü çubuk
    const sweeper = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.08, 0.18), metalMat);
    sweeper.position.set(0, 0.12, 1.4);
    pinsetter.add(sweeper);
    const lightBar = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.06, 0.06),
      new THREE.MeshPhysicalMaterial({
        color: 0x8be9fd,
        emissive: 0x8be9fd,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      }),
    );
    lightBar.position.set(0, 3.15, -0.15);
    pinsetter.add(lightBar);

    // --- Labutlar ---
    const pins: Pin[] = [];
    {
      let id = 0;
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i <= row; i++) {
          const mesh = makeBowlingPin(THREE, assets);
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
    const ballMesh: Group = makeBowlingBall(THREE, BALL_R, assets);
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
    type Mode = 'idle' | 'sim' | 'replay' | 'pinset';
    let mode: Mode = 'idle';
    let modeTime = 0;
    let replay: LastRoll | null = null;
    let pinsetStanding: number[] = ALL_PINS;
    let seenT: number | null = null;
    let pendingSync = false;
    /** Patch geldikten sonra labutları hemen dizme — settle + pinsetter bekleniyor */
    let pinsetQueued = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    /** Yerel atış sonucu — React props gecikince rollback olmasın */
    let localResult: LastRoll | null = null;
    let aimTx = 0;
    let aimVx = 0;
    let aimVz = -16;
    let raf = 0;
    let last = performance.now();
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const q: Quaternion = new THREE.Quaternion();
    const axis3 = new THREE.Vector3();
    const carriageY0 = 2.35;
    const sweeperZ0 = 1.4;

    const applyPinsImmediate = (standing: number[]) => {
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
      carriage.position.y = carriageY0;
      sweeper.position.z = sweeperZ0;
    };

    const resetPins = (standing: number[], animate = false) => {
      if (animate && mode !== 'pinset') {
        pinsetQueued = false;
        pinsetStanding = standing;
        mode = 'pinset';
        modeTime = 0;
        // Animasyon başında: yerleştirilecekler gizlensin, düşenler süpürülsün
        for (const p of pins) {
          if (p.fallen) continue;
          if (standing.includes(p.id) && !p.fallen) {
            // Ayakta kalanlar (spare) yerinde kalsın
            p.mesh.visible = true;
          }
        }
        return;
      }
      applyPinsImmediate(standing);
    };

    const sync = () => {
      const lr = readLastRoll(propsRef.current.session.state.lastRoll);
      const uid = propsRef.current.userId;
      // Yerel sim / pinsetter sırasında otorite state'i ezme
      if (mode === 'pinset' || mode === 'sim' || mode === 'replay') {
        if (lr && (seenT === null || lr.t !== seenT) && lr.by === uid) {
          seenT = lr.t;
          localResult = lr;
        }
        pendingSync = true;
        return;
      }
      if (pinsetQueued) {
        if (lr && lr.t !== seenT && lr.by === uid) {
          seenT = lr.t;
          localResult = lr;
        }
        return;
      }
      pendingSync = false;
      if (seenT === null) {
        seenT = lr?.t ?? 0;
      } else if (lr && lr.t !== seenT) {
        seenT = lr.t;
        if (lr.by !== uid) {
          // Rakip atışı: sadece otorite lastRoll ile replay (yerel fizik yok)
          resetPins(lr.standingBefore.length ? lr.standingBefore : ALL_PINS);
          resetBall();
          ball.active = true;
          ball.vx = lr.vx;
          ball.vz = lr.vz;
          replay = lr;
          mode = 'replay';
          modeTime = 0;
          aimLine.visible = false;
          return;
        }
        localResult = lr;
      }
      const stand = localResult?.standing ?? lr?.standing ?? ALL_PINS;
      resetPins(stand);
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
        standingBefore,
        tx: Number(aimTx.toFixed(3)),
        vx: Number(aimVx.toFixed(3)),
        vz: Number(aimVz.toFixed(3)),
        t: Date.now(),
      };
      seenT = roll.t;
      localResult = roll;
      const turn = Number(p.session.state.turn ?? 0);
      mode = 'idle';
      pinsetQueued = true; // sync labutları hemen dizmesin
      if (knocked.length >= 10 || (reset && knocked.length >= standingBefore.length)) {
        GameAudio.strike();
      } else if (knocked.length > 0) {
        GameAudio.pin();
      }
      setBusy(true);
      void p
        .onPatch({ frames: { ...frames, [uid]: rolls }, turn: turn + 1, lastRoll: roll })
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
          if (settleTimer) clearTimeout(settleTimer);
          // Yerel roll kullan — props gecikince eski standing'e rollback olmasın
          const settled = localResult;
          settleTimer = setTimeout(() => {
            settleTimer = null;
            if (mode === 'sim' || mode === 'replay') return;
            pinsetQueued = false;
            resetPins(settled?.standing ?? ALL_PINS, true);
            resetBall();
          }, 1200);
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
          GameAudio.gutter();
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
            if (c.ja > 0.4) GameAudio.pin();
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
        const dur = 1.15;
        const k = Math.min(1, modeTime / dur);
        // Otorite hedefi (tx) + hız — çizgiyle aynı yörünge
        ball.x = replay.tx * k;
        ball.z = START_Z + (PIN_Z - START_Z) * k;
        ball.vx = replay.vx;
        ball.vz = replay.vz;
        if (k >= 0.92 && !pins.some((pin) => pin.fallen)) {
          for (const pin of pins) {
            if (!pin.active || !replay.knocked.includes(pin.id)) continue;
            pin.fallen = true;
            const a = pin.id * 2.399;
            pin.vx = Math.sin(a) * 2.2 + replay.vx * 0.08;
            pin.vz = -Math.abs(Math.cos(a)) * 2.8 - 0.8;
            pin.axis = [pin.vz, -pin.vx];
          }
        }
        if (k >= 0.92) {
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
          const stand = replay.standing;
          mode = 'idle';
          replay = null;
          resetPins(stand, true);
          resetBall();
          if (pendingSync) sync();
        }
      } else if (mode === 'pinset') {
        modeTime += dt;
        const t = modeTime;
        // 0–0.7s: süpürücü ileri
        if (t < 0.7) {
          const k = t / 0.7;
          sweeper.position.z = sweeperZ0 - k * 2.2;
          for (const pin of pins) {
            if (pin.fallen || !pinsetStanding.includes(pin.id)) {
              pin.mesh.visible = pin.active;
              pin.z = Math.max(PIN_Z - 2.5, pin.z - dt * 4);
              pin.mesh.position.set(pin.x, 0.05, pin.z);
            }
          }
        } else if (t < 0.95) {
          sweeper.position.z = sweeperZ0 - 2.2;
          for (const pin of pins) {
            if (pin.fallen || !pinsetStanding.includes(pin.id)) pin.mesh.visible = false;
          }
        } else if (t < 1.85) {
          // Taşıyıcı iner, ayakta labutlar görünür
          sweeper.position.z = sweeperZ0 - 2.2 + ((t - 0.95) / 0.9) * 2.2;
          const k = (t - 0.95) / 0.9;
          carriage.position.y = carriageY0 - k * 1.55;
          for (const pin of pins) {
            const on = pinsetStanding.includes(pin.id);
            pin.active = on;
            pin.fallen = false;
            pin.fall = 0;
            pin.x = pin.bx;
            pin.z = pin.bz;
            pin.vx = 0;
            pin.vz = 0;
            pin.mesh.quaternion.identity();
            if (on) {
              pin.mesh.visible = true;
              // Labutlar taşıyıcıyla iner
              const y = Math.max(0, 1.2 * (1 - k));
              pin.mesh.position.set(pin.bx, y, pin.bz);
            } else {
              pin.mesh.visible = false;
            }
          }
        } else if (t < 2.6) {
          const k = (t - 1.85) / 0.75;
          carriage.position.y = carriageY0 - 1.55 + k * 1.55;
          sweeper.position.z = sweeperZ0;
          applyPinsImmediate(pinsetStanding);
        } else {
          applyPinsImmediate(pinsetStanding);
          mode = 'idle';
          if (pendingSync) sync();
        }
        aimLine.visible = false;
      } else {
        aimLine.visible = my && !busyRef.current && !pinsetQueued;
        dom.style.cursor = aimLine.visible ? 'crosshair' : 'default';
        if (aimLine.visible) {
          const pos = aimGeo.attributes.position!;
          // Çizgi top merkezinden labut hattındaki hedefe
          pos.setXYZ(0, ball.x, 0.02, START_Z);
          pos.setXYZ(1, aimTx, 0.02, PIN_Z);
          pos.needsUpdate = true;
          aimGeo.computeBoundingSphere();
        }
      }
    };
    loop();

    /** Mouse → top merkezinden geçen doğrultu; labut hattında aimTx */
    const toLane = (e: PointerEvent) => {
      const ndc = pointerNdc(e, dom);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return;
      const bx = ball.x;
      const bz = START_Z;
      let dx = hit.x - bx;
      let dz = hit.z - bz;
      // Kameraya çok yakın / geri tıklama: sadece yatay hedef
      if (dz > -0.35) {
        aimTx = Math.max(-LANE_HALF + 0.12, Math.min(LANE_HALF - 0.12, hit.x));
        dx = aimTx - bx;
        dz = PIN_Z - bz;
      } else {
        const scale = (PIN_Z - bz) / dz;
        aimTx = bx + dx * scale;
        aimTx = Math.max(-LANE_HALF + 0.12, Math.min(LANE_HALF - 0.12, aimTx));
        dx = aimTx - bx;
        dz = PIN_Z - bz;
      }
      const len = Math.hypot(dx, dz) || 1;
      const speed = 16;
      aimVx = (dx / len) * speed;
      aimVz = (dz / len) * speed;
    };
    const onMove = (e: PointerEvent) => {
      if (mode === 'idle' && !pinsetQueued) toLane(e);
    };
    const onDown = (e: PointerEvent) => {
      const p = propsRef.current;
      const sh = nextShooter(p.session.playerIds, readFrames(p.session.state.frames));
      if (mode !== 'idle' || pinsetQueued || busyRef.current || !p.canPlay || !p.userId || sh !== p.userId)
        return;
      toLane(e);
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      const stand =
        localResult?.standing ??
        readLastRoll(p.session.state.lastRoll)?.standing ??
        ALL_PINS;
      resetPins(stand);
      resetBall();
      ball.vx = aimVx;
      ball.vz = aimVz;
      ball.active = true;
      mode = 'sim';
      modeTime = 0;
      aimLine.visible = false;
      GameAudio.bowl();
    };
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerdown', onDown);

    return () => {
      cancelAnimationFrame(raf);
      if (settleTimer) clearTimeout(settleTimer);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerdown', onDown);
      syncRef.current = null;
      disposeVenue();
      scene.remove(root);
      disposeObject(root);
      assets.dispose();
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
    <ThreeSceneHost className="absolute inset-0 min-h-0 touch-none overflow-hidden" onReady={onReady}>
      <GameHud
        title="Bowling"
        status={statusText}
        meta={
          lastRoll ? (
            <span className="rounded-lg bg-[#11131e]/75 px-2.5 py-1">
              Son: {lastRoll.pins === 10 ? 'STRIKE!' : `${lastRoll.pins} labut`} ·{' '}
              {labelFor(props, lastRoll.by)}
            </span>
          ) : undefined
        }
        players={totals.map((t) => ({
          id: t.id,
          label: labelFor(props, t.id),
          active: t.id === shooter && !finished,
          detail: `K${t.frame}`,
          highlight: String(t.score),
        }))}
      >
        {finished && (
          <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-sm rounded-2xl border border-[#bd93f9]/40 bg-[#11131e] px-6 py-5 text-center shadow-xl">
              <p className="mb-1 font-headline-md text-[#f8f8f2]">Oyun bitti</p>
              {best && (
                <p className="mb-3 text-sm text-[#f1fa8c]">
                  Kazanan: {labelFor(props, best.id)} ({best.score})
                </p>
              )}
              <GameHudButton
                disabled={busy || !canPlay}
                variant="success"
                onClick={() => {
                  setBusy(true);
                  const empty: Record<string, number[]> = {};
                  for (const id of session.playerIds) empty[id] = [];
                  void props
                    .onPatch({ frames: empty, turn: 0, lastRoll: null })
                    .catch(() => undefined)
                    .finally(() => setBusy(false));
                }}
              >
                Yeniden başla
              </GameHudButton>
            </div>
          </div>
        )}
      </GameHud>
    </ThreeSceneHost>
  );
}
