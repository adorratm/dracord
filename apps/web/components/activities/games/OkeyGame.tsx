'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  makeOkeyTileFace,
  makeWoodMaterial,
} from '../three/gameAssets';
import { GameAudio } from '@/lib/game-audio';
import {
  COLOR_HEX,
  COLOR_NAME,
  HAND_SIZE,
  ELIMINATION_SCORE,
  OPEN_THRESHOLD,
  TILE_COUNT,
  canOpen,
  colorOf,
  handPenalty,
  isValidMeld,
  numOf,
  okeyFromIndicator,
  packHands,
  readOkey101,
  sortHand,
  shuffle,
  type OkeyFace,
} from './okey101';

type Pick = { kind: 'hand'; index: number } | { kind: 'deck' } | { kind: 'discard' };

export function OkeyGame(props: GameProps) {
  const { session, userId, canPlay } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const syncRef = useRef<(() => void) | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const selectedRef = useRef<number[]>([]);
  selectedRef.current = selected;
  const [staged, setStaged] = useState<number[][]>([]);
  const stagedRef = useRef<number[][]>([]);
  stagedRef.current = staged;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [error, setError] = useState<string | null>(null);

  const st = readOkey101(session.state);
  const myTurn = isMyTurn(props);
  const okey = okeyFromIndicator(st.ind);
  const myHand = useMemo(
    () => (userId ? sortHand(st.hands[userId] ?? [], okey) : []),
    [userId, st.hands, okey],
  );
  const opened = Boolean(userId && st.opened[userId]);
  const phase: 'draw' | 'discard' | 'wait' =
    !myTurn || !st.dealt || st.win !== undefined
      ? 'wait'
      : myHand.length > HAND_SIZE
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

  const takeSelectedCodes = (hand: number[], idxs: number[]) => {
    const set = new Set(idxs);
    const taken: number[] = [];
    const rest: number[] = [];
    hand.forEach((c, i) => {
      if (set.has(i)) taken.push(c);
      else rest.push(c);
    });
    return { taken, rest };
  };

  const actions = {
    deal: () => {
      const p = propsRef.current;
      if (!p.canPlay || p.session.playerIds.length < 2) return;
      const order = shuffle(Array.from({ length: TILE_COUNT }, (_, i) => i));
      const indPos = order.findIndex((c) => c < 104);
      const ind = order.splice(indPos, 1)[0]!;
      const hands: Record<string, number[]> = {};
      // 101: herkese 21; ilk oyuncu 22 ile başlar (atmayla tur açılır)
      p.session.playerIds.forEach((id, i) => {
        hands[id] = order.splice(0, i === 0 ? HAND_SIZE + 1 : HAND_SIZE);
      });
      const prev = readOkey101(p.session.state);
      const melds: Record<string, number[][]> = {};
      const openedMap: Record<string, boolean> = {};
      for (const id of p.session.playerIds) {
        melds[id] = [];
        openedMap[id] = false;
      }
      setSelected([]);
      setStaged([]);
      GameAudio.deal();
      void send({
        hands: packHands(hands, order, [], ind, undefined, prev.eliminated),
        scores: prev.scores,
        melds,
        opened: openedMap,
        turn: Number(p.session.state.turn ?? 0),
      });
    },
    draw: (from: 'deck' | 'discard') => {
      const p = propsRef.current;
      const s = readOkey101(p.session.state);
      if (!p.userId || !isMyTurn(p) || s.win !== undefined) return;
      if (s.eliminated.includes(p.userId)) return;
      const hand = s.hands[p.userId] ?? [];
      if (hand.length > HAND_SIZE) return;
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
      GameAudio.tile();
      void send({
        hands: packHands(
          { ...s.hands, [p.userId]: [...hand, tile] },
          deck,
          discard,
          s.ind,
          s.win,
          s.eliminated,
        ),
        melds: s.melds,
        opened: s.opened,
        scores: s.scores,
      });
    },
    stageGroup: () => {
      const p = propsRef.current;
      const s = readOkey101(p.session.state);
      if (!p.userId || !isMyTurn(p)) return;
      const hand = sortHand(s.hands[p.userId] ?? [], okeyFromIndicator(s.ind));
      const idxs = selectedRef.current;
      if (idxs.length < 2) {
        setError('Grup için en az 2 taş seç');
        return;
      }
      const { taken } = takeSelectedCodes(hand, idxs);
      const ok = okeyFromIndicator(s.ind);
      const pairsOnly = taken.length === 2;
      if (!pairsOnly && !isValidMeld(taken, ok)) {
        setError('Seçim geçerli per/seri değil');
        return;
      }
      if (pairsOnly) {
        const [a, b] = taken;
        const same =
          a !== undefined &&
          b !== undefined &&
          ((a >= 104 && b >= 104) ||
            (colorOf(a) === colorOf(b) && numOf(a) === numOf(b)) ||
            a >= 104 ||
            b >= 104);
        if (!same && !(ok && (asJokerPair(taken, ok)))) {
          setError('Çift değil');
          return;
        }
      }
      setStaged((prev) => [...prev, taken]);
      setSelected([]);
      GameAudio.tile();
    },
    clearStaged: () => {
      setStaged([]);
      setSelected([]);
    },
    open: () => {
      const p = propsRef.current;
      const s = readOkey101(p.session.state);
      if (!p.userId || !isMyTurn(p) || s.opened[p.userId]) return;
      const ok = okeyFromIndicator(s.ind);
      const groups = stagedRef.current;
      const check = canOpen(groups, ok);
      if (!check.ok) {
        setError(check.reason ?? 'Açılamaz');
        return;
      }
      const hand = sortHand(s.hands[p.userId] ?? [], ok);
      const used = groups.flat();
      const rest = [...hand];
      for (const code of used) {
        const i = rest.indexOf(code);
        if (i < 0) {
          setError('Seçilen taşlar elde yok');
          return;
        }
        rest.splice(i, 1);
      }
      GameAudio.deal();
      setStaged([]);
      setSelected([]);
      void send({
        hands: packHands(
          { ...s.hands, [p.userId]: rest },
          s.deck,
          s.discard,
          s.ind,
          s.win,
          s.eliminated,
        ),
        melds: { ...s.melds, [p.userId]: [...(s.melds[p.userId] ?? []), ...groups] },
        opened: { ...s.opened, [p.userId]: true },
        scores: s.scores,
      });
    },
    lay: () => {
      const p = propsRef.current;
      const s = readOkey101(p.session.state);
      if (!p.userId || !isMyTurn(p) || !s.opened[p.userId]) return;
      const groups = stagedRef.current;
      if (groups.length === 0) {
        setError('Masaya koymak için grup hazırla');
        return;
      }
      const ok = okeyFromIndicator(s.ind);
      for (const g of groups) {
        if (g.length === 2 || !isValidMeld(g, ok)) {
          setError('Açıldıktan sonra yalnızca geçerli per/seri konur');
          return;
        }
      }
      const hand = sortHand(s.hands[p.userId] ?? [], ok);
      const used = groups.flat();
      const rest = [...hand];
      for (const code of used) {
        const i = rest.indexOf(code);
        if (i < 0) {
          setError('Seçilen taşlar elde yok');
          return;
        }
        rest.splice(i, 1);
      }
      GameAudio.tile();
      setStaged([]);
      setSelected([]);
      void send({
        hands: packHands(
          { ...s.hands, [p.userId]: rest },
          s.deck,
          s.discard,
          s.ind,
          s.win,
          s.eliminated,
        ),
        melds: { ...s.melds, [p.userId]: [...(s.melds[p.userId] ?? []), ...groups] },
        opened: s.opened,
        scores: s.scores,
      });
    },
    discard: () => {
      const p = propsRef.current;
      const s = readOkey101(p.session.state);
      if (!p.userId || !isMyTurn(p) || s.win !== undefined) return;
      const ok = okeyFromIndicator(s.ind);
      const hand = sortHand(s.hands[p.userId] ?? [], ok);
      const idxs = selectedRef.current;
      if (hand.length <= HAND_SIZE || idxs.length !== 1) {
        setError('Atmak için tam bir taş seç');
        return;
      }
      const idx = idxs[0]!;
      const tile = hand[idx];
      if (tile === undefined) return;
      const rest = hand.filter((_, i) => i !== idx);
      const turn = Number(p.session.state.turn ?? 0) + 1;
      setSelected([]);
      setStaged([]);

      // El bitti (açılmış ve taş kalmadı)
      if (rest.length === 0 && s.opened[p.userId]) {
        const scores = { ...s.scores };
        const eliminated = [...s.eliminated];
        for (const id of p.session.playerIds) {
          if (id === p.userId || eliminated.includes(id)) continue;
          const pen = handPenalty(s.hands[id] ?? [], ok);
          scores[id] = (scores[id] ?? 0) + pen;
          if (scores[id]! >= ELIMINATION_SCORE && !eliminated.includes(id)) {
            eliminated.push(id);
          }
        }
        const me = p.session.playerIds.indexOf(p.userId);
        GameAudio.win();
        void send({
          hands: packHands(
            { ...s.hands, [p.userId]: [] },
            s.deck,
            [...s.discard, tile],
            s.ind,
            me,
            eliminated,
          ),
          melds: s.melds,
          opened: s.opened,
          scores,
          turn,
        });
        return;
      }

      GameAudio.discard();
      void send({
        hands: packHands(
          { ...s.hands, [p.userId]: rest },
          s.deck,
          [...s.discard, tile],
          s.ind,
          s.win,
          s.eliminated,
        ),
        melds: s.melds,
        opened: s.opened,
        scores: s.scores,
        turn,
      });
    },
    pick: (pick: Pick) => {
      const p = propsRef.current;
      if (busyRef.current) return;
      if (pick.kind === 'deck') return actions.draw('deck');
      if (pick.kind === 'discard') return actions.draw('discard');
      const s = readOkey101(p.session.state);
      const hand = p.userId
        ? sortHand(s.hands[p.userId] ?? [], okeyFromIndicator(s.ind))
        : [];
      if (!p.userId || pick.index >= hand.length) return;
      GameAudio.tile();
      setSelected((prev) =>
        prev.includes(pick.index)
          ? prev.filter((i) => i !== pick.index)
          : [...prev, pick.index],
      );
    },
  };
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    setSelected([]);
    setStaged([]);
    syncRef.current?.();
  }, [session.state.hands, session.state.turn, session.state.melds, session.state.opened, session.playerIds, userId]);

  const onReady = useCallback((api: ThreeSceneApi) => {
    const { THREE, scene, renderer } = api;
    const camera = api.camera as PerspectiveCamera;
    const dom = renderer.domElement;
    const root = new THREE.Group();
    scene.add(root);
    const disposeVenue = addGameVenue(THREE, scene, root, 'okey', {
      renderer,
      playRadius: 8.5,
    });
    const assets = createAssetBag();
    GameAudio.unlock();
    const dyn = new THREE.Group();
    root.add(dyn);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(9.6, 9.9, 0.65, 64),
      makeWoodMaterial(THREE, assets, 'dark'),
    );
    top.position.y = -0.36;
    top.castShadow = true;
    top.receiveShadow = true;
    root.add(top);
    const felt = new THREE.Mesh(
      new THREE.CylinderGeometry(9.0, 9.0, 0.06, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0x1f6b3f,
        roughness: 0.9,
        sheen: 0.3,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0x2a8a50),
      }),
    );
    felt.position.y = -0.03;
    felt.receiveShadow = true;
    root.add(felt);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(9.05, 0.06, 10, 64),
      new THREE.MeshPhysicalMaterial({
        color: 0xbd93f9,
        emissive: 0xbd93f9,
        emissiveIntensity: 0.5,
        roughness: 0.35,
      }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.02;
    root.add(rim);

    const tileGeo = new THREE.BoxGeometry(0.8, 0.22, 1.1);
    const sideMat = new THREE.MeshPhysicalMaterial({
      color: 0xe9dfc6,
      roughness: 0.45,
      clearcoat: 0.2,
    });
    const textures: Texture[] = [];
    const matCache = new Map<string, Material[]>();

    const makeFace = (key: string): Material[] => {
      const cached = matCache.get(key);
      if (cached) return cached;
      const mats = makeOkeyTileFace(THREE, key, assets, sideMat);
      matCache.set(key, mats);
      return mats;
    };

    const faceKey = (code: number, face: OkeyFace | null) => {
      if (code >= 104) return 'j-0-0';
      const c = colorOf(code);
      const n = numOf(code);
      const wild = face && face.c === c && face.n === n ? 1 : 0;
      return `${c}-${n}-${wild}`;
    };

    type Tm = Mesh & { userData: { pick?: Pick; baseY?: number } };
    const pickables: Tm[] = [];
    const handMeshes: Tm[] = [];

    const clearDyn = () => {
      for (let i = dyn.children.length - 1; i >= 0; i--) dyn.remove(dyn.children[i]!);
      pickables.length = 0;
      handMeshes.length = 0;
    };

    const addTile = (
      key: string,
      x: number,
      z: number,
      rotY: number,
      scale: number,
      pick?: Pick,
    ) => {
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
      const s = readOkey101(p.session.state);
      const face = okeyFromIndicator(s.ind);
      const players = p.session.playerIds;
      const myIdx = p.userId ? players.indexOf(p.userId) : -1;
      const base = myIdx >= 0 ? myIdx : 0;
      const winnerRevealed = s.win !== undefined;

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
        const topDisc = s.discard[s.discard.length - 1];
        if (topDisc !== undefined) {
          addTile(faceKey(topDisc, face), 1.8, 0, 0.1, 1.15, { kind: 'discard' });
        }
        if (s.ind !== undefined) addTile(faceKey(s.ind, face), -4.6, 0, 0, 1);

        // Açılan meldler (masa ortası)
        let meldX = -3.2;
        for (const id of players) {
          const groups = s.melds[id] ?? [];
          for (const g of groups) {
            g.forEach((code, k) => {
              addTile(faceKey(code, face), meldX + k * 0.42, -1.6, 0, 0.55);
            });
            meldX += g.length * 0.42 + 0.35;
            if (meldX > 4.5) {
              meldX = -3.2;
            }
          }
        }
      }

      players.forEach((id, i) => {
        const rel = (i - base + players.length) % Math.max(1, players.length);
        const raw = s.hands[id] ?? [];
        const mine = id === p.userId;
        const hand = mine || winnerRevealed ? sortHand(raw, face) : raw;
        const n = hand.length;
        const spacing = mine ? Math.min(0.78, 12 / Math.max(1, n)) : 0.48;
        hand.forEach((code, k) => {
          const key = mine || winnerRevealed ? faceKey(code, face) : 'back';
          if (rel === 0 && mine) {
            const m = addTile(
              key,
              (k - (n - 1) / 2) * spacing,
              4.5,
              0,
              0.92,
              { kind: 'hand', index: k },
            );
            handMeshes.push(m);
          } else if (rel === 0) {
            addTile(key, (k - (n - 1) / 2) * 0.48, 4.7, 0, 0.55);
          } else if (rel === 2 || (players.length === 2 && rel === 1)) {
            addTile(key, (k - (n - 1) / 2) * 0.48, -4.7, Math.PI, 0.55);
          } else if (rel === 1) {
            addTile(key, 7.1, (k - (n - 1) / 2) * 0.42, -Math.PI / 2, 0.55);
          } else {
            addTile(key, -7.1, (k - (n - 1) / 2) * 0.42, Math.PI / 2, 0.55);
          }
        });
      });
    };
    syncRef.current = sync;
    sync();

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
      const asp = camera.aspect || 1.7;
      const f = Math.max(1, 1.8 / asp);
      camera.position.set(0, 11.2 * f, 10.2 * f);
      camera.lookAt(0, 0, 1.0);
      const sel = new Set(selectedRef.current);
      handMeshes.forEach((m, i) => {
        const on = sel.has(i);
        const target = (m.userData.baseY ?? 0.11) + (on ? 0.5 : m === hover ? 0.18 : 0);
        m.position.y += (target - m.position.y) * Math.min(1, dt * 16);
        const tz = on ? 4.1 : 4.5;
        m.position.z += (tz - m.position.z) * Math.min(1, dt * 16);
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
      disposeVenue();
      scene.remove(root);
      disposeObject(root);
      assets.dispose();
      tileGeo.dispose();
      sideMat.dispose();
      textures.forEach((t) => t.dispose());
    };
  }, []);

  const turnPlayer = session.playerIds[turnIndex(session)];
  const statusText = !canPlay
    ? 'İzleyici'
    : !st.dealt
      ? '101 Okey — taşları dağıt'
      : st.win !== undefined
        ? 'El bitti'
        : myTurn
          ? phase === 'draw'
            ? opened
              ? 'Çek → masaya koy / at'
              : `Çek → ${OPEN_THRESHOLD}+ ile aç veya çift aç`
            : opened
              ? 'Taş seç → at (el bitince kazan)'
              : 'Grup hazırla → Aç · sonra bir taş at'
          : `Sıra: ${turnPlayer ? labelFor(props, turnPlayer) : '—'}`;

  const stagedPts = useMemo(() => {
    if (!okey || staged.length === 0) return 0;
    const c = canOpen(staged, okey);
    return c.points;
  }, [staged, okey]);

  return (
    <div data-game-root className="absolute inset-0 min-h-0 max-w-[100vw] overflow-hidden">
    <ThreeSceneHost className="absolute inset-0 min-h-0 touch-none overflow-hidden" onReady={onReady}>
      <GameHud
        title="Okey 101"
        lockLandscape
        status={statusText}
        error={error}
        meta={
          <>
            {okey && (
              <span className="rounded-lg bg-[#11131e]/75 px-2.5 py-1">
                Okey: {COLOR_NAME[okey.c]} {okey.n} · Deste {st.deck.length}
                {opened ? ' · Açıldın' : ''}
                {staged.length > 0 ? ` · Hazır: ${stagedPts}p / ${staged.length} grup` : ''}
              </span>
            )}
          </>
        }
        players={session.playerIds.map((id, i) => ({
          id,
          label: labelFor(props, id),
          active: st.dealt && st.win === undefined && turnIndex(session) === i,
          detail: `${st.scores[id] ?? 0} ceza`,
          highlight: st.opened[id]
            ? `${st.hands[id]?.length ?? 0} taş`
            : st.eliminated.includes(id)
              ? 'Elendi'
              : `${st.hands[id]?.length ?? 0} taş`,
        }))}
        actions={
          canPlay ? (
            <>
              {(!st.dealt || st.win !== undefined) && (
                <GameHudButton
                  disabled={busy || session.playerIds.length < 2}
                  onClick={() => actions.deal()}
                >
                  {st.win !== undefined ? 'Yeni El' : 'Taşları Dağıt'}
                </GameHudButton>
              )}
              {phase === 'discard' && (
                <>
                  <GameHudButton
                    variant="secondary"
                    disabled={busy || selected.length < 2}
                    onClick={() => actions.stageGroup()}
                  >
                    Gruba ekle
                  </GameHudButton>
                  {!opened && (
                    <GameHudButton
                      variant="success"
                      disabled={busy || staged.length === 0}
                      onClick={() => actions.open()}
                    >
                      Aç (≥{OPEN_THRESHOLD})
                    </GameHudButton>
                  )}
                  {opened && (
                    <GameHudButton
                      variant="success"
                      disabled={busy || staged.length === 0}
                      onClick={() => actions.lay()}
                    >
                      Masaya koy
                    </GameHudButton>
                  )}
                  {staged.length > 0 && (
                    <GameHudButton variant="secondary" disabled={busy} onClick={() => actions.clearStaged()}>
                      Grupları sil
                    </GameHudButton>
                  )}
                  <GameHudButton
                    disabled={busy || selected.length !== 1}
                    onClick={() => actions.discard()}
                  >
                    Taşı At
                  </GameHudButton>
                </>
              )}
              {phase === 'draw' && (
                <span className="px-2 text-[11px] text-[#f8f8f2]/80">
                  Desteye veya atılan taşa dokun
                </span>
              )}
            </>
          ) : undefined
        }
      >
        {st.win !== undefined && session.playerIds[st.win] && (
          <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
            <div className="w-full max-w-sm rounded-2xl border border-[#bd93f9]/40 bg-[#11131e] px-6 py-5 text-center shadow-xl">
              <p className="mb-1 font-headline-md text-[#f8f8f2]">El bitti</p>
              <p className="mb-3 text-sm text-[#f1fa8c]">
                {labelFor(props, session.playerIds[st.win]!)} kazandı
              </p>
              <GameHudButton disabled={busy || !canPlay} onClick={() => actions.deal()} variant="success">
                Yeni El Dağıt
              </GameHudButton>
            </div>
          </div>
        )}
      </GameHud>
    </ThreeSceneHost>
    </div>
  );
}

function asJokerPair(codes: number[], okey: OkeyFace): boolean {
  return codes.some((c) => c >= 104 || (colorOf(c) === okey.c && numOf(c) === okey.n));
}
