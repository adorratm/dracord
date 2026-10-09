'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Material, Mesh, PerspectiveCamera, Texture } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import {
  disposeObject,
  isMyTurn,
  playerLabel,
  pointerNdc,
  turnIndex,
  type GameProps,
} from '../three/sceneUtils';

/**
 * Taş kodu: 0..103 = (set*52 + renk*13 + (sayı-1)), 104/105 = sahte okey.
 * hands: { [userId]: number[], _deck, _discard, _ind (gösterge), _win ([oyuncu idx]) }
 */
const TILE_COUNT = 106;
const COLOR_HEX = ['#d4a017', '#2563eb', '#1f2937', '#dc2626'];
const COLOR_NAME = ['Sarı', 'Mavi', 'Siyah', 'Kırmızı'];

const colorOf = (code: number) => Math.floor((code % 52) / 13);
const numOf = (code: number) => (code % 13) + 1;

type Okey = { c: number; n: number };
type NT = { c: number; n: number };

function okeyFromIndicator(ind: number | undefined): Okey | null {
  if (ind === undefined || ind >= 104) return null;
  return { c: colorOf(ind), n: (numOf(ind) % 13) + 1 };
}

function sortKey(code: number) {
  return code >= 104 ? 1000 + code : colorOf(code) * 13 + numOf(code);
}
function sortHand(codes: number[]) {
  return [...codes].sort((a, b) => sortKey(a) - sortKey(b) || a - b);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 14 taşın tamamı geçerli per/seri mi (okey = joker) */
function solve(tiles: NT[], wild: number): boolean {
  if (tiles.length === 0) return wild === 0 || wild >= 3;
  const t = tiles[0]!;
  const rest = tiles.slice(1);

  // Per: aynı sayı, farklı renk
  const seen = new Set<number>([t.c]);
  const cand: number[] = [];
  rest.forEach((x, i) => {
    if (x.n === t.n && !seen.has(x.c)) {
      seen.add(x.c);
      cand.push(i);
    }
  });
  for (let mask = 0; mask < 1 << cand.length; mask++) {
    const idxs = cand.filter((_, k) => (mask & (1 << k)) !== 0);
    for (const total of [3, 4]) {
      const w = total - 1 - idxs.length;
      if (w < 0 || w > wild) continue;
      if (
        solve(
          rest.filter((_, i) => !idxs.includes(i)),
          wild - w,
        )
      )
        return true;
    }
  }

  // Seri: aynı renk, ardışık sayı (başa j joker eklenebilir)
  for (let j = 0; j <= Math.min(wild, t.n - 1); j++) {
    let used = j;
    let remain = rest;
    let end = t.n;
    let len = j + 1;
    for (;;) {
      if (len >= 3 && solve(remain, wild - used)) return true;
      const nextN = end + 1;
      if (nextN > 13) break;
      const k = remain.findIndex((x) => x.c === t.c && x.n === nextN);
      if (k >= 0) remain = remain.filter((_, i) => i !== k);
      else if (used < wild) used++;
      else break;
      end = nextN;
      len++;
    }
  }
  return false;
}

function isWinningHand(codes: number[], ind: number | undefined): boolean {
  const okey = okeyFromIndicator(ind);
  if (!okey || codes.length !== 14) return false;
  let wild = 0;
  const tiles: NT[] = [];
  for (const code of codes) {
    if (code >= 104) tiles.push({ c: okey.c, n: okey.n });
    else if (colorOf(code) === okey.c && numOf(code) === okey.n) wild++;
    else tiles.push({ c: colorOf(code), n: numOf(code) });
  }
  tiles.sort((a, b) => a.c - b.c || a.n - b.n);
  return solve(tiles, wild);
}

type OkeyState = {
  hands: Record<string, number[]>;
  deck: number[];
  discard: number[];
  ind: number | undefined;
  win: number | undefined;
  scores: Record<string, number>;
  dealt: boolean;
};

function readState(state: Record<string, unknown>): OkeyState {
  const hands: Record<string, number[]> = {};
  const raw = state.hands;
  const ints = (v: unknown) =>
    Array.isArray(v)
      ? v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < TILE_COUNT)
      : [];
  let deck: number[] = [];
  let discard: number[] = [];
  let ind: number | undefined;
  let win: number | undefined;
  let dealt = false;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (k === '_deck') deck = ints(v);
      else if (k === '_discard') discard = ints(v);
      else if (k === '_ind') ind = ints(v)[0];
      else if (k === '_win') win = Array.isArray(v) ? Number(v[0]) : undefined;
      else hands[k] = ints(v);
    }
    dealt = ind !== undefined;
  }
  const scores: Record<string, number> = {};
  if (state.scores && typeof state.scores === 'object' && !Array.isArray(state.scores)) {
    for (const [k, v] of Object.entries(state.scores as Record<string, unknown>)) {
      scores[k] = Number(v) || 0;
    }
  }
  return { hands, deck, discard, ind, win, scores, dealt };
}

function packHands(
  hands: Record<string, number[]>,
  deck: number[],
  discard: number[],
  ind: number | undefined,
  win?: number,
) {
  const out: Record<string, number[]> = { ...hands, _deck: deck, _discard: discard };
  if (ind !== undefined) out._ind = [ind];
  if (win !== undefined) out._win = [win];
  return out;
}

type Pick = { kind: 'hand'; index: number } | { kind: 'deck' } | { kind: 'discard' };

export function OkeyGame(props: GameProps) {
  const { session, userId, canPlay } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const syncRef = useRef<(() => void) | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  selectedRef.current = selected;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [error, setError] = useState<string | null>(null);

  const st = readState(session.state);
  const myTurn = isMyTurn(props);
  const myHand = userId ? (st.hands[userId] ?? []) : [];
  const okey = okeyFromIndicator(st.ind);
  const phase: 'draw' | 'discard' | 'wait' =
    !myTurn || !st.dealt || st.win !== undefined
      ? 'wait'
      : myHand.length >= 15
        ? 'discard'
        : 'draw';

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
    deal: () => {
      const p = propsRef.current;
      if (!p.canPlay || p.session.playerIds.length < 2) return;
      const order = shuffle(Array.from({ length: TILE_COUNT }, (_, i) => i));
      const indPos = order.findIndex((c) => c < 104);
      const ind = order.splice(indPos, 1)[0]!;
      const hands: Record<string, number[]> = {};
      p.session.playerIds.forEach((id, i) => {
        hands[id] = order.splice(0, i === 0 ? 15 : 14);
      });
      const scores = readState(p.session.state).scores;
      void send({ hands: packHands(hands, order, [], ind), scores, turn: Number(p.session.state.turn ?? 0) + 1 });
    },
    draw: (from: 'deck' | 'discard') => {
      const p = propsRef.current;
      const s = readState(p.session.state);
      if (!p.userId || !isMyTurn(p) || s.win !== undefined) return;
      const hand = s.hands[p.userId] ?? [];
      if (hand.length >= 15) return;
      let tile: number | undefined;
      let deck = s.deck;
      let discard = s.discard;
      if (from === 'deck') {
        deck = [...s.deck];
        tile = deck.pop();
      } else {
        discard = [...s.discard];
        tile = discard.pop();
      }
      if (tile === undefined) {
        setError(from === 'deck' ? 'Deste bitti' : 'Atılan taş yok');
        return;
      }
      void send({
        hands: packHands({ ...s.hands, [p.userId]: [...hand, tile] }, deck, discard, s.ind),
      });
    },
    discard: (declare: boolean) => {
      const p = propsRef.current;
      const s = readState(p.session.state);
      if (!p.userId || !isMyTurn(p) || s.win !== undefined) return;
      const hand = sortHand(s.hands[p.userId] ?? []);
      const idx = selectedRef.current;
      if (hand.length < 15 || idx === null || hand[idx] === undefined) return;
      const tile = hand[idx]!;
      const rest = hand.filter((_, i) => i !== idx);
      const turn = Number(p.session.state.turn ?? 0) + 1;
      if (declare) {
        if (!isWinningHand(rest, s.ind)) {
          setError('El henüz bitmiyor — per/seri düzenini kontrol et');
          return;
        }
        const me = p.session.playerIds.indexOf(p.userId);
        const scores = { ...s.scores, [p.userId]: (s.scores[p.userId] ?? 0) + 1 };
        setSelected(null);
        void send({
          hands: packHands({ ...s.hands, [p.userId]: rest }, s.deck, [...s.discard, tile], s.ind, me),
          scores,
          turn,
        });
        return;
      }
      setSelected(null);
      void send({
        hands: packHands({ ...s.hands, [p.userId]: rest }, s.deck, [...s.discard, tile], s.ind),
        turn,
      });
    },
    pick: (pick: Pick) => {
      const p = propsRef.current;
      if (busyRef.current) return;
      if (pick.kind === 'deck') return actions.draw('deck');
      if (pick.kind === 'discard') return actions.draw('discard');
      const s = readState(p.session.state);
      const hand = p.userId ? (s.hands[p.userId] ?? []) : [];
      if (!p.userId || pick.index >= hand.length) return;
      if (selectedRef.current === pick.index && hand.length >= 15 && isMyTurn(p)) {
        actions.discard(false);
      } else {
        setSelected(pick.index);
      }
    },
  };
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    setSelected(null);
    syncRef.current?.();
  }, [session.state.hands, session.state.turn, session.playerIds, userId]);

  const onReady = useCallback((api: ThreeSceneApi) => {
    const { THREE, scene, renderer } = api;
    const camera = api.camera as PerspectiveCamera;
    const dom = renderer.domElement;
    const root = new THREE.Group();
    scene.add(root);
    const dyn = new THREE.Group();
    root.add(dyn);

    // --- Masa ---
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(9.6, 9.9, 0.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x3b2a4f, roughness: 0.55 }),
    );
    top.position.y = -0.34;
    root.add(top);
    const felt = new THREE.Mesh(
      new THREE.CylinderGeometry(9.0, 9.0, 0.06, 48),
      new THREE.MeshStandardMaterial({ color: 0x1f6b3f, roughness: 0.95 }),
    );
    felt.position.y = -0.03;
    root.add(felt);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(9.05, 0.05, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xbd93f9 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.02;
    root.add(rim);

    // --- Taş kaynakları ---
    const tileGeo = new THREE.BoxGeometry(0.8, 0.22, 1.1);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xe9dfc6, roughness: 0.5 });
    const textures: Texture[] = [];
    const matCache = new Map<string, Material[]>();

    const makeFace = (key: string): Material[] => {
      const cached = matCache.get(key);
      if (cached) return cached;
      const cv = document.createElement('canvas');
      cv.width = 128;
      cv.height = 176;
      const ctx = cv.getContext('2d')!;
      if (key === 'back') {
        ctx.fillStyle = '#44307a';
        ctx.fillRect(0, 0, 128, 176);
        ctx.strokeStyle = '#bd93f9';
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, 108, 156);
        ctx.fillStyle = '#bd93f9';
        ctx.font = 'bold 54px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♛', 64, 90);
      } else {
        const [cs, ns, ws] = key.split('-');
        const wild = ws === '1';
        ctx.fillStyle = '#f3ecd6';
        ctx.fillRect(0, 0, 128, 176);
        if (wild) {
          ctx.strokeStyle = '#bd93f9';
          ctx.lineWidth = 8;
          ctx.strokeRect(5, 5, 118, 166);
        }
        if (cs === 'j') {
          ctx.fillStyle = '#7c3aed';
          ctx.font = 'bold 80px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', 64, 88);
        } else {
          const c = Number(cs);
          ctx.fillStyle = COLOR_HEX[c]!;
          ctx.font = 'bold 84px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ns!, 64, 74);
          ctx.beginPath();
          ctx.arc(64, 138, 14, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      textures.push(tex);
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
      const mats = [sideMat, sideMat, face, sideMat, sideMat, sideMat];
      matCache.set(key, mats);
      return mats;
    };

    const faceKey = (code: number, okey: Okey | null) => {
      if (code >= 104) return 'j-0-0';
      const c = colorOf(code);
      const n = numOf(code);
      const wild = okey && okey.c === c && okey.n === n ? 1 : 0;
      return `${c}-${n}-${wild}`;
    };

    type Tm = Mesh & { userData: { pick?: Pick; lift?: number; hover?: boolean; baseY?: number } };
    const pickables: Tm[] = [];
    const handMeshes: Tm[] = [];

    const clearDyn = () => {
      for (let i = dyn.children.length - 1; i >= 0; i--) dyn.remove(dyn.children[i]!);
      pickables.length = 0;
      handMeshes.length = 0;
    };
    const dynDisposables: Material[] = [];

    const addTile = (key: string, x: number, z: number, rotY: number, scale: number, pick?: Pick) => {
      const m = new THREE.Mesh(tileGeo, makeFace(key)) as unknown as Tm;
      m.position.set(x, 0.11, z);
      m.rotation.y = rotY;
      m.scale.setScalar(scale);
      m.castShadow = true;
      m.userData = { pick, baseY: 0.11 };
      dyn.add(m);
      if (pick) pickables.push(m);
      return m;
    };

    const sync = () => {
      clearDyn();
      const p = propsRef.current;
      const s = readState(p.session.state);
      const okey = okeyFromIndicator(s.ind);
      const players = p.session.playerIds;
      const myIdx = p.userId ? players.indexOf(p.userId) : -1;
      const base = myIdx >= 0 ? myIdx : 0;
      const winnerRevealed = s.win !== undefined;

      // Deste
      if (s.dealt) {
        const h = 0.2 + Math.min(s.deck.length, 60) * 0.03;
        const deckMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.0, h, 1.3),
          makeFace('back').map((m, i) => (i === 2 ? m : sideMat)),
        ) as unknown as Tm;
        deckMesh.position.set(-1.8, h / 2, 0);
        deckMesh.userData = { pick: { kind: 'deck' } };
        dyn.add(deckMesh);
        pickables.push(deckMesh);
        // Atılan taş yığını (en üst)
        const topDisc = s.discard[s.discard.length - 1];
        if (topDisc !== undefined) {
          addTile(faceKey(topDisc, okey), 1.8, 0, 0.1, 1.15, { kind: 'discard' });
        } else {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.45, 0.55, 24),
            new THREE.MeshBasicMaterial({ color: 0xbd93f9, side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(1.8, 0.02, 0);
          dyn.add(ring);
          dynDisposables.push(ring.material as Material);
        }
        // Gösterge
        if (s.ind !== undefined) addTile(faceKey(s.ind, okey), -4.6, 0, 0, 1, undefined);
        dyn.updateMatrixWorld();
      }

      // Oyuncu elleri
      players.forEach((id, i) => {
        const rel = (i - base + players.length) % Math.max(1, players.length);
        const raw = s.hands[id] ?? [];
        const mine = id === p.userId;
        const hand = mine || winnerRevealed ? sortHand(raw) : raw;
        const n = hand.length;
        hand.forEach((code, k) => {
          const key = mine || winnerRevealed ? faceKey(code, okey) : 'back';
          if (rel === 0 && mine) {
            const m = addTile(key, (k - (n - 1) / 2) * 0.9, 4.4, 0, 1, { kind: 'hand', index: k });
            handMeshes.push(m);
          } else if (rel === 0) {
            addTile(key, (k - (n - 1) / 2) * 0.62, 4.6, 0, 0.72);
          } else if (rel === 2 || (players.length === 2 && rel === 1)) {
            addTile(key, (k - (n - 1) / 2) * 0.62, -4.7, Math.PI, 0.72);
          } else if (rel === 1) {
            addTile(key, 7.1, (k - (n - 1) / 2) * 0.55, -Math.PI / 2, 0.72);
          } else {
            addTile(key, -7.1, (k - (n - 1) / 2) * 0.55, Math.PI / 2, 0.72);
          }
        });
      });
    };
    syncRef.current = sync;
    sync();

    // --- Etkileşim ---
    const raycaster = new THREE.Raycaster();
    let hover: Tm | null = null;
    let downX = 0;
    let downY = 0;
    const pickAt = (e: PointerEvent): Tm | null => {
      const ndc = pointerNdc(e, dom);
      raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
      const hits = raycaster.intersectObjects(pickables, false);
      return (hits[0]?.object as Tm | undefined) ?? null;
    };
    const onMove = (e: PointerEvent) => {
      hover = pickAt(e);
      dom.style.cursor = hover ? 'pointer' : 'default';
    };
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const m = pickAt(e);
      const pick = m?.userData.pick;
      if (pick) actionsRef.current.pick(pick);
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
      const asp = (camera as PerspectiveCamera).aspect || 1.7;
      const f = Math.max(1, 1.8 / asp);
      camera.position.set(0, 10.8 * f, 9.8 * f);
      camera.lookAt(0, 0, 1.2);
      const sel = selectedRef.current;
      handMeshes.forEach((m, i) => {
        const target = (m.userData.baseY ?? 0.11) + (sel === i ? 0.55 : m === hover ? 0.2 : 0);
        m.position.y += (target - m.position.y) * Math.min(1, dt * 14);
        const tz = sel === i ? 4.0 : 4.4;
        m.position.z += (tz - m.position.z) * Math.min(1, dt * 14);
      });
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointerup', onUp);
      syncRef.current = null;
      clearDyn();
      scene.remove(root);
      disposeObject(root);
      tileGeo.dispose();
      sideMat.dispose();
      matCache.forEach((mats) => mats.forEach((m) => m.dispose()));
      dynDisposables.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    };
  }, []);

  const selectedTile =
    selected !== null ? sortHand(myHand)[selected] : undefined;

  const statusText = !canPlay
    ? 'İzleyici'
    : !st.dealt
      ? 'Taşlar dağıtılmadı'
      : st.win !== undefined
        ? 'El bitti'
        : myTurn
          ? phase === 'draw'
            ? 'Senin sıran — desteden veya yığından taş çek'
            : 'Senin sıran — bir taş seç ve at'
          : `Sıra: ${playerLabel(session, session.playerIds[turnIndex(session)] ?? '', userId)}`;

  return (
    <ThreeSceneHost className="absolute inset-0" onReady={onReady}>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1">
        <span className="inline-flex w-fit rounded-lg border border-[#bd93f9]/50 bg-[#11131e]/80 px-3 py-1 text-xs font-semibold text-[#f8f8f2]">
          Okey · {statusText}
        </span>
        {okey && (
          <span className="inline-flex w-fit rounded-lg bg-[#11131e]/70 px-3 py-1 text-[11px] text-[#bd93f9]">
            Okey taşı: {COLOR_NAME[okey.c]} {okey.n} · Deste: {st.deck.length}
          </span>
        )}
        {error && (
          <span className="inline-flex w-fit rounded-lg bg-[#ff5555]/20 px-3 py-1 text-[11px] text-[#ff5555]">
            {error}
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute right-3 top-3 min-w-[150px] rounded-lg border border-[#bd93f9]/30 bg-[#11131e]/85 p-2 text-[11px] text-[#f8f8f2]">
        <p className="mb-1 font-semibold text-[#bd93f9]">Skorlar</p>
        {session.playerIds.map((id, i) => (
          <div
            key={id}
            className={`flex justify-between gap-3 ${st.dealt && st.win === undefined && turnIndex(session) === i ? 'text-[#50fa7b]' : ''}`}
          >
            <span>{playerLabel(session, id, userId)}</span>
            <span>
              {st.scores[id] ?? 0} · {st.hands[id]?.length ?? 0} taş
            </span>
          </div>
        ))}
        {st.win !== undefined && session.playerIds[st.win] && (
          <p className="mt-1 text-[#f1fa8c]">
            Eli kazanan: {playerLabel(session, session.playerIds[st.win]!, userId)}
          </p>
        )}
      </div>

      {canPlay && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2">
          {(!st.dealt || st.win !== undefined) && (
            <button
              type="button"
              disabled={busy || session.playerIds.length < 2}
              onClick={() => actions.deal()}
              className="rounded-lg bg-[#bd93f9] px-4 py-1.5 text-xs font-semibold text-[#11131e] disabled:opacity-50"
            >
              {st.win !== undefined ? 'Yeni El Dağıt' : 'Taşları Dağıt'}
            </button>
          )}
          {phase === 'discard' && (
            <>
              <button
                type="button"
                disabled={busy || selectedTile === undefined}
                onClick={() => actions.discard(false)}
                className="rounded-lg bg-[#44307a] px-4 py-1.5 text-xs font-semibold text-[#f8f8f2] disabled:opacity-50"
              >
                Taşı At
              </button>
              <button
                type="button"
                disabled={busy || selectedTile === undefined}
                onClick={() => actions.discard(true)}
                className="rounded-lg bg-[#50fa7b] px-4 py-1.5 text-xs font-semibold text-[#11131e] disabled:opacity-50"
              >
                Eli Bitir
              </button>
            </>
          )}
          {phase === 'draw' && (
            <span className="rounded-lg bg-[#11131e]/80 px-3 py-1 text-[11px] text-[#f8f8f2]/80">
              Orta destesine veya atılan taşa tıkla
            </span>
          )}
        </div>
      )}
    </ThreeSceneHost>
  );
}
