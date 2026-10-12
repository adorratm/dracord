'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Line, Mesh, PerspectiveCamera, Texture } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import {
  disposeObject,
  isMyTurn,
  labelFor,
  pointerNdc,
  round4,
  turnIndex,
  type GameProps,
} from '../three/sceneUtils';
import { GameHud, GameHudButton } from '../three/GameHud';
import { addGameVenue } from '../three/sceneVenue';
import {
  createAssetBag,
  makeCueStick,
  makeFeltMaterial,
  makePoolBall,
  makeWoodMaterial,
} from '../three/gameAssets';
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
/** Cep — görsel + fizik; köşe/yan açıklıklar yastıklarla uyumlu */
const POCKET_R = 0.4;
const POCKET_JAW = 0.56;
const POCKETS: [number, number][] = [
  [-4.95, -2.45],
  [0, -2.52],
  [4.95, -2.45],
  [-4.95, 2.45],
  [0, 2.52],
  [4.95, 2.45],
];
/** Güç çubuğu: 0→100 doğrusal süre (ms) — kısa süre / yuvarlama atlama hissi vermesin */
const CHARGE_DURATION_MS = 2400;
const CUE_START = { x: -3, z: 0 };
/** Klasik doygun bilardo renkleri (pastel değil) */
const BALL_COLORS = [
  '#f5f0e6',
  '#e6b800',
  '#1a5fb4',
  '#c01c28',
  '#5c2d91',
  '#e85d04',
  '#2a9d4a',
  '#9b2226',
  '#141414',
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
    const disposeVenue = addGameVenue(THREE, scene, root, 'billiards', {
      renderer,
      playRadius: 7.5,
    });
    const assets = createAssetBag();
    const textures: Texture[] = [];

    const wood = makeWoodMaterial(THREE, assets, 'warm');
    const woodDark = makeWoodMaterial(THREE, assets, 'dark');
    const base = new THREE.Mesh(new THREE.BoxGeometry(11.7, 0.85, 6.7), wood);
    base.position.y = -0.48;
    base.castShadow = true;
    base.receiveShadow = true;
    root.add(base);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(12.05, 0.26, 7.05), woodDark);
    apron.position.y = -0.08;
    root.add(apron);
    for (const [lx, lz] of [
      [-5.25, -2.85],
      [5.25, -2.85],
      [-5.25, 2.85],
      [5.25, 2.85],
    ] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.9, 12), woodDark);
      leg.position.set(lx, -0.95, lz);
      leg.castShadow = true;
      root.add(leg);
    }

    // Keçe: delikli (Shape holes) — gerçek cep açıklıkları
    const feltShape = new THREE.Shape();
    feltShape.moveTo(-W / 2, -D / 2);
    feltShape.lineTo(W / 2, -D / 2);
    feltShape.lineTo(W / 2, D / 2);
    feltShape.lineTo(-W / 2, D / 2);
    feltShape.closePath();
    for (const [px, pz] of POCKETS) {
      const hole = new THREE.Path();
      hole.absarc(px, pz, POCKET_R * 0.98, 0, Math.PI * 2, true);
      feltShape.holes.push(hole);
    }
    const feltGeo = new THREE.ExtrudeGeometry(feltShape, {
      depth: 0.09,
      bevelEnabled: false,
      curveSegments: 28,
    });
    const felt = new THREE.Mesh(feltGeo, makeFeltMaterial(THREE, '#1f7a42', assets));
    felt.rotation.x = Math.PI / 2;
    felt.position.y = 0;
    felt.receiveShadow = true;
    root.add(felt);

    const cushionMat = makeFeltMaterial(THREE, '#166534', assets);
    const cush = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.26, d), cushionMat);
      m.position.set(x, 0.13, z);
      m.castShadow = true;
      root.add(m);
    };
    // Uzun kenar yastıkları — köşe + yan cep boşlukları
    const gapC = POCKET_R + 0.22;
    const gapS = POCKET_R + 0.28;
    for (const sz of [-1, 1] as const) {
      const z = sz * (HZ + 0.28);
      const len = HX - gapC - gapS;
      const cx = (HX + gapC - gapS) / 2;
      cush(len, 0.36, -cx, z);
      cush(len, 0.36, cx, z);
    }
    // Kısa kenar yastıkları — yalnızca orta segment (köşe cepleri açık)
    for (const sx of [-1, 1] as const) {
      cush(0.36, (HZ - gapC) * 2, sx * (HX + 0.28), 0);
    }
    // Cep ağızları — yastığın daireye kıvrılması (referans)
    const jawMat = cushionMat;
    for (const [px, pz] of POCKETS) {
      const isSide = Math.abs(px) < 0.2;
      const jaw = new THREE.Mesh(
        new THREE.TorusGeometry(POCKET_R * 0.92, 0.07, 10, 20, Math.PI * (isSide ? 0.55 : 0.7)),
        jawMat,
      );
      jaw.rotation.x = Math.PI / 2;
      if (isSide) {
        jaw.rotation.z = pz > 0 ? Math.PI : 0;
      } else {
        const ang = Math.atan2(pz, px);
        jaw.rotation.z = ang + Math.PI * 0.75;
      }
      jaw.position.set(px, 0.12, pz);
      root.add(jaw);
    }

    const railMat = wood;
    const rail = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), railMat);
      m.position.set(x, 0.3, z);
      m.castShadow = true;
      root.add(m);
    };
    // Ahşap bantda cep boşlukları
    for (const sz of [-1, 1] as const) {
      const z = sz * 3.08;
      const len = HX - gapC - gapS;
      const cx = (HX + gapC - gapS) / 2;
      rail(len, 0.52, -cx, z);
      rail(len, 0.52, cx, z);
    }
    for (const sx of [-1, 1] as const) {
      rail(0.52, (HZ - gapC) * 2, sx * 5.58, 0);
    }
    // Diamond nişan işaretleri (yan cep üstü boş)
    const diamondMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0d878,
      roughness: 0.35,
      metalness: 0.25,
      clearcoat: 0.4,
    });
    const diamondGeo = new THREE.SphereGeometry(0.055, 12, 10);
    for (const sz of [-1, 1] as const) {
      for (const t of [-2 / 3, -1 / 3, 1 / 3, 2 / 3]) {
        const d = new THREE.Mesh(diamondGeo, diamondMat);
        d.position.set(t * HX, 0.42, sz * 3.08);
        root.add(d);
      }
    }
    for (const sx of [-1, 1] as const) {
      for (const t of [-0.5, 0, 0.5]) {
        const d = new THREE.Mesh(diamondGeo, diamondMat);
        d.position.set(sx * 5.58, 0.42, t * HZ);
        root.add(d);
      }
    }

    // Derin siyah cep kuyuları + deri kenar
    const pocketWellMat = new THREE.MeshStandardMaterial({ color: 0x030305, roughness: 1 });
    const pocketRimMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a1a,
      roughness: 0.55,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
    const pocketLeatherMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.85 });
    for (const [px, pz] of POCKETS) {
      const well = new THREE.Mesh(
        new THREE.CylinderGeometry(POCKET_R * 0.95, POCKET_R * 1.08, 0.65, 32),
        pocketWellMat,
      );
      well.position.set(px, -0.28, pz);
      root.add(well);
      const throat = new THREE.Mesh(
        new THREE.CircleGeometry(POCKET_R * 0.95, 32),
        pocketLeatherMat,
      );
      throat.rotation.x = -Math.PI / 2;
      throat.position.set(px, -0.02, pz);
      root.add(throat);
      const rim = new THREE.Mesh(
        new THREE.RingGeometry(POCKET_R * 0.92, POCKET_R * 1.22, 32),
        pocketRimMat,
      );
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(px, 0.02, pz);
      root.add(rim);
    }

    const shadowGeo = new THREE.CircleGeometry(R * 0.95, 20);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });

    const bodies = new Map<number, Body>();
    for (let id = 0; id <= 15; id++) {
      const color = BALL_COLORS[id === 0 ? 0 : id <= 8 ? id : id - 8]!;
      const mesh = makePoolBall(THREE, id, R, color, id >= 9, assets);
      mesh.position.y = R;
      root.add(mesh);
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.01;
      root.add(shadow);
      (mesh as Mesh & { userData: { shadow?: Mesh } }).userData.shadow = shadow;
      bodies.set(id, { id, x: 0, z: 0, vx: 0, vz: 0, sunk: false, tx: 0, tz: 0, mesh });
    }

    const aimMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    });
    const aimPathMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    });
    const makeAimLine = () => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(1, 0, 0),
      ]);
      return new THREE.Line(geo, aimMat);
    };
    const aimLine: Line = makeAimLine();
    const aimObjLine: Line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
      aimPathMat,
    );
    const aimCueLine: Line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]),
      aimPathMat,
    );
    aimLine.visible = false;
    aimObjLine.visible = false;
    aimCueLine.visible = false;
    root.add(aimLine, aimObjLine, aimCueLine);
    // Ghost ball — çarpışma anındaki isteka topu konumu
    const ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(R * 0.92, R * 1.08, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ghostRing.rotation.x = -Math.PI / 2;
    ghostRing.visible = false;
    root.add(ghostRing);
    const ghostFill = new THREE.Mesh(
      new THREE.CircleGeometry(R * 0.88, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    ghostFill.rotation.x = -Math.PI / 2;
    ghostFill.visible = false;
    root.add(ghostFill);
    const CUE_LEN = 4;
    const cueMesh = makeCueStick(THREE, CUE_LEN, assets);
    cueMesh.visible = false;
    root.add(cueMesh);

    const setLine = (line: Line, x0: number, z0: number, x1: number, z1: number) => {
      const pos = line.geometry.attributes.position!;
      pos.setXYZ(0, x0, R, z0);
      pos.setXYZ(1, x1, R, z1);
      pos.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    };

    /** İlk hedef top + ghost konum + sapma yönleri */
    const predictAim = (cx: number, cz: number, dx: number, dz: number) => {
      let bestT = Infinity;
      let hit: Body | null = null;
      let gx = 0;
      let gz = 0;
      for (const b of bodies.values()) {
        if (b.id === 0 || b.sunk) continue;
        // Ray–daire: |C + D*t - B| = 2R
        const fx = cx - b.x;
        const fz = cz - b.z;
        const bDot = fx * dx + fz * dz;
        const c = fx * fx + fz * fz - 4 * R * R;
        const disc = bDot * bDot - c;
        if (disc < 0) continue;
        const t = -bDot - Math.sqrt(disc);
        if (t < 0.02 || t >= bestT) continue;
        bestT = t;
        hit = b;
        gx = cx + dx * t;
        gz = cz + dz * t;
      }
      if (!hit) {
        return {
          hit: null as Body | null,
          gx: cx + dx * 3.2,
          gz: cz + dz * 3.2,
          nx: dx,
          nz: dz,
          cueDx: dx,
          cueDz: dz,
          objDx: dx,
          objDz: dz,
        };
      }
      let nx = hit.x - gx;
      let nz = hit.z - gz;
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl;
      nz /= nl;
      // Eşit kütle: obje normal boyunca, isteka teğet bileşeni
      const vn = dx * nx + dz * nz;
      let cueDx = dx - vn * nx;
      let cueDz = dz - vn * nz;
      const cl = Math.hypot(cueDx, cueDz);
      if (cl > 1e-4) {
        cueDx /= cl;
        cueDz /= cl;
      } else {
        cueDx = -nz;
        cueDz = nx;
      }
      return {
        hit,
        gx,
        gz,
        nx,
        nz,
        cueDx,
        cueDz,
        objDx: nx,
        objDz: nz,
      };
    };

    let simulating = false;
    let pendingSync = false;
    let snapped = false;
    let simTime = 0;
    let charging = false;
    let chargePower = 0;
    let chargeStartedAt = 0;
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
      const sh = (b.mesh as Mesh & { userData: { shadow?: Mesh } }).userData.shadow;
      if (sh) {
        sh.visible = !b.sunk;
        sh.position.set(b.x + 0.04, 0.012, b.z + 0.04);
      }
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

    /** Authority sonucu / tur değişiminde anında snap — lerp kaymasını önler */
    let forceSnap = true;
    let inputLocked = false;
    let localTurnOverride: number | null = null;
    let localCueInHandOverride: boolean | null = null;
    let lastSyncedTurn = Number(propsRef.current.session.state.turn ?? 0);

    const applyBallsState = (stateBalls: Ball[], snap: boolean) => {
      for (const b of stateBalls) {
        const body = bodies.get(b.id);
        if (!body) continue;
        body.tx = (b.x - 0.5) * W;
        body.tz = (b.y - 0.5) * D;
        body.sunk = Boolean(b.sunk);
        if (snap || !snapped || body.sunk) {
          body.x = body.tx;
          body.z = body.tz;
        }
        body.vx = 0;
        body.vz = 0;
        placeMesh(body);
      }
      snapped = true;
    };

    const sync = () => {
      if (simulating) {
        pendingSync = true;
        return;
      }
      pendingSync = false;
      const st = propsRef.current.session.state;
      const turnNow = Number(st.turn ?? 0);
      const turnChanged = turnNow !== lastSyncedTurn;
      lastSyncedTurn = turnNow;
      if (localTurnOverride !== null && turnNow === localTurnOverride) {
        localTurnOverride = null;
        localCueInHandOverride = null;
        inputLocked = false;
      }
      const stateBalls = parseBalls(st.balls) ?? defaultBalls();
      const snap =
        forceSnap ||
        turnChanged ||
        Boolean(st.cueInHand) ||
        stateBalls.some((b) => b.sunk !== bodies.get(b.id)?.sunk);
      applyBallsState(stateBalls, snap);
      forceSnap = false;
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
      cue.tx = cue.x;
      cue.tz = cue.z;
      placeMesh(cue);
    };

    const canControl = () => {
      if (inputLocked || simulating) return false;
      const p = propsRef.current;
      if (!p.canPlay || !p.userId || p.session.state.winner) return false;
      const turn =
        localTurnOverride !== null
          ? localTurnOverride
          : Number(p.session.state.turn ?? 0);
      const n = Math.max(1, p.session.playerIds.length);
      const idx = p.session.playerIds.indexOf(p.userId);
      return idx >= 0 && idx === turn % n;
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
      const shooterIdx = players.indexOf(shooterId);
      // Sıra dışı vuruş sonucu yok say
      if (shooterIdx >= 0 && shooterIdx !== turn % Math.max(1, players.length)) {
        return null;
      }

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

      // İlk temas: kendi grubundan önce rakip / yanlış top → faul
      if (firstHitId === null) foul = true;
      else if (prevGroups[shooterId]) {
        const mine = prevGroups[shooterId]!;
        const g = ballGroup(firstHitId);
        if (g === 'eight') {
          if (!groupCleared(beforeBalls, mine)) foul = true;
        } else if (g !== mine) {
          foul = true; // rakip topuna veya yanlış gruba önce değdi
        }
      } else if (firstHitId === 8) {
        foul = true; // açık masada 8'e ilk vuruş faul
      }

      if (cueSunk) foul = true;

      if (!prevGroups[shooterId] && objectSunk.length > 0 && !cueSunk && !foul) {
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

      const myGroup = nextGroups[shooterId] ?? prevGroups[shooterId];
      const myClearedBefore = myGroup ? groupCleared(beforeBalls, myGroup) : false;

      // 8 erken (grup bitmeden / faul ile) → anında rakip kazanır
      if (eightSunk) {
        const legalEight = Boolean(myGroup && myClearedBefore && !foul && !cueSunk);
        if (legalEight) win = shooterId;
        else {
          lose = shooterId;
          win = oppId || null;
        }
      }

      const legalContinue =
        !foul &&
        !eightSunk &&
        !win &&
        !lose &&
        objectSunk.some((id) => {
          if (id === 8) return false;
          if (!myGroup) return true;
          return ballGroup(id) === myGroup;
        });

      let nextTurn = turn;
      if (!win && !lose && !legalContinue) nextTurn = turn + 1;

      if (cueSunk) clearCueFromPocket();
      const finalBalls = exportBalls();
      // Faul → sıra rakipte + top el (beyaz yerleştirme)
      const nextCueInHand = Boolean((foul || cueSunk) && !win);

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
        // Rakip simülasyonu sadece görsel — otorite state'ine snap
        forceSnap = true;
        sync();
        isLocalAuthority = false;
        shotOwner = null;
        return;
      }
      const out = exportBalls();
      const patch = resolveRules(out);
      isLocalAuthority = false;
      shotOwner = null;
      if (!patch) {
        forceSnap = true;
        sync();
        return;
      }
      // Optimistic: sıra / cue-in-hand / toplar hemen — çift vuruş ve kayma olmasın
      localTurnOverride = Number(patch.turn);
      localCueInHandOverride = Boolean(patch.cueInHand);
      inputLocked = true;
      forceSnap = true;
      applyBallsState(patch.balls as Ball[], true);
      setBusy(true);
      void propsRef.current
        .onPatch(patch)
        .catch(() => undefined)
        .finally(() => {
          setBusy(false);
          forceSnap = true;
          if (pendingSync) sync();
          else sync();
        });
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
      aimObjLine.visible = false;
      aimCueLine.visible = false;
      ghostRing.visible = false;
      ghostFill.visible = false;
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
          // İlk temas — vrel koşulundan bağımsız (yanlış top faul kaçmasın)
          if (firstHitId === null) {
            if (a.id === 0) firstHitId = c.id;
            else if (c.id === 0) firstHitId = a.id;
          }
          const vrel = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
          if (vrel > 0) {
            a.vx -= vrel * nx;
            a.vz -= vrel * nz;
            c.vx += vrel * nx;
            c.vz += vrel * nz;
            if (vrel > 0.8) GameAudio.collide();
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
      const inHand =
        localCueInHandOverride !== null
          ? localCueInHandOverride
          : Boolean(p.session.state.cueInHand);
      const mine = canControl();
      const show = !simulating && !w && mine && !cue.sunk && !inHand;
      aimLine.visible = show;
      cueMesh.visible = show;
      ghostRing.visible = show;
      ghostFill.visible = show;
      aimObjLine.visible = show;
      aimCueLine.visible = show;
      dom.style.cursor = show || (inHand && mine && !w) ? 'crosshair' : 'default';
      if (!show) {
        charging = false;
        chargePower = 0;
        chargeStartedAt = 0;
        if (lastPower !== 0) {
          lastPower = 0;
          setPower(0);
        }
        return;
      }
      if (charging && chargeStartedAt > 0) {
        // Doğrusal 0→1 — yuvarlama / ofset yüzünden %80→%100 atlamasın
        const t = Math.min(1, Math.max(0, (performance.now() - chargeStartedAt) / CHARGE_DURATION_MS));
        chargePower = t;
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
      const pred = predictAim(cue.x, cue.z, dx, dz);
      setLine(aimLine, cue.x, cue.z, pred.gx, pred.gz);
      ghostRing.position.set(pred.gx, R + 0.002, pred.gz);
      ghostFill.position.set(pred.gx, R + 0.001, pred.gz);
      if (pred.hit) {
        const pathLen = 1.85;
        setLine(
          aimObjLine,
          pred.hit.x,
          pred.hit.z,
          pred.hit.x + pred.objDx * pathLen,
          pred.hit.z + pred.objDz * pathLen,
        );
        setLine(
          aimCueLine,
          pred.gx,
          pred.gz,
          pred.gx + pred.cueDx * pathLen * 0.85,
          pred.gz + pred.cueDz * pathLen * 0.85,
        );
        aimObjLine.visible = true;
        aimCueLine.visible = Math.hypot(pred.cueDx, pred.cueDz) > 0.08;
      } else {
        setLine(aimObjLine, pred.gx, pred.gz, pred.gx + dx * 0.01, pred.gz + dz * 0.01);
        setLine(aimCueLine, pred.gx, pred.gz, pred.gx + dx * 0.01, pred.gz + dz * 0.01);
        aimObjLine.visible = false;
        aimCueLine.visible = false;
      }
      const pw = charging ? chargePower : 0.12;
      tmpDir.set(-dx, 0, -dz);
      const gap = 0.3 + Math.max(0.08, pw) * 0.9;
      cueMesh.position.set(
        cue.x + tmpDir.x * (gap + CUE_LEN / 2),
        R + 0.05,
        cue.z + tmpDir.z * (gap + CUE_LEN / 2),
      );
      cueMesh.quaternion.setFromUnitVectors(up, tmpDir);
      // floor: 0.795→80, 0.994→99, yalnızca tam dolunca 100 — round atlaması yok
      const pct = charging ? Math.min(100, Math.floor(chargePower * 100 + 1e-6)) : 0;
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
        // Sabit adım — istemciler arası fizik sapmasını azaltır
        const fixed = 1 / 120;
        let acc = dt;
        let steps = 0;
        while (acc > 0 && steps < 24) {
          const h = Math.min(fixed, acc);
          integrate(h);
          acc -= h;
          steps++;
        }
        for (const b of bodies.values()) if (!b.sunk) b.mesh.position.set(b.x, R, b.z);
        let moving = false;
        for (const b of bodies.values()) {
          if (!b.sunk && Math.hypot(b.vx, b.vz) > 0.06) moving = true;
        }
        if (!moving || simTime > 14) finishShot();
      } else {
        // Snap sonrası lerp yok; yalnızca küçük düzeltme (opsiyonel yumuşaklık)
        const k = forceSnap ? 1 : Math.min(1, dt * 14);
        for (const b of bodies.values()) {
          if (b.sunk) {
            placeMesh(b);
            continue;
          }
          const ox = b.x;
          const oz = b.z;
          b.x += (b.tx - b.x) * k;
          b.z += (b.tz - b.z) * k;
          if (k < 1) rollMesh(b, b.x - ox, b.z - oz);
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
      chargeStartedAt = 0;
      lastPower = 0;
      setPower(0);
    };

    const fireShot = () => {
      const p = propsRef.current;
      const inHand =
        localCueInHandOverride !== null
          ? localCueInHandOverride
          : Boolean(p.session.state.cueInHand);
      if (simulating || inputLocked || !canControl() || inHand || p.session.state.winner) {
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
      chargeStartedAt = 0;
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
      if (simulating || inputLocked) return;
      toTable(e);
      const p = propsRef.current;
      const inHand =
        localCueInHandOverride !== null
          ? localCueInHandOverride
          : Boolean(p.session.state.cueInHand);
      if (placingCue && inHand && canControl() && !p.session.state.winner) {
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
      if (simulating || inputLocked) return;
      const p = propsRef.current;
      if (p.session.state.winner) return;
      if (!canControl()) return;
      // Sağ tık: şarj iptal
      if (e.button === 2) {
        e.preventDefault();
        cancelCharge();
        return;
      }
      if (e.button !== 0) return;
      toTable(e);
      const inHand =
        localCueInHandOverride !== null
          ? localCueInHandOverride
          : Boolean(p.session.state.cueInHand);
      if (inHand) {
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
      chargeStartedAt = performance.now();
      chargePower = 0;
      lastPower = 0;
      setPower(0);
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
        const inHand =
          localCueInHandOverride !== null
            ? localCueInHandOverride
            : Boolean(p.session.state.cueInHand);
        if (!canControl() || !inHand) return;
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
      disposeVenue();
      scene.remove(root);
      disposeObject(root);
      assets.dispose();
      textures.forEach((t) => t.dispose());
    };
  }, []);

  const statusText = winner
    ? `${labelFor(props, winner)} kazandı!`
    : !canPlay
      ? 'İzleyici'
      : busy
        ? 'Hamle gönderiliyor…'
        : cueInHand && myTurn
          ? 'Beyaz topu masaya yerleştir'
          : myTurn
            ? 'Basılı tut → güç · bırak → vur'
            : 'Rakip oynuyor';

  const myGroup = userId ? groups[userId] : undefined;
  const turnPlayer = session.playerIds[turnIndex(session)];

  return (
    <ThreeSceneHost
      className="absolute inset-0 min-h-0 touch-none overflow-hidden"
      onReady={onReady}
    >
      <GameHud
        title="8-Top Bilardo"
        status={statusText}
        meta={
          <span className="rounded-lg bg-[#11131e]/75 px-2.5 py-1">
            Masada {remaining}
            {turnPlayer ? ` · Sıra: ${labelFor(props, turnPlayer)}` : ''}
            {myGroup ? ` · Senin: ${myGroup === 'solid' ? 'Düz' : 'Çizgili'}` : ''}
            {cueInHand ? ' · Top el' : ''}
          </span>
        }
        players={session.playerIds.map((pid) => {
          const g = groups[pid];
          const sunk = pocketed[pid] ?? [];
          return {
            id: pid,
            label: labelFor(props, pid),
            active: pid === turnPlayer && !winner,
            detail: g ? (g === 'solid' ? 'Düz' : 'Çizgili') : '—',
            highlight: sunk.length ? `${sunk.length} delik` : undefined,
          };
        })}
        actions={
          myTurn && !busy && !cueInHand && !winner ? (
            <div className="w-[min(14rem,70vw)]">
              <div className="mb-1 text-center text-[11px] text-[#f8f8f2]/80">Güç %{power}</div>
              <div className="h-2 overflow-hidden rounded-full bg-[#282a36]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#50fa7b] via-[#f1fa8c] to-[#ff5555]"
                  style={{ width: `${power}%` }}
                />
              </div>
            </div>
          ) : undefined
        }
      >
        {winner && (
          <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-sm rounded-2xl border border-[#bd93f9]/40 bg-[#11131e] px-6 py-5 text-center shadow-xl">
              <p className="mb-3 font-headline-md text-[#f8f8f2]">
                {labelFor(props, winner)} kazandı!
              </p>
              <GameHudButton disabled={busy || !canPlay} onClick={restart} variant="success">
                Yeniden başla
              </GameHudButton>
            </div>
          </div>
        )}
      </GameHud>
    </ThreeSceneHost>
  );
}
