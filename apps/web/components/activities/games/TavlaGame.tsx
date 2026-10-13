'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Material, Mesh, PerspectiveCamera, Texture } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import {
  disposeObject,
  isMyTurn,
  labelFor,
  pointerNdc,
  turnIndex,
  type GameProps,
} from '../three/sceneUtils';
import { GameHud, GameHudButton } from '../three/GameHud';
import { addGameVenue } from '../three/sceneVenue';
import {
  createAssetBag,
  makeChecker,
  makeFeltMaterial,
  makeWoodMaterial,
} from '../three/gameAssets';
import { GameAudio } from '@/lib/game-audio';

type Board = { points: number[]; bar: [number, number]; off: [number, number] };
type Spot = number | 'bar' | 'off';
type Move = { from: number | 'bar'; to: number | 'off'; die: number };

/**
 * Oyuncu 0 (beyaz): indeks 0 -> 23 yönünde ilerler, evi 18..23.
 * Oyuncu 1 (mor): indeks 23 -> 0 yönünde ilerler, evi 0..5. points[i] > 0 beyaz, < 0 mor.
 */
function initialBoard(): Board {
  const points = new Array<number>(24).fill(0);
  points[0] = 2;
  points[11] = 5;
  points[16] = 3;
  points[18] = 5;
  points[23] = -2;
  points[12] = -5;
  points[7] = -3;
  points[5] = -5;
  return { points, bar: [0, 0], off: [0, 0] };
}

function readBoard(raw: unknown): Board {
  if (!raw || typeof raw !== 'object') return initialBoard();
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.points) || o.points.length !== 24) return initialBoard();
  const pair = (v: unknown): [number, number] =>
    Array.isArray(v) ? [Number(v[0]) || 0, Number(v[1]) || 0] : [0, 0];
  return { points: o.points.map((n) => Number(n) || 0), bar: pair(o.bar), off: pair(o.off) };
}

function readDice(raw: unknown): number[] {
  return Array.isArray(raw)
    ? raw.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 6).slice(0, 4)
    : [];
}

function legalFor(b: Board, p: 0 | 1, die: number): Move[] {
  const dir = p === 0 ? 1 : -1;
  const sign = p === 0 ? 1 : -1;
  const own = (i: number) => (b.points[i] ?? 0) * sign;
  const moves: Move[] = [];
  if (b.bar[p] > 0) {
    const to = p === 0 ? die - 1 : 24 - die;
    if (own(to) >= -1) moves.push({ from: 'bar', to, die });
    return moves;
  }
  let allHome = true;
  for (let i = 0; i < 24; i++) {
    const inHome = p === 0 ? i >= 18 : i <= 5;
    if (!inHome && own(i) > 0) allHome = false;
  }
  for (let i = 0; i < 24; i++) {
    if (own(i) <= 0) continue;
    const t = i + dir * die;
    if (t >= 0 && t <= 23) {
      if (own(t) >= -1) moves.push({ from: i, to: t, die });
    } else if (allHome) {
      // Evden çıkış mesafesi: p0 → 24-i, p1 → i+1
      const need = p === 0 ? 24 - i : i + 1;
      if (die === need) {
        moves.push({ from: i, to: 'off', die });
      } else if (die > need) {
        // Yüksek zar: yalnızca daha uzakta (daha yüksek need) pul yoksa
        let farther = false;
        if (p === 0) {
          for (let j = 18; j < i; j++) if (own(j) > 0) farther = true;
        } else {
          for (let j = i + 1; j <= 5; j++) if (own(j) > 0) farther = true;
        }
        if (!farther) moves.push({ from: i, to: 'off', die });
      }
    }
  }
  return moves;
}

function applyMove(b: Board, p: 0 | 1, m: Move): Board {
  const sign = p === 0 ? 1 : -1;
  const next: Board = { points: [...b.points], bar: [...b.bar] as [number, number], off: [...b.off] as [number, number] };
  if (m.from === 'bar') next.bar[p] -= 1;
  else next.points[m.from] = (next.points[m.from] ?? 0) - sign;
  if (m.to === 'off') {
    next.off[p] += 1;
  } else {
    const there = (next.points[m.to] ?? 0) * sign;
    if (there === -1) {
      next.points[m.to] = 0;
      next.bar[(1 - p) as 0 | 1] += 1;
    }
    next.points[m.to] = (next.points[m.to] ?? 0) + sign;
  }
  return next;
}

function removeDie(dice: number[], die: number): number[] {
  const i = dice.indexOf(die);
  if (i < 0) return dice;
  return [...dice.slice(0, i), ...dice.slice(i + 1)];
}

/** Bu zar dizisiyle oynanabilecek maksimum zar adedi */
function maxDiceUsable(b: Board, p: 0 | 1, dice: number[]): number {
  if (dice.length === 0) return 0;
  let best = 0;
  const seen = new Set<number>();
  for (const d of dice) {
    if (seen.has(d)) continue;
    seen.add(d);
    for (const m of legalFor(b, p, d)) {
      const n = 1 + maxDiceUsable(applyMove(b, p, m), p, removeDie(dice, d));
      if (n > best) best = n;
      if (best >= dice.length) return best;
    }
  }
  return best;
}

/** Hem tek zar hamleleri hem “mümkünse tüm zarları kullan” kuralı */
function allLegal(b: Board, p: 0 | 1, dice: number[]): Move[] {
  if (dice.length === 0) return [];
  const candidates: Move[] = [];
  for (const d of new Set(dice)) candidates.push(...legalFor(b, p, d));
  if (candidates.length === 0) return [];
  const max = maxDiceUsable(b, p, dice);
  if (max <= 1) return candidates;
  return candidates.filter((m) => {
    const after = 1 + maxDiceUsable(applyMove(b, p, m), p, removeDie(dice, m.die));
    return after >= max;
  });
}

const COL_X = (c: number) => (c < 6 ? -6 + c : 1 + (c - 6));
function pointPos(i: number) {
  if (i >= 12) return { x: COL_X(i - 12), z0: 5, dz: -1 };
  return { x: COL_X(11 - i), z0: -5, dz: 1 };
}

export function TavlaGame(props: GameProps) {
  const { session, userId, canPlay } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const syncRef = useRef<(() => void) | null>(null);
  const [selected, setSelected] = useState<number | 'bar' | null>(null);
  const selectedRef = useRef<number | 'bar' | null>(null);
  selectedRef.current = selected;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [error, setError] = useState<string | null>(null);

  const board = readBoard(session.state.board);
  const dice = readDice(session.state.dice);
  const myIdx = userId ? session.playerIds.indexOf(userId) : -1;
  const me: 0 | 1 | null = myIdx === 0 ? 0 : myIdx === 1 ? 1 : null;
  const winner: 0 | 1 | null = board.off[0] >= 15 ? 0 : board.off[1] >= 15 ? 1 : null;
  const turn = Number(session.state.turn ?? 0);
  const myTurn = isMyTurn(props) && me !== null && winner === null;
  const activeColor = turnIndex(session) === 0 ? 'Beyaz' : 'Mor';
  const hasLegal = me !== null && dice.length > 0 && allLegal(board, me, dice).length > 0;

  const send = useCallback(async (patch: Record<string, unknown>) => {
    if (busyRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await propsRef.current.onPatch(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  }, []);

  const actions = {
    roll: () => {
      const p = propsRef.current;
      if (!isMyTurn(p) || busyRef.current) return;
      const b = readBoard(p.session.state.board);
      if (b.off[0] >= 15 || b.off[1] >= 15) return;
      if (readDice(p.session.state.dice).length > 0) return;
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      setSelected(null);
      GameAudio.dice();
      void send({
        board: b,
        dice: d1 === d2 ? [d1, d1, d1, d1] : [d1, d2],
      });
    },
    pass: () => {
      const p = propsRef.current;
      if (!isMyTurn(p) || !p.userId) return;
      const pl = p.session.playerIds.indexOf(p.userId);
      if (pl !== 0 && pl !== 1) return;
      const d = readDice(p.session.state.dice);
      if (d.length === 0) return;
      // Yasal hamle varken pas yok
      if (allLegal(readBoard(p.session.state.board), pl, d).length > 0) return;
      setSelected(null);
      void send({ dice: [], turn: Number(p.session.state.turn ?? 0) + 1 });
    },
    newGame: () => {
      const p = propsRef.current;
      if (!p.canPlay) return;
      setSelected(null);
      void send({ board: initialBoard(), dice: [], turn: Number(p.session.state.turn ?? 0) + 1 });
    },
    point: (spot: Spot): void => {
      const p = propsRef.current;
      if (busyRef.current || !isMyTurn(p) || !p.userId) return;
      const pl = p.session.playerIds.indexOf(p.userId);
      if (pl !== 0 && pl !== 1) return;
      const b = readBoard(p.session.state.board);
      if (b.off[0] >= 15 || b.off[1] >= 15) return;
      const d = readDice(p.session.state.dice);
      if (d.length === 0) {
        actions.roll();
        return;
      }
      const moves = allLegal(b, pl, d);
      const sel = selectedRef.current;
      if (sel !== null && spot !== 'bar') {
        const dest = moves.filter((m) => m.from === sel && m.to === spot);
        if (dest.length > 0) {
          const m = dest.sort((a, c) => a.die - c.die)[0]!;
          const hit =
            m.to !== 'off' && (b.points[m.to] ?? 0) * (pl === 0 ? 1 : -1) === -1;
          const nb = applyMove(b, pl, m);
          const remaining = removeDie(d, m.die);
          const done = nb.off[pl] >= 15;
          const more = !done && allLegal(nb, pl, remaining).length > 0;
          setSelected(null);
          if (hit) GameAudio.hit();
          else GameAudio.checker();
          if (done) GameAudio.win();
          void send(
            more
              ? { board: nb, dice: remaining }
              : { board: nb, dice: [], turn: Number(p.session.state.turn ?? 0) + 1 },
          );
          return;
        }
      }
      if (spot !== 'off' && moves.some((m) => m.from === spot)) {
        setSelected(spot);
      } else {
        setSelected(null);
      }
    },
  };
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const boardKey = JSON.stringify(session.state.board ?? null);
  const diceKey = JSON.stringify(session.state.dice ?? null);

  useEffect(() => {
    setSelected(null);
  }, [boardKey, diceKey, session.state.turn]);

  useEffect(() => {
    syncRef.current?.();
  }, [boardKey, diceKey, session.state.turn, selected, userId, canPlay, session.playerIds]);

  // Hamle yoksa otomatik pas
  useEffect(() => {
    if (!myTurn || dice.length === 0 || hasLegal || busy) return;
    const t = setTimeout(() => actionsRef.current.pass(), 1500);
    return () => clearTimeout(t);
  }, [myTurn, dice.length, hasLegal, busy, diceKey, boardKey]);

  const onReady = useCallback((api: ThreeSceneApi) => {
    const { THREE, scene, renderer } = api;
    const camera = api.camera as PerspectiveCamera;
    const dom = renderer.domElement;
    const root = new THREE.Group();
    scene.add(root);
    const disposeVenue = addGameVenue(THREE, scene, root, 'tavla', {
      renderer,
      playRadius: 9.5,
    });
    const assets = createAssetBag();
    GameAudio.unlock();
    const dyn = new THREE.Group();

    // --- Tahta ---
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(18.2, 0.55, 11.6),
      makeWoodMaterial(THREE, assets, 'dark'),
    );
    frame.position.y = -0.32;
    frame.castShadow = true;
    frame.receiveShadow = true;
    root.add(frame);
    const felt = new THREE.Mesh(
      new THREE.BoxGeometry(14.6, 0.1, 10.4),
      makeFeltMaterial(THREE, '#1c5a38', assets),
    );
    felt.position.set(0, -0.02, 0);
    felt.receiveShadow = true;
    root.add(felt);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.16, 10.4),
      makeWoodMaterial(THREE, assets, 'warm'),
    );
    bar.position.set(0, 0.02, 0);
    root.add(bar);
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.14, 10.4),
      makeWoodMaterial(THREE, assets, 'dark'),
    );
    tray.position.set(8.3, -0.03, 0);
    root.add(tray);
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: 0xbd93f9,
      emissive: 0xbd93f9,
      emissiveIntensity: 0.45,
      roughness: 0.4,
    });
    for (const [w, d, x, z] of [
      [14.8, 0.06, 0, -5.25],
      [14.8, 0.06, 0, 5.25],
      [0.06, 10.5, -7.35, 0],
      [0.06, 10.5, 7.35, 0],
    ] as const) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), rimMat);
      r.position.set(x, 0.06, z);
      root.add(r);
    }

    // --- Noktalar (üçgenler) ---
    type Pm = Mesh & { userData: { spot?: Spot } };
    const pickables: Pm[] = [];
    const hl = new Map<Spot, Mesh>();
    const triShape = new THREE.Shape();
    triShape.moveTo(-0.46, 0);
    triShape.lineTo(0.46, 0);
    triShape.lineTo(0, 4.3);
    triShape.closePath();
    const triGeo = new THREE.ShapeGeometry(triShape);
    // DoubleSide: üst sıra (i<12) Math.PI/2 ile normale aşağı bakar; FrontSide raycast kaçırır
    const triMats = [
      new THREE.MeshPhysicalMaterial({
        color: 0x6d4ac0,
        roughness: 0.55,
        clearcoat: 0.2,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshPhysicalMaterial({
        color: 0xd6c9a8,
        roughness: 0.55,
        clearcoat: 0.15,
        side: THREE.DoubleSide,
      }),
    ];
    const hlMat = new Map<string, Material>();
    const hlMaterial = (color: number, opacity: number) => {
      const key = `${color}-${opacity}`;
      let m = hlMat.get(key);
      if (!m) {
        m = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        hlMat.set(key, m);
      }
      return m;
    };
    for (let i = 0; i < 24; i++) {
      const { x, z0 } = pointPos(i);
      const tri = new THREE.Mesh(triGeo, triMats[i % 2]!) as unknown as Pm;
      tri.rotation.x = i >= 12 ? -Math.PI / 2 : Math.PI / 2;
      tri.position.set(x, 0.04, z0);
      tri.userData = { spot: i };
      root.add(tri);
      pickables.push(tri);
      const h = new THREE.Mesh(triGeo, hlMaterial(0x50fa7b, 0.5));
      h.rotation.x = tri.rotation.x;
      h.position.set(x, 0.06, z0);
      h.visible = false;
      root.add(h);
      hl.set(i, h);
    }
    const slotGeo = new THREE.PlaneGeometry(0.9, 10.4);
    const mkSlot = (spot: Spot, x: number, w: number) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, 10.4), hlMaterial(0x50fa7b, 0.35));
      s.rotation.x = -Math.PI / 2;
      s.position.set(x, 0.09, 0);
      s.visible = false;
      root.add(s);
      hl.set(spot, s);
      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(w, 10.4),
        new THREE.MeshBasicMaterial({ visible: false }),
      ) as unknown as Pm;
      hit.rotation.x = -Math.PI / 2;
      hit.position.set(x, 0.1, 0);
      hit.userData = { spot };
      root.add(hit);
      pickables.push(hit);
    };
    mkSlot('bar', 0, 0.9);
    mkSlot('off', 8.3, 1.7);
    slotGeo.dispose();
    root.add(dyn);

    // --- Pul / zar kaynakları ---
    const checkerProto = [
      makeChecker(THREE, 'white', assets),
      makeChecker(THREE, 'purple', assets),
    ];
    const diceGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    const textures: Texture[] = [];
    const diceMats = new Map<number, Material>();
    const diceMat = (v: number) => {
      let m = diceMats.get(v);
      if (m) return m;
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 64;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#f8f8f2';
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#bd93f9';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, 60, 60);
      ctx.fillStyle = '#282a36';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v === 0 ? '?' : String(v), 32, 35);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      textures.push(tex);
      m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 });
      diceMats.set(v, m);
      return m;
    };

    type DieMesh = Pm & { userData: { spin?: number } };
    let dieMeshes: DieMesh[] = [];
    let lastDiceKey = '';

    const clearDyn = () => {
      for (let i = dyn.children.length - 1; i >= 0; i--) {
        const c = dyn.children[i]!;
        dyn.remove(c);
      }
      for (let i = pickables.length - 1; i >= 0; i--) {
        if (pickables[i]!.userData.spot !== undefined && dyn.children.indexOf(pickables[i]!) >= 0) {
          pickables.splice(i, 1);
        }
      }
    };
    const dynPick: Pm[] = [];

    const sync = () => {
      clearDyn();
      for (const m of dynPick) {
        const idx = pickables.indexOf(m);
        if (idx >= 0) pickables.splice(idx, 1);
      }
      dynPick.length = 0;
      const p = propsRef.current;
      const b = readBoard(p.session.state.board);
      const d = readDice(p.session.state.dice);
      const pl = p.userId ? p.session.playerIds.indexOf(p.userId) : -1;
      const myT = isMyTurn(p) && (pl === 0 || pl === 1);

      const addChecker = (side: 0 | 1, x: number, y: number, z: number, spot: Spot) => {
        const m = checkerProto[side]!.clone() as unknown as Pm;
        m.position.set(x, y, z);
        m.castShadow = true;
        m.userData = { spot };
        dyn.add(m);
        dynPick.push(m);
        pickables.push(m);
      };

      for (let i = 0; i < 24; i++) {
        const v = b.points[i] ?? 0;
        if (v === 0) continue;
        const side: 0 | 1 = v > 0 ? 0 : 1;
        const { x, z0, dz } = pointPos(i);
        for (let k = 0; k < Math.abs(v); k++) {
          addChecker(side, x, 0.16 + Math.floor(k / 5) * 0.17, z0 + dz * (0.5 + (k % 5) * 0.86), i);
        }
      }
      for (let k = 0; k < b.bar[0]; k++) addChecker(0, 0, 0.18 + 0.0 * k, 0.8 + k * 0.9, 'bar');
      for (let k = 0; k < b.bar[1]; k++) addChecker(1, 0, 0.18, -0.8 - k * 0.9, 'bar');
      for (let k = 0; k < b.off[0]; k++) addChecker(0, 8.3, 0.1 + k * 0.17, 4.2, 'off');
      for (let k = 0; k < b.off[1]; k++) addChecker(1, 8.3, 0.1 + k * 0.17, -4.2, 'off');

      // Zarlar
      dieMeshes = [];
      const values = d.length > 0 ? d : [0, 0];
      const key = d.join(',');
      const spinStart = key !== lastDiceKey ? 0.8 : 0;
      lastDiceKey = key;
      values.forEach((v, i) => {
        const m = new THREE.Mesh(diceGeo, diceMat(v)) as unknown as DieMesh;
        m.position.set(2.6 + (i - (values.length - 1) / 2) * 1.2 + 1.5, 0.5, 0);
        m.rotation.set(0, 0.35 * (i + 1), 0);
        m.userData = { spot: undefined, spin: spinStart };
        m.castShadow = true;
        dyn.add(m);
        dieMeshes.push(m);
      });

      // Vurgular
      for (const h of hl.values()) h.visible = false;
      if (myT && d.length > 0 && (pl === 0 || pl === 1)) {
        const moves = allLegal(b, pl, d);
        const sel = selectedRef.current;
        if (sel === null) {
          for (const m of moves) {
            const h = hl.get(m.from);
            if (h) {
              h.material = hlMaterial(0x8be9fd, 0.4);
              h.visible = true;
            }
          }
        } else {
          const hs = hl.get(sel);
          if (hs) {
            hs.material = hlMaterial(0xbd93f9, 0.6);
            hs.visible = true;
          }
          for (const m of moves) {
            if (m.from !== sel) continue;
            const h = hl.get(m.to);
            if (h) {
              h.material = hlMaterial(0x50fa7b, 0.55);
              h.visible = true;
            }
          }
        }
      }
    };
    syncRef.current = sync;
    sync();

    // --- Etkileşim ---
    const raycaster = new THREE.Raycaster();
    let downX = 0;
    let downY = 0;
    const pickAt = (e: PointerEvent): Spot | 'dice' | null => {
      const ndc = pointerNdc(e, dom);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const dieHit = raycaster.intersectObjects(dieMeshes, false);
      if (dieHit.length > 0) return 'dice';
      const hits = raycaster.intersectObjects(pickables, false);
      const first = hits.find((h) => (h.object as Pm).userData.spot !== undefined);
      return first ? ((first.object as Pm).userData.spot ?? null) : null;
    };
    const onMove = (e: PointerEvent) => {
      dom.style.cursor = pickAt(e) !== null ? 'pointer' : 'default';
    };
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const hit = pickAt(e);
      if (hit === 'dice') actionsRef.current.roll();
      else if (hit !== null) actionsRef.current.point(hit);
    };
    dom.addEventListener('pointermove', onMove);
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointerup', onUp);

    let raf = 0;
    let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const asp = camera.aspect || 1.7;
      const f = Math.max(1, 1.9 / asp);
      camera.position.set(0.8, 13.5 * f, 9.5 * f);
      camera.lookAt(0.8, 0, 0.4);
      for (const m of dieMeshes) {
        const s = m.userData.spin ?? 0;
        if (s > 0) {
          m.rotation.x += dt * 14;
          m.rotation.y += dt * 11;
          m.userData.spin = Math.max(0, s - dt);
          if (m.userData.spin === 0) m.rotation.set(0, 0.35, 0);
        }
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointerup', onUp);
      syncRef.current = null;
      clearDyn();
      disposeVenue();
      scene.remove(root);
      disposeObject(root);
      assets.dispose();
      triGeo.dispose();
      triMats.forEach((m) => m.dispose());
      diceGeo.dispose();
      diceMats.forEach((m) => m.dispose());
      hlMat.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    };
  }, []);

  const p0 = session.playerIds[0];
  const p1 = session.playerIds[1];
  const name0 = p0 ? labelFor(props, p0) : 'Beyaz';
  const name1 = p1 ? labelFor(props, p1) : 'Mor';
  const winnerName =
    winner === null ? null : winner === 0 ? `${name0} (Beyaz)` : `${name1} (Mor)`;

  const statusText =
    winnerName !== null
      ? `${winnerName} kazandı!`
      : !canPlay || me === null
        ? `İzleyici · Sıra: ${activeColor === 'Beyaz' ? name0 : name1}`
        : busy
          ? 'Hamle gönderiliyor…'
          : myTurn
            ? dice.length === 0
              ? 'Senin sıran — zar at'
              : hasLegal
                ? 'Pul seç → hedefe tıkla'
                : 'Hamle yok — sıra geç'
            : `Rakip: ${activeColor === 'Beyaz' ? name0 : name1}`;

  return (
    <ThreeSceneHost className="absolute inset-0 min-h-0 touch-none overflow-hidden" onReady={onReady}>
      <GameHud
        title="Tavla"
        status={statusText}
        error={error}
        meta={
          <span className="rounded-lg bg-[#11131e]/75 px-2.5 py-1">
            {me === null ? 'İzleyici' : me === 0 ? `Sen: ${name0} · Beyaz` : `Sen: ${name1} · Mor`}
            {' · '}Zarlar: {dice.length > 0 ? dice.join(' · ') : '—'}
          </span>
        }
        players={[
          {
            id: p0 ?? '0',
            label: `${name0} · Beyaz`,
            active: winner === null && turnIndex(session) === 0,
            detail: `${board.off[0]}/15`,
            highlight: board.bar[0] ? `bar ${board.bar[0]}` : undefined,
          },
          {
            id: p1 ?? '1',
            label: `${name1} · Mor`,
            active: winner === null && turnIndex(session) === 1,
            detail: `${board.off[1]}/15`,
            highlight: board.bar[1] ? `bar ${board.bar[1]}` : undefined,
          },
        ]}
        actions={
          canPlay && me !== null ? (
            <>
              {myTurn && dice.length === 0 && (
                <GameHudButton disabled={busy} onClick={() => actions.roll()}>
                  Zar At
                </GameHudButton>
              )}
              {myTurn && dice.length > 0 && !hasLegal && (
                <GameHudButton variant="secondary" disabled={busy} onClick={() => actions.pass()}>
                  Sırayı Geç
                </GameHudButton>
              )}
              {winner !== null && (
                <GameHudButton variant="success" disabled={busy} onClick={() => actions.newGame()}>
                  Yeni Oyun
                </GameHudButton>
              )}
            </>
          ) : undefined
        }
      />
    </ThreeSceneHost>
  );
}
