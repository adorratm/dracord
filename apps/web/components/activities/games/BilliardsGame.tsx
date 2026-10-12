'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Line, Mesh, PerspectiveCamera, Texture } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import {
  disposeObject,
  isMyTurn,
  playerLabel,
  pointerNdc,
  round4,
  turnIndex,
  type GameProps,
} from '../three/sceneUtils';
import { GameAudio } from '@/lib/game-audio';

type Ball = { id: number; x: number; y: number; vx: number; vy: number; sunk?: boolean };
type GroupKind = 'solid' | 'stripe';
type GroupsMap = Record<string, GroupKind>;
type PocketedMap = Record<string, number[]>;
type Shot = { dx: number; dz: number; power: number; by: string; id: number };

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

const W = 10;
const D = 5;
const R = 0.2;
const HX = 4.8;
const HZ = 2.3;
const POCKET_R = 0.58;
/** Bant çarpışmasını kapatmak için delik ağzı yarıçapı */
const POCKET_JAW = 0.72;
const POCKETS: [number, number][] = [
  [-4.95, -2.45],
  [0, -2.5],
  [4.95, -2.45],
  [-4.95, 2.45],
  [0, 2.5],
  [4.95, 2.45],
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

function ballGroup(id: number): GroupKind | 'eight' | 'cue' {
  if (id === 0) return 'cue';
  if (id === 8) return 'eight';
  return id <= 7 ? 'solid' : 'stripe';
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

function parseGroups(raw: unknown): GroupsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: GroupsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === 'solid' || v === 'stripe') out[k] = v;
  }
  return out;
}

function parsePocketed(raw: unknown): PocketedMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PocketedMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    out[k] = v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 15);
  }
  return out;
}

function parseShot(raw: unknown): Shot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const dx = Number(o.dx);
  const dz = Number(o.dz);
  const power = Number(o.power);
  const by = typeof o.by === 'string' ? o.by : '';
  const id = Number(o.id);
  if (!by || !Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(power)) return null;
  if (!Number.isFinite(id)) return null;
  return { dx, dz, power, by, id };
}

function groupCleared(balls: Ball[], group: GroupKind): boolean {
  return balls
    .filter((b) => ballGroup(b.id) === group)
    .every((b) => b.sunk);
}

function opposite(g: GroupKind): GroupKind {
  return g === 'solid' ? 'stripe' : 'solid';
}

export function BilliardsGame(props: GameProps) {
  const { session, userId, canPlay } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const syncRef = useRef<(() => void) | null>(null);
  const applyShotRef = useRef<((shot: Shot) => void) | null>(null);
  const lastShotIdRef = useRef<number>(-1);
  const [power, setPower] = useState(0);
  const [busy, setBusy] = useState(false);

  const balls = useMemo(
    () => parseBalls(session.state.balls) ?? defaultBalls(),
    [session.state.balls],
  );
  const groups = useMemo(() => parseGroups(session.state.groups), [session.state.groups]);
  const pocketed = useMemo(() => parsePocketed(session.state.pocketed), [session.state.pocketed]);
  const cueInHand = Boolean(session.state.cueInHand);
  const winner =
    typeof session.state.winner === 'string' && session.state.winner
      ? session.state.winner
      : null;
  const myTurn = isMyTurn(props) && !winner;
  const remaining = balls.filter((b) => b.id !== 0 && !b.sunk).length;

  useEffect(() => {
    syncRef.current?.();
  }, [session.state.balls, session.state.turn, session.state.cueInHand, winner]);

  useEffect(() => {
    const shot = parseShot(session.state.shot);
    if (!shot || shot.id === lastShotIdRef.current) return;
    lastShotIdRef.current = shot.id;
    applyShotRef.current?.(shot);
  }, [session.state.shot]);

  const restart = () => {
    setBusy(true);
    void props
      .onPatch({
        balls: defaultBalls(),
        turn: 0,
        groups: {},
        pocketed: {},
        cueInHand: false,
        winner: '',
        shot: null,
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };

  const onReady = useCallback((api: ThreeSceneApi) => {
    const { THREE, scene, renderer } = api;
    const camera = api.camera as PerspectiveCamera;
    const fitCamera = () => {
      const el = api.root;
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      const aspect = w / h;
      const halfW = 5.9;
      const halfD = 3.4;
      let fov = 48;
      let elev = 9.2;
      let zOff = 5.8;
      if (aspect < 0.75) {
        fov = 62;
        elev = 12.4;
        zOff = 0.05;
      } else if (aspect < 1.05) {
        fov = 54;
        elev = 10.6;
        zOff = 3.2;
      }
      camera.fov = fov;
      camera.aspect = aspect;
      camera.position.set(0, elev, zOff);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      const vFov = (camera.fov * Math.PI) / 180;
      const dist = camera.position.length();
      const visibleH = 2 * Math.tan(vFov / 2) * dist;
      const visibleW = visibleH * aspect;
      const need = Math.max((halfD * 2) / visibleH, (halfW * 2) / visibleW);
      if (need > 0.92) {
        camera.fov = Math.min(72, camera.fov * need * 1.08);
        camera.updateProjectionMatrix();
      }
    };
    fitCamera();
    const camRo = new ResizeObserver(fitCamera);
    camRo.observe(api.root);
    GameAudio.unlock();
    const dom = renderer.domElement;

    const root = new THREE.Group();
    scene.add(root);
    const textures: Texture[] = [];

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
    const pocketGeo = new THREE.CircleGeometry(POCKET_R * 1.05, 24);
    const pocketMat = new THREE.MeshBasicMaterial({ color: 0x050508 });
    for (const [px, pz] of POCKETS) {
      const m = new THREE.Mesh(pocketGeo, pocketMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(px, 0.012, pz);
      root.add(m);
    }

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

    let simulating = false;
    let pendingSync = false;
    let snapped = false;
    let simTime = 0;
    let charging = false;
    let chargePower = 0;
    let placingCue = false;
    let aimX = 0;
    let aimZ = 0;
    let lastPower = -1;
    let raf = 0;
    let last = performance.now();
    let firstHitId: number | null = null;
    let sunkThisShot: number[] = [];
    let shotOwner: string | null = null;
    let isLocalAuthority = false;
    const CHARGE_PER_SEC = 0.85;
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

    const exportBalls = (): Ball[] => {
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
      return out;
    };

    const sync = () => {
      if (simulating) {
        pendingSync = true;
        return;
      }
      pendingSync = false;
      const stateBalls = parseBalls(propsRef.current.session.state.balls) ?? defaultBalls();
      for (const b of stateBalls) {
        const body = bodies.get(b.id);
        if (!body) continue;
        body.tx = (b.x - 0.5) * W;
        body.tz = (b.y - 0.5) * D;
        body.sunk = Boolean(b.sunk);
        if (!snapped || body.sunk || Boolean(propsRef.current.session.state.cueInHand)) {
          body.x = body.tx;
          body.z = body.tz;
          placeMesh(body);
        }
      }
      snapped = true;
    };
    syncRef.current = sync;
    sync();

    const clearCueFromPocket = () => {
      const cue = bodies.get(0)!;
      if (!cue.sunk) return;
      cue.sunk = false;
      cue.x = CUE_START.x;
      cue.z = CUE_START.z;
      for (const b of bodies.values()) {
        if (b.id === 0 || b.sunk) continue;
        if (Math.hypot(b.x - cue.x, b.z - cue.z) < 2 * R + 0.02) cue.x -= 0.5;
      }
      placeMesh(cue);
    };

    const resolveRules = (_outBalls: Ball[]) => {
      const p = propsRef.current;
      const shooterId = shotOwner ?? p.userId ?? '';
      const players = p.session.playerIds;
      const turn = Number(p.session.state.turn ?? 0);
      const prevGroups = parseGroups(p.session.state.groups);
      const prevPocketed = parsePocketed(p.session.state.pocketed);
      const cueSunk = sunkThisShot.includes(0);
      const objectSunk = sunkThisShot.filter((id) => id !== 0);
      const eightSunk = sunkThisShot.includes(8);
      const oppId = players.find((id) => id !== shooterId) ?? '';

      let foul = false;
      let win: string | null = null;
      let lose: string | null = null;
      let nextGroups = { ...prevGroups };
      let nextPocketed: PocketedMap = {
        ...prevPocketed,
        [shooterId]: [...(prevPocketed[shooterId] ?? [])],
      };
      if (oppId && !nextPocketed[oppId]) nextPocketed[oppId] = [...(prevPocketed[oppId] ?? [])];

      const beforeBalls = parseBalls(p.session.state.balls) ?? defaultBalls();

      if (firstHitId === null) foul = true;
      else if (prevGroups[shooterId]) {
        const mine = prevGroups[shooterId]!;
        const g = ballGroup(firstHitId);
        if (g === 'eight') {
          if (!groupCleared(beforeBalls, mine)) foul = true;
        } else if (g !== mine) foul = true;
      } else if (firstHitId === 8) {
        foul = true;
      }

      if (cueSunk) foul = true;

      // Grup ataması: ilk legal object ball (8 değil)
      if (!prevGroups[shooterId] && objectSunk.length > 0 && !cueSunk) {
        const firstObj = objectSunk.find((id) => id !== 8);
        if (firstObj !== undefined && firstHitId !== null && ballGroup(firstHitId) !== 'eight') {
          const g = ballGroup(firstObj);
          if (g === 'solid' || g === 'stripe') {
            nextGroups[shooterId] = g;
            if (oppId) nextGroups[oppId] = opposite(g);
          }
        }
      }

      for (const id of objectSunk) {
        if (id === 8) continue;
        const g = ballGroup(id);
        if (g !== 'solid' && g !== 'stripe') continue;
        const owner =
          nextGroups[shooterId] === g
            ? shooterId
            : nextGroups[oppId] === g
              ? oppId
              : shooterId;
        if (!nextPocketed[owner]?.includes(id)) {
          nextPocketed[owner] = [...(nextPocketed[owner] ?? []), id];
        }
      }

      const myGroup = nextGroups[shooterId];
      const myClearedBefore = myGroup ? groupCleared(beforeBalls, myGroup) : false;

      if (eightSunk) {
        if (cueSunk || foul || !myGroup || !myClearedBefore) {
          lose = shooterId;
        } else {
          win = shooterId;
        }
      }

      const legalContinue =
        !foul &&
        !eightSunk &&
        objectSunk.some((id) => {
          if (id === 8) return false;
          if (!myGroup) return true;
          return ballGroup(id) === myGroup;
        });

      let nextTurn = turn;
      if (!win && !lose) {
        if (!legalContinue) nextTurn = turn + 1;
      }

      if (lose) win = oppId || null;

      clearCueFromPocket();
      const finalBalls = exportBalls();
      // cue in pocket → cueInHand for next player
      const nextCueInHand = Boolean(cueSunk && !win);

      return {
        balls: finalBalls,
        turn: nextTurn,
        groups: nextGroups,
        pocketed: nextPocketed,
        cueInHand: nextCueInHand,
        winner: win ?? '',
        shot: null,
      };
    };

    const finishShot = () => {
      simulating = false;
      if (!isLocalAuthority) {
        clearCueFromPocket();
        exportBalls();
        if (pendingSync) sync();
        return;
      }
      const out = exportBalls();
      const patch = resolveRules(out);
      setBusy(true);
      void propsRef.current
        .onPatch(patch)
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
          if (pendingSync) sync();
        });
      isLocalAuthority = false;
      shotOwner = null;
    };

    const startShot = (shot: Shot, authority: boolean) => {
      if (simulating) return;
      const cue = bodies.get(0)!;
      if (cue.sunk) return;
      const len = Math.hypot(shot.dx, shot.dz) || 1;
      const dx = shot.dx / len;
      const dz = shot.dz / len;
      const pw = Math.min(1, Math.max(0.1, shot.power));
      const speed = 3 + pw * 10;
      cue.vx = dx * speed;
      cue.vz = dz * speed;
      simulating = true;
      simTime = 0;
      firstHitId = null;
      sunkThisShot = [];
      shotOwner = shot.by;
      isLocalAuthority = authority;
      aimLine.visible = false;
      cueMesh.visible = false;
      setPower(0);
      lastPower = 0;
      GameAudio.shoot();
    };

    applyShotRef.current = (shot: Shot) => {
      const me = propsRef.current.userId;
      startShot(shot, Boolean(me && shot.by === me));
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
        let nearPocket = false;
        for (const [px, pz] of POCKETS) {
          const pd = Math.hypot(b.x - px, b.z - pz);
          if (pd < POCKET_JAW) nearPocket = true;
          if (pd < POCKET_R) {
            b.sunk = true;
            b.vx = 0;
            b.vz = 0;
            b.x = px;
            b.z = pz;
            b.mesh.visible = false;
            if (!sunkThisShot.includes(b.id)) sunkThisShot.push(b.id);
            GameAudio.pot();
            break;
          }
        }
        if (b.sunk) continue;
        // Delik ağzında bant topu geri itmesin — deliğe tam girsin
        if (!nearPocket) {
          if (b.x > HX - R) {
            b.x = HX - R;
            if (b.vx > 0.4) GameAudio.cushion();
            b.vx = -Math.abs(b.vx) * 0.8;
          } else if (b.x < -HX + R) {
            b.x = -HX + R;
            if (b.vx < -0.4) GameAudio.cushion();
            b.vx = Math.abs(b.vx) * 0.8;
          }
          if (b.z > HZ - R) {
            b.z = HZ - R;
            if (b.vz > 0.4) GameAudio.cushion();
            b.vz = -Math.abs(b.vz) * 0.8;
          } else if (b.z < -HZ + R) {
            b.z = -HZ + R;
            if (b.vz < -0.4) GameAudio.cushion();
            b.vz = Math.abs(b.vz) * 0.8;
          }
        } else {
          // Ağızda deliğe çek; masa dışına kaçmayı sınırla
          for (const [px, pz] of POCKETS) {
            const pd = Math.hypot(b.x - px, b.z - pz);
            if (pd < POCKET_JAW && pd > 1e-4) {
              b.vx += ((px - b.x) / pd) * 12 * h;
              b.vz += ((pz - b.z) / pd) * 12 * h;
              break;
            }
          }
          if (Math.abs(b.x) > HX + 0.4) b.vx *= 0.4;
          if (Math.abs(b.z) > HZ + 0.4) b.vz *= 0.4;
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
            if (vrel > 0.8) GameAudio.collide();
            if (firstHitId === null) {
              if (a.id === 0) firstHitId = c.id;
              else if (c.id === 0) firstHitId = a.id;
            }
          }
        }
      }
    };

    const updateAim = (dt: number) => {
      const cue = bodies.get(0)!;
      const p = propsRef.current;
      const w =
        typeof p.session.state.winner === 'string' && p.session.state.winner
          ? p.session.state.winner
          : null;
      const inHand = Boolean(p.session.state.cueInHand);
      const show =
        !simulating && !w && isMyTurn(p) && !cue.sunk && !inHand;
      aimLine.visible = show;
      cueMesh.visible = show;
      dom.style.cursor = show || (inHand && isMyTurn(p) && !w) ? 'crosshair' : 'default';
      if (!show) {
        charging = false;
        chargePower = 0;
        if (lastPower !== 0) {
          lastPower = 0;
          setPower(0);
        }
        return;
      }
      if (charging) {
        chargePower = Math.min(1, chargePower + CHARGE_PER_SEC * dt);
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
      const pw = charging ? Math.max(0.08, chargePower) : 0.15;
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
      const pct = charging ? Math.round(chargePower * 100) : 0;
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
        updateAim(dt);
      }
    };
    loop();

    const toTable = (e: PointerEvent) => {
      const ndc = pointerNdc(e, dom);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        aimX = Math.max(-HX + R, Math.min(HX - R, hit.x));
        aimZ = Math.max(-HZ + R, Math.min(HZ - R, hit.z));
      }
    };

    const cuePlacementOk = (x: number, z: number) => {
      for (const b of bodies.values()) {
        if (b.id === 0 || b.sunk) continue;
        if (Math.hypot(b.x - x, b.z - z) < 2 * R + 0.02) return false;
      }
      return true;
    };

    const cancelCharge = () => {
      charging = false;
      chargePower = 0;
      lastPower = 0;
      setPower(0);
    };

    const fireShot = () => {
      const p = propsRef.current;
      if (simulating || !isMyTurn(p) || p.session.state.cueInHand || p.session.state.winner) {
        cancelCharge();
        return;
      }
      const cue = bodies.get(0)!;
      if (cue.sunk || !p.userId) {
        cancelCharge();
        return;
      }
      let dx = aimX - cue.x;
      let dz = aimZ - cue.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1e-4) {
        dx = 1;
        dz = 0;
      } else {
        dx /= dist;
        dz /= dist;
      }
      const pw = Math.min(1, Math.max(0.08, chargePower));
      charging = false;
      chargePower = 0;
      const shot: Shot = {
        dx: round4(dx),
        dz: round4(dz),
        power: round4(pw),
        by: p.userId,
        id: Date.now(),
      };
      lastShotIdRef.current = shot.id;
      startShot(shot, true);
      setBusy(true);
      void p
        .onPatch({ shot })
        .catch(() => undefined)
        .finally(() => setBusy(false));
    };

    const onMove = (e: PointerEvent) => {
      if (simulating) return;
      toTable(e);
      const p = propsRef.current;
      if (
        placingCue &&
        Boolean(p.session.state.cueInHand) &&
        isMyTurn(p) &&
        !p.session.state.winner
      ) {
        const cue = bodies.get(0)!;
        if (cuePlacementOk(aimX, aimZ)) {
          cue.x = aimX;
          cue.z = aimZ;
          cue.tx = aimX;
          cue.tz = aimZ;
          placeMesh(cue);
        }
      }
    };
    const onDown = (e: PointerEvent) => {
      if (simulating) return;
      const p = propsRef.current;
      if (p.session.state.winner) return;
      if (!isMyTurn(p)) return;
      // Sağ tık: şarj iptal
      if (e.button === 2) {
        e.preventDefault();
        cancelCharge();
        return;
      }
      if (e.button !== 0) return;
      toTable(e);
      if (Boolean(p.session.state.cueInHand)) {
        placingCue = true;
        const cue = bodies.get(0)!;
        cue.sunk = false;
        if (cuePlacementOk(aimX, aimZ)) {
          cue.x = aimX;
          cue.z = aimZ;
          cue.tx = aimX;
          cue.tz = aimZ;
          placeMesh(cue);
        }
        return;
      }
      charging = true;
      chargePower = 0.08;
      lastPower = 8;
      setPower(8);
    };
    const onUp = (e: PointerEvent) => {
      const p = propsRef.current;
      if (e.button === 2) {
        cancelCharge();
        return;
      }
      if (e.button !== 0) return;
      if (placingCue) {
        placingCue = false;
        if (!isMyTurn(p) || !p.session.state.cueInHand) return;
        toTable(e);
        const cue = bodies.get(0)!;
        if (!cuePlacementOk(aimX, aimZ)) return;
        cue.x = aimX;
        cue.z = aimZ;
        cue.tx = aimX;
        cue.tz = aimZ;
        cue.sunk = false;
        placeMesh(cue);
        const n = toNorm(cue.x, cue.z);
        const out = exportBalls().map((b) =>
          b.id === 0 ? { ...b, x: n.x, y: n.y, sunk: false } : b,
        );
        setBusy(true);
        void p
          .onPatch({ balls: out, cueInHand: false, shot: null })
          .catch(() => undefined)
          .finally(() => setBusy(false));
        return;
      }
      if (!charging) return;
      toTable(e);
      fireShot();
    };
    const onContext = (e: Event) => {
      e.preventDefault();
      cancelCharge();
    };
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    dom.addEventListener('contextmenu', onContext);

    return () => {
      cancelAnimationFrame(raf);
      camRo.disconnect();
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      dom.removeEventListener('contextmenu', onContext);
      syncRef.current = null;
      applyShotRef.current = null;
      scene.remove(root);
      disposeObject(root);
      textures.forEach((t) => t.dispose());
    };
  }, []);

  const statusText = winner
    ? `${playerLabel(session, winner, userId)} kazandı!`
    : !canPlay
      ? 'İzleyici'
      : busy
        ? 'Hamle gönderiliyor…'
        : cueInHand && myTurn
          ? 'Beyaz topu masaya yerleştir (tıkla)'
          : myTurn
            ? 'Sol tık basılı tut → güç · bırak → vur · sağ tık → iptal'
            : 'Rakip oynuyor';

  const myGroup = userId ? groups[userId] : undefined;
  const turnPlayer = session.playerIds[turnIndex(session)];

  const BallChip = ({ id }: { id: number }) => {
    const g = ballGroup(id);
    const color = BALL_COLORS[id === 0 ? 0 : id <= 8 ? id : id - 8]!;
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-[#111]"
        style={{
          background:
            g === 'stripe'
              ? `linear-gradient(#f8f8f2 0 30%, ${color} 30% 70%, #f8f8f2 70% 100%)`
              : color,
          color: id === 8 ? '#f8f8f2' : '#111',
          border: '1px solid rgba(248,248,242,0.35)',
        }}
        title={g === 'stripe' ? `Çizgili ${id}` : g === 'solid' ? `Düz ${id}` : String(id)}
      >
        {id}
      </span>
    );
  };

  return (
    <ThreeSceneHost
      className="absolute inset-0 min-h-0 touch-none overflow-hidden"
      onReady={onReady}
    >
      <div className="pointer-events-none absolute left-2 top-2 sm:left-3 sm:top-3 flex flex-col gap-1.5 pt-[env(safe-area-inset-top)] max-w-[min(100%,22rem)]">
        <span className="inline-flex w-fit max-w-full items-center rounded-lg border border-[#bd93f9]/50 bg-[#11131e]/80 px-3 py-1 text-xs font-semibold text-[#f8f8f2]">
          Bilardo · {statusText}
        </span>
        <span className="inline-flex w-fit rounded-lg bg-[#11131e]/70 px-3 py-1 text-[11px] text-[#bd93f9]">
          Masada {remaining} · {turnPlayer ? playerLabel(session, turnPlayer, userId) : '—'}
          {myGroup ? ` · Senin: ${myGroup === 'solid' ? 'Düz' : 'Çizgili'}` : ''}
          {cueInHand ? ' · Beyaz yerleştirme' : ''}
        </span>
        <div className="flex flex-col gap-1 rounded-lg border border-[#bd93f9]/30 bg-[#11131e]/85 p-2 text-[11px] text-[#f8f8f2]">
          {session.playerIds.map((pid) => {
            const g = groups[pid];
            const sunk = pocketed[pid] ?? [];
            return (
              <div key={pid} className="flex flex-wrap items-center gap-1.5">
                <span className="min-w-[4.5rem] text-[#bd93f9]">
                  {playerLabel(session, pid, userId)}
                  {g ? ` · ${g === 'solid' ? 'Düz' : 'Çizgili'}` : ''}
                </span>
                {sunk.length === 0 ? (
                  <span className="text-outline">—</span>
                ) : (
                  sunk.map((id) => <BallChip key={id} id={id} />)
                )}
              </div>
            );
          })}
        </div>
      </div>

      {winner && (
        <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl border border-[#bd93f9]/40 bg-[#11131e] px-6 py-5 text-center shadow-xl">
            <p className="mb-3 font-headline-md text-[#f8f8f2]">
              {playerLabel(session, winner, userId)} kazandı!
            </p>
            <button
              type="button"
              disabled={busy || !canPlay}
              onClick={restart}
              className="h-9 rounded-lg bg-[#50fa7b] px-4 font-label-sm text-[#11131e] disabled:opacity-50"
            >
              Yeniden başla
            </button>
          </div>
        </div>
      )}

      {myTurn && !busy && !cueInHand && !winner && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 w-[min(14rem,80vw)] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]">
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
