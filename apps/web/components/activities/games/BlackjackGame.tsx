'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Mesh, PerspectiveCamera } from 'three';
import { ThreeSceneHost, type ThreeSceneApi } from '../three/ThreeSceneHost';
import type { GameProps } from '../three/sceneUtils';
import { disposeObject, labelFor } from '../three/sceneUtils';
import { GameHud, GameHudButton } from '../three/GameHud';
import { GameSoundControls } from '../three/GameSoundControls';
import { addGameVenue } from '../three/sceneVenue';
import {
  createAssetBag,
  makeDealerWoman,
  makeFeltMaterial,
  makePlayingCard,
  makeWoodMaterial,
  type DealerRig,
} from '../three/gameAssets';
import {
  createDealerWomanFromVrm,
  DEALER_VRM_POS,
} from '../three/dealer/createDealerWoman';
import { GameAudio } from '@/lib/game-audio';
import {
  onDealerSpeakingChange,
  speakDealer,
  warmDealerVoices,
} from '@/lib/dealer-voice';
import { dealerLine } from '@/lib/dealer-lines';

type Phase = 'idle' | 'dealing' | 'play' | 'dealer' | 'result';
type SeatStatus = 'idle' | 'playing' | 'stand' | 'bust' | 'blackjack' | 'done';

type Seat = {
  cards: number[];
  status: SeatStatus;
  bet: number;
  result?: 'win' | 'lose' | 'push' | 'blackjack';
};

type BjState = {
  phase: Phase;
  deck: number[];
  dealer: number[];
  holeHidden: boolean;
  seats: Record<string, Seat>;
  turn: string | null;
  round: number;
  bank: Record<string, number>;
  pendingBets: Record<string, number>;
  /** Tur sonu otomatik devam (ms epoch) */
  resultUntil: number | null;
};

const START_BANK = 1000;
const BET_OPTIONS = [10, 25, 50, 100, 250] as const;
const DEFAULT_BET = 25;
const RESULT_MS = 5000;

type CardAnim = {
  mesh: Mesh;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  t: number;
  dur: number;
};

/** Oyuncu koltukları — yarım daire (kurpiyer -Z) */
const SEAT_POS: [number, number][] = [
  [-2.65, 1.55],
  [-0.95, 2.15],
  [0.95, 2.15],
  [2.65, 1.55],
];
/** Kurpiyer kartları — kameraya biraz daha yakın, felt üzerinde okunur */
const DEALER_CARD_Z = -1.28;
const DEAL_ORIGIN = { x: 0.35, y: 1.55, z: -2.2 };

/** Masa: yakın kenar aşağıda, kurpiyer belden yukarı + kartlar net */
const CAM_Y = 5.15;
const CAM_Z = 6.15;
const LOOK_Y = 0.1;
const LOOK_Z = -1.25;

function handValue(cards: number[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = c % 13;
    if (r === 0) {
      aces += 1;
      total += 11;
    } else if (r >= 10) total += 10;
    else total += r + 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

function shuffle(): number[] {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = d[i]!;
    d[i] = d[j]!;
    d[j] = t;
  }
  return d;
}

function draw(deck: number[], n: number): { cards: number[]; deck: number[] } {
  return { cards: deck.slice(0, n), deck: deck.slice(n) };
}

function emptySeat(bet = 0): Seat {
  return { cards: [], status: 'idle', bet };
}

function parseBank(raw: unknown, playerIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  for (const pid of playerIds) {
    const n = Number(src[pid]);
    out[pid] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : START_BANK;
  }
  return out;
}

function parseBets(raw: unknown, playerIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  for (const pid of playerIds) {
    const n = Number(src[pid]);
    out[pid] = Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_BET;
  }
  return out;
}

function parseState(raw: Record<string, unknown>, playerIds: string[]): BjState {
  const phase = (['idle', 'dealing', 'play', 'dealer', 'result'] as const).includes(
    raw.phase as Phase,
  )
    ? (raw.phase as Phase)
    : 'idle';
  const deck = Array.isArray(raw.deck) ? raw.deck.map(Number).filter((n) => n >= 0 && n < 52) : [];
  const dealer = Array.isArray(raw.dealer)
    ? raw.dealer.map(Number).filter((n) => n >= 0 && n < 52)
    : [];
  const holeHidden = Boolean(raw.holeHidden ?? true);
  const turn = typeof raw.turn === 'string' ? raw.turn : null;
  const round = Number(raw.round ?? 0) || 0;
  const resultUntil =
    typeof raw.resultUntil === 'number' && Number.isFinite(raw.resultUntil)
      ? raw.resultUntil
      : null;
  const bank = parseBank(raw.bank, playerIds);
  const pendingBets = parseBets(raw.pendingBets, playerIds);
  const seatsRaw =
    raw.seats && typeof raw.seats === 'object' && !Array.isArray(raw.seats)
      ? (raw.seats as Record<string, unknown>)
      : {};
  const seats: Record<string, Seat> = {};
  for (const pid of playerIds) {
    const s = seatsRaw[pid];
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      const o = s as Record<string, unknown>;
      const cards = Array.isArray(o.cards)
        ? o.cards.map(Number).filter((n) => n >= 0 && n < 52)
        : [];
      const status = (o.status as SeatStatus) || 'idle';
      const result = o.result as Seat['result'];
      const bet = Math.max(0, Math.floor(Number(o.bet) || 0));
      seats[pid] = { cards, status, bet, ...(result ? { result } : {}) };
    } else {
      seats[pid] = emptySeat(pendingBets[pid] ?? DEFAULT_BET);
    }
  }
  return { phase, deck, dealer, holeHidden, seats, turn, round, bank, pendingBets, resultUntil };
}

function nextPlayer(playerIds: string[], seats: Record<string, Seat>, after: string | null) {
  const start = after ? playerIds.indexOf(after) + 1 : 0;
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[(start + i) % playerIds.length]!;
    if (seats[id]?.status === 'playing') return id;
  }
  return null;
}

function settle(
  dealerCards: number[],
  seats: Record<string, Seat>,
  bank: Record<string, number>,
): { seats: Record<string, Seat>; bank: Record<string, number> } {
  const d = handValue(dealerCards).total;
  const dealerBust = d > 21;
  const nextSeats = { ...seats };
  const nextBank = { ...bank };
  for (const [pid, seat] of Object.entries(seats)) {
    const bet = Math.max(0, seat.bet || 0);
    if (seat.status === 'blackjack') {
      const dealerBj = dealerCards.length === 2 && d === 21;
      const result: Seat['result'] = dealerBj ? 'push' : 'blackjack';
      nextSeats[pid] = { ...seat, status: 'done', result };
      if (result === 'blackjack') nextBank[pid] = (nextBank[pid] ?? 0) + bet + Math.floor(bet * 1.5);
      else nextBank[pid] = (nextBank[pid] ?? 0) + bet;
      continue;
    }
    if (seat.status === 'bust') {
      nextSeats[pid] = { ...seat, status: 'done', result: 'lose' };
      continue;
    }
    const p = handValue(seat.cards).total;
    let result: Seat['result'] = 'lose';
    if (dealerBust) result = 'win';
    else if (p > d) result = 'win';
    else if (p === d) result = 'push';
    nextSeats[pid] = { ...seat, status: 'done', result };
    if (result === 'win') nextBank[pid] = (nextBank[pid] ?? 0) + bet * 2;
    else if (result === 'push') nextBank[pid] = (nextBank[pid] ?? 0) + bet;
  }
  return { seats: nextSeats, bank: nextBank };
}

type SceneCtl = {
  applyState: (st: BjState, playerIds: string[], labels: Record<string, string>) => void;
  setTalking: (v: boolean) => void;
};

export function BlackjackGame(props: GameProps) {
  const { session, userId, canPlay } = props;
  const propsRef = useRef(props);
  propsRef.current = props;
  const [busy, setBusy] = useState(false);
  const ctlRef = useRef<SceneCtl | null>(null);
  const lastAnnounceRef = useRef('');

  const st = useMemo(
    () => parseState(session.state as Record<string, unknown>, session.playerIds),
    [session.state, session.playerIds],
  );

  const mySeat = userId ? st.seats[userId] : undefined;
  const myTurn = Boolean(userId && st.phase === 'play' && st.turn === userId && canPlay);
  const dealerVal = handValue(st.holeHidden ? st.dealer.slice(0, 1) : st.dealer);
  const myBank = userId ? (st.bank[userId] ?? START_BANK) : 0;
  const myPendingBet = userId ? (st.pendingBets[userId] ?? DEFAULT_BET) : DEFAULT_BET;
  const [countdown, setCountdown] = useState(0);
  const autoContinueRef = useRef(0);

  const patch = useCallback(
    async (next: Partial<BjState> & Record<string, unknown>) => {
      setBusy(true);
      try {
        await propsRef.current.onPatch(next);
        GameAudio.unlock();
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const setMyBet = (amount: number) => {
    const p = propsRef.current;
    if (!p.userId || !canPlay || busy) return;
    if (st.phase !== 'idle' && st.phase !== 'result') return;
    const bank = st.bank[p.userId] ?? START_BANK;
    const bet = Math.min(amount, Math.max(BET_OPTIONS[0], bank));
    if (bet < BET_OPTIONS[0]) return;
    GameAudio.chip();
    void patch({
      pendingBets: { ...st.pendingBets, [p.userId]: bet },
      bank: st.bank,
    });
  };

  const startRound = () => {
    const p = propsRef.current;
    if (!p.userId || !p.canPlay || busy) return;
    const cur = parseState(p.session.state as Record<string, unknown>, p.session.playerIds);
    if (cur.phase !== 'idle' && cur.phase !== 'result') return;
    const players = p.session.playerIds.slice(0, 4);
    if (players.length < 1) return;

    let bank = parseBank(cur.bank, players);
    const pending = parseBets(cur.pendingBets, players);
    // Chip'i bitenlere min chip ver
    for (const pid of players) {
      if ((bank[pid] ?? 0) < BET_OPTIONS[0]) bank[pid] = START_BANK;
    }

    let deck = shuffle();
    const seats: Record<string, Seat> = {};
    for (const pid of players) {
      const want = pending[pid] ?? DEFAULT_BET;
      let purse = bank[pid] ?? START_BANK;
      if (purse < BET_OPTIONS[0]) purse = START_BANK;
      const finalBet = Math.min(Math.max(BET_OPTIONS[0], want), purse);
      bank[pid] = purse - finalBet;

      const d1 = draw(deck, 1);
      deck = d1.deck;
      const d2 = draw(deck, 1);
      deck = d2.deck;
      const cards = [...d1.cards, ...d2.cards];
      const v = handValue(cards).total;
      seats[pid] = {
        cards,
        bet: finalBet,
        status: v === 21 ? 'blackjack' : 'playing',
      };
    }
    const dd1 = draw(deck, 1);
    deck = dd1.deck;
    const dd2 = draw(deck, 1);
    deck = dd2.deck;
    const dealer = [...dd1.cards, ...dd2.cards];
    const turn = nextPlayer(players, seats, null);
    GameAudio.deal();
    GameAudio.chip();
    const round = cur.round + 1;
    // Önce dağıtım animasyonu, sonra play
    void patch({
      phase: 'dealing',
      deck,
      dealer,
      holeHidden: true,
      seats,
      turn,
      round,
      bank,
      pendingBets: pending,
      resultUntil: null,
    });
  };

  const openPlayAfterDeal = () => {
    const p = propsRef.current;
    const cur = parseState(p.session.state as Record<string, unknown>, p.session.playerIds);
    if (cur.phase !== 'dealing') return;
    const turn = nextPlayer(p.session.playerIds, cur.seats, null);
    void patch({
      phase: turn ? 'play' : 'dealer',
      deck: cur.deck,
      dealer: cur.dealer,
      holeHidden: Boolean(turn),
      seats: cur.seats,
      turn,
      round: cur.round,
      bank: cur.bank,
      pendingBets: cur.pendingBets,
      resultUntil: null,
    });
  };

  const runDealer = () => {
    const p = propsRef.current;
    // Herhangi bir oyuncu kurpiyer turunu ilerletebilir (tek tur için deterministic)
    if (!p.userId || !p.session.playerIds.includes(p.userId)) return;
    const cur = parseState(p.session.state as Record<string, unknown>, p.session.playerIds);
    if (cur.phase !== 'dealer') return;
    let deck = [...cur.deck];
    let dealer = [...cur.dealer];
    while (handValue(dealer).total < 17) {
      const d = draw(deck, 1);
      deck = d.deck;
      dealer = [...dealer, ...d.cards];
    }
    const settled = settle(dealer, cur.seats, cur.bank);
    void patch({
      phase: 'result',
      deck,
      dealer,
      holeHidden: false,
      seats: settled.seats,
      turn: null,
      round: cur.round,
      bank: settled.bank,
      pendingBets: cur.pendingBets,
      resultUntil: Date.now() + RESULT_MS,
    });
  };

  const finishToDealer = (
    deck: number[],
    dealer: number[],
    seats: Record<string, Seat>,
    cur: BjState,
  ) => {
    void patch({
      phase: 'dealer',
      deck,
      dealer,
      holeHidden: false,
      seats,
      turn: null,
      round: cur.round,
      bank: cur.bank,
      pendingBets: cur.pendingBets,
      resultUntil: null,
    });
  };

  const act = (kind: 'hit' | 'stand' | 'double') => {
    const p = propsRef.current;
    if (!p.userId || !myTurn || busy) return;
    const cur = parseState(p.session.state as Record<string, unknown>, p.session.playerIds);
    const seat = cur.seats[p.userId];
    if (!seat || seat.status !== 'playing') return;
    let deck = [...cur.deck];
    let cards = [...seat.cards];
    let status: SeatStatus = seat.status;
    let bet = seat.bet;
    let bank = { ...cur.bank };

    if (kind === 'hit' || kind === 'double') {
      if (kind === 'double') {
        // Double: bahisi ikiye katla (bankadan çek)
        const extra = seat.bet;
        if ((bank[p.userId] ?? 0) < extra) return;
        bank[p.userId] = (bank[p.userId] ?? 0) - extra;
        bet = seat.bet * 2;
        GameAudio.chip();
      }
      const d = draw(deck, 1);
      deck = d.deck;
      cards = [...cards, ...d.cards];
      if (kind === 'double') {
        const v = handValue(cards).total;
        status = v > 21 ? 'bust' : 'stand';
      } else {
        const v = handValue(cards).total;
        if (v > 21) status = 'bust';
        else if (v === 21) status = 'stand';
      }
      GameAudio.cardFlip();
    } else {
      status = 'stand';
    }

    const seats = {
      ...cur.seats,
      [p.userId]: { ...seat, cards, status, bet },
    };
    if (status === 'bust') GameAudio.bust();

    const turn = status === 'playing' ? p.userId : nextPlayer(p.session.playerIds, seats, p.userId);
    if (!turn) {
      finishToDealer(deck, cur.dealer, seats, { ...cur, bank });
      return;
    }
    void patch({
      phase: 'play',
      deck,
      dealer: cur.dealer,
      holeHidden: true,
      seats,
      turn,
      round: cur.round,
      bank,
      pendingBets: cur.pendingBets,
      resultUntil: null,
    });
  };

  // Dağıtım animasyonu bitsin → play / dealer
  useEffect(() => {
    if (st.phase !== 'dealing' || !userId || !canPlay) return;
    // Tek istemci: listedeki ilk oyuncu ilerletsin
    if (session.playerIds[0] !== userId) return;
    const n = session.playerIds.length;
    const dealMs = Math.min(4200, 380 + (n * 2 + 2) * 280);
    const t = window.setTimeout(() => openPlayAfterDeal(), dealMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase, st.round, userId, canPlay, session.playerIds]);

  // Kurpiyer eli — ilk oyuncu ilerletir
  useEffect(() => {
    if (st.phase !== 'dealer' || !userId || !canPlay) return;
    if (session.playerIds[0] !== userId) return;
    const t = window.setTimeout(() => runDealer(), 1100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase, st.round, userId, canPlay, session.playerIds]);

  // Tur sonu 5 sn geri sayım → otomatik devam
  useEffect(() => {
    if (st.phase !== 'result' || !st.resultUntil) {
      setCountdown(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((st.resultUntil! - Date.now()) / 1000));
      setCountdown(left);
      if (
        left <= 0 &&
        userId &&
        canPlay &&
        session.playerIds[0] === userId &&
        autoContinueRef.current !== st.round
      ) {
        autoContinueRef.current = st.round;
        startRound();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.phase, st.resultUntil, st.round, userId, canPlay, session.playerIds]);

  // Sahne senkron
  useEffect(() => {
    const labels: Record<string, string> = {};
    for (const pid of session.playerIds) labels[pid] = labelFor(props, pid);
    ctlRef.current?.applyState(st, session.playerIds.slice(0, 4), labels);
  }, [st, session.playerIds, props]);

  // Kurpiyer TTS
  useEffect(() => {
    warmDealerVoices();
    onDealerSpeakingChange((v) => ctlRef.current?.setTalking(v));
    return () => onDealerSpeakingChange(null);
  }, []);

  const prevRoundRef = useRef(0);
  useEffect(() => {
    if (st.round > prevRoundRef.current && st.round > 0) {
      prevRoundRef.current = st.round;
      speakDealer(dealerLine('deal'), { interrupt: true });
    }
  }, [st.round]);

  useEffect(() => {
    const key = `${st.round}:${st.phase}:${st.turn ?? ''}`;
    if (key === lastAnnounceRef.current) return;
    lastAnnounceRef.current = key;
    if (st.phase === 'idle') return;

    if (st.phase === 'play' && st.turn) {
      const name = labelFor(props, st.turn);
      const mine = st.turn === userId;
      const delay = st.dealer.length <= 2 ? 1800 : 450;
      const t = window.setTimeout(() => {
        speakDealer(
          mine
            ? dealerLine('turn_you')
            : dealerLine('turn_other', { name }),
        );
      }, delay);
      return () => clearTimeout(t);
    }
    if (st.phase === 'dealer') {
      const t = window.setTimeout(() => speakDealer(dealerLine('dealer_play')), 500);
      return () => clearTimeout(t);
    }
    if (st.phase === 'result') {
      const me = userId ? st.seats[userId] : undefined;
      const t = window.setTimeout(() => {
        if (me?.result === 'blackjack') {
          GameAudio.blackjack();
          speakDealer(dealerLine('blackjack'));
        } else if (me?.result === 'win') {
          GameAudio.win();
          speakDealer(dealerLine('win'));
        } else if (me?.result === 'push') {
          GameAudio.push();
          speakDealer(dealerLine('push'));
        } else if (me?.result === 'lose') {
          GameAudio.lose();
          speakDealer(dealerLine('lose'));
        } else {
          speakDealer(dealerLine('round_end'));
        }
      }, 600);
      return () => clearTimeout(t);
    }
  }, [st.phase, st.turn, st.round, st.dealer.length, userId, props, st.seats]);

  const seatsOrdered = session.playerIds.slice(0, 4);
  while (seatsOrdered.length < 4) seatsOrdered.push(`_empty_${seatsOrdered.length}`);

  const statusText =
    st.phase === 'result'
      ? countdown > 0
        ? `Tur bitti · ${countdown}s`
        : 'Tur bitti'
      : st.phase === 'dealer'
        ? 'Kurpiyer oynuyor…'
        : st.phase === 'dealing'
          ? 'Kartlar dağıtılıyor…'
          : st.phase === 'play'
            ? st.turn
              ? `Sıra: ${labelFor(props, st.turn)}`
              : 'Oyun'
            : canPlay
              ? 'Bahis seç · Turu başlat'
              : 'İzleyici';

  const onReady = useCallback((api: ThreeSceneApi) => {
    const { THREE, scene, camera, renderer } = api;
    const cam = camera as PerspectiveCamera;
    cam.fov = 40;
    // Daha dik bakış: yakın kenar aşağıda, kurpiyer kartları + belden yukarı
    cam.position.set(0, CAM_Y, CAM_Z);
    cam.lookAt(0, LOOK_Y, LOOK_Z);
    cam.updateProjectionMatrix();
    renderer.toneMappingExposure = 0.95;

    const root = new THREE.Group();
    scene.add(root);
    const disposeVenue = addGameVenue(THREE, scene, root, 'blackjack', {
      renderer,
      playRadius: 7.2,
    });
    const assets = createAssetBag();

    // —— Masa ——
    const wood = makeWoodMaterial(THREE, assets, 'dark');
    wood.roughness = 0.32;
    wood.clearcoat = 0.55;
    const felt = makeFeltMaterial(THREE, '#0f6b3a', assets);

    // Keçeye altın daire / DEALER yazısı
    const feltMap = (() => {
      const cv = document.createElement('canvas');
      cv.width = 1024;
      cv.height = 1024;
      const ctx = cv.getContext('2d')!;
      const g = ctx.createRadialGradient(512, 480, 80, 512, 512, 520);
      g.addColorStop(0, '#1a8f4a');
      g.addColorStop(1, '#0a4a28');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 8000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1, 2);
      }
      ctx.strokeStyle = 'rgba(212,175,55,0.75)';
      ctx.lineWidth = 6;
      // seat arcs
      const seatsUv: [number, number][] = [
        [220, 700],
        [400, 780],
        [624, 780],
        [804, 700],
      ];
      for (const [ux, uy] of seatsUv) {
        ctx.beginPath();
        ctx.ellipse(ux, uy, 90, 55, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(512, 280, 120, 70, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(212,175,55,0.85)';
      ctx.font = 'bold 42px Georgia,serif';
      ctx.textAlign = 'center';
      ctx.fillText('DEALER', 512, 290);
      ctx.font = 'bold 28px Georgia,serif';
      ctx.fillText('BLACKJACK PAYS 3:2', 512, 520);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      assets.textures.push(tex);
      return tex;
    })();
    felt.map = feltMap;
    felt.needsUpdate = true;

    const tableW = 7.2;
    const tableD = 5.4;
    // Kalın apron + görünür alt yüzey
    const apron = new THREE.Mesh(new THREE.BoxGeometry(tableW + 0.9, 0.72, tableD + 0.9), wood);
    apron.position.y = -0.42;
    apron.castShadow = true;
    apron.receiveShadow = true;
    root.add(apron);
    const apronBottom = new THREE.Mesh(
      new THREE.BoxGeometry(tableW + 0.7, 0.06, tableD + 0.7),
      makeWoodMaterial(THREE, assets, 'warm'),
    );
    apronBottom.position.y = -0.78;
    apronBottom.castShadow = true;
    root.add(apronBottom);
    // Orta kaide — masa altını doldurur
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.35, 0.55, 28),
      wood,
    );
    pedestal.position.y = -1.05;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    root.add(pedestal);

    // Yarım daire masa formu — üst keçe disk + dikdörtgen karma
    const feltMesh = new THREE.Mesh(new THREE.BoxGeometry(tableW, 0.08, tableD), felt);
    feltMesh.position.y = 0.02;
    feltMesh.receiveShadow = true;
    root.add(feltMesh);

    const railMat = makeWoodMaterial(THREE, assets, 'warm');
    railMat.roughness = 0.3;
    railMat.clearcoat = 0.6;
    const addRail = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), railMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    };
    addRail(tableW + 0.7, 0.22, 0.28, 0, 0.12, -tableD / 2 - 0.05);
    addRail(tableW + 0.7, 0.22, 0.28, 0, 0.12, tableD / 2 + 0.05);
    addRail(0.28, 0.22, tableD + 0.2, -tableW / 2 - 0.05, 0.12, 0);
    addRail(0.28, 0.22, tableD + 0.2, tableW / 2 + 0.05, 0.12, 0);

    for (const [lx, lz] of [
      [-3.2, -2.2],
      [3.2, -2.2],
      [-3.2, 2.2],
      [3.2, 2.2],
    ] as const) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.05, 14), wood);
      leg.position.set(lx, -1.15, lz);
      leg.castShadow = true;
      root.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 14), wood);
      foot.position.set(lx, -1.68, lz);
      foot.castShadow = true;
      root.add(foot);
    }

    // Chip dekor
    const chipGold = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      metalness: 0.85,
      roughness: 0.25,
    });
    assets.materials.push(chipGold);
    for (let i = 0; i < 5; i++) {
      const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), chipGold);
      chip.position.set(-3.0 + i * 0.08, 0.08 + i * 0.03, -2.2);
      chip.castShadow = true;
      root.add(chip);
    }

    // Kurpiyer — önce prosedürel (anında), VRM varsa yükselt
    let dealer: DealerRig = makeDealerWoman(THREE, assets);
    dealer.root.position.set(0, 0.05, -2.55);
    dealer.faceCamera(cam.position.x, cam.position.y, cam.position.z);
    root.add(dealer.root);
    let dealerCancelled = false;
    void createDealerWomanFromVrm(THREE, assets).then((vrmDealer) => {
      if (dealerCancelled || !vrmDealer) return;
      root.remove(dealer.root);
      dealer.dispose?.();
      dealer = vrmDealer;
      // Belden yukarı: bacaklar masa altında, gövde uç kenarda
      vrmDealer.root.position.set(
        DEALER_VRM_POS.x,
        DEALER_VRM_POS.y,
        DEALER_VRM_POS.z,
      );
      vrmDealer.faceCamera(cam.position.x, cam.position.y, cam.position.z);
      root.add(vrmDealer.root);
    });

    // İsim etiketleri (canvas plane)
    const labelGroup = new THREE.Group();
    root.add(labelGroup);
    const labelMeshes: Mesh[] = [];

    const makeLabel = (text: string, x: number, z: number, active: boolean) => {
      const cv = document.createElement('canvas');
      cv.width = 512;
      cv.height = 128;
      const ctx = cv.getContext('2d')!;
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = active ? 'rgba(80,250,123,0.35)' : 'rgba(0,0,0,0.55)';
      roundRect(ctx, 16, 24, 480, 80, 20);
      ctx.fill();
      ctx.strokeStyle = active ? '#50fa7b' : 'rgba(212,175,55,0.6)';
      ctx.lineWidth = 4;
      roundRect(ctx, 16, 24, 480, 80, 20);
      ctx.stroke();
      ctx.fillStyle = '#f8f8f2';
      ctx.font = 'bold 36px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text.slice(0, 18), 256, 64);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      assets.textures.push(tex);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      assets.materials.push(mat);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), mat);
      mesh.position.set(x, 0.08, z + 0.85);
      mesh.rotation.x = -Math.PI / 2;
      labelGroup.add(mesh);
      labelMeshes.push(mesh);
    };

    function roundRect(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
    ) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    const cardsRoot = new THREE.Group();
    root.add(cardsRoot);
    const cardMap = new Map<string, Mesh>();
    const anims: CardAnim[] = [];
    let lastSig = '';

    const clearLabels = () => {
      for (const m of labelMeshes) {
        labelGroup.remove(m);
        m.geometry.dispose();
      }
      labelMeshes.length = 0;
    };

    const spawnCard = (
      key: string,
      cardId: number | 'back',
      to: { x: number; y: number; z: number },
      animate: boolean,
      delay: number,
    ) => {
      if (cardMap.has(key)) return;
      const mesh = makePlayingCard(THREE, cardId, assets);
      mesh.position.set(DEAL_ORIGIN.x, DEAL_ORIGIN.y, DEAL_ORIGIN.z);
      cardsRoot.add(mesh);
      cardMap.set(key, mesh);
      if (animate) {
        anims.push({
          mesh,
          from: { ...DEAL_ORIGIN },
          to,
          t: -delay,
          dur: 0.42,
        });
        window.setTimeout(() => {
          GameAudio.cardFlip();
          dealer.setDealPulse();
        }, delay * 1000);
      } else {
        mesh.position.set(to.x, to.y, to.z);
      }
    };

    const applyState = (bj: BjState, playerIds: string[], labels: Record<string, string>) => {
      const sig = JSON.stringify({
        r: bj.round,
        p: bj.phase,
        d: bj.dealer,
        h: bj.holeHidden,
        s: bj.seats,
        t: bj.turn,
        ids: playerIds,
      });
      if (sig === lastSig) return;
      const isNewRound = !lastSig || JSON.parse(lastSig).r !== bj.round;
      lastSig = sig;

      // Eski kartları temizle (tur değişince)
      if (isNewRound || bj.phase === 'idle') {
        for (const [, m] of cardMap) {
          cardsRoot.remove(m);
        }
        cardMap.clear();
        anims.length = 0;
      }

      clearLabels();
      for (let i = 0; i < 4; i++) {
        const pid = playerIds[i];
        const [sx, sz] = SEAT_POS[i]!;
        const empty = !pid;
        const name = empty ? `Koltuk ${i + 1}` : labels[pid] ?? 'Oyuncu';
        const seat = pid ? bj.seats[pid] : undefined;
        const total =
          seat && seat.cards.length
            ? ` · ${handValue(seat.cards).total}`
            : '';
        const active = Boolean(pid && bj.turn === pid && bj.phase === 'play');
        makeLabel(`${name}${total}`, sx, sz, active);

        if (seat) {
          seat.cards.forEach((c, ci) => {
            const key = `p${i}-${ci}-${c}`;
            if (cardMap.has(key)) return;
            const to = {
              x: sx - 0.22 + ci * 0.28,
              y: 0.06 + ci * 0.012,
              z: sz - 0.15,
            };
            // Klasik sıra: 1. tur P0..Pn D, 2. tur P0..Pn D
            const nSeats = Math.max(1, playerIds.length);
            const delay =
              isNewRound || bj.phase === 'dealing'
                ? (ci * (nSeats + 1) + i) * 0.28
                : 0.06 * ci;
            spawnCard(
              key,
              c,
              to,
              isNewRound || bj.phase === 'dealing' || bj.phase === 'play',
              delay,
            );
          });
        }
      }

      bj.dealer.forEach((c, ci) => {
        const hidden = bj.holeHidden && ci === 1;
        const key = `d-${ci}-${hidden ? 'x' : c}`;
        // hole flip: replace back with face
        const oldBack = cardMap.get(`d-${ci}-x`);
        if (!hidden && oldBack) {
          cardsRoot.remove(oldBack);
          cardMap.delete(`d-${ci}-x`);
        }
        if (cardMap.has(key)) return;
        const to = {
          x: -0.35 + ci * 0.32,
          y: 0.06 + ci * 0.012,
          z: DEALER_CARD_Z,
        };
        const nSeats = Math.max(1, playerIds.length);
        const delay =
          isNewRound || bj.phase === 'dealing'
            ? (ci * (nSeats + 1) + nSeats) * 0.28
            : 0.08 * ci;
        spawnCard(key, hidden ? 'back' : c, to, true, delay);
      });

      // Aktif koltuğa bak
      if (bj.turn) {
        const idx = playerIds.indexOf(bj.turn);
        if (idx >= 0) {
          const [sx, sz] = SEAT_POS[idx]!;
          dealer.lookAtSeat(sx, sz);
        }
      } else {
        dealer.lookAtSeat(0, 1);
      }
    };

    let raf = 0;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      dealer.update(t, dt);
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i]!;
        a.t += dt;
        if (a.t < 0) continue;
        const u = Math.min(1, a.t / a.dur);
        const e = 1 - (1 - u) * (1 - u);
        a.mesh.position.set(
          a.from.x + (a.to.x - a.from.x) * e,
          a.from.y + (a.to.y - a.from.y) * e + Math.sin(u * Math.PI) * 0.45,
          a.from.z + (a.to.z - a.from.z) * e,
        );
        a.mesh.rotation.z = (1 - e) * 0.4;
        if (u >= 1) {
          a.mesh.position.set(a.to.x, a.to.y, a.to.z);
          a.mesh.rotation.z = 0;
          anims.splice(i, 1);
        }
      }
      cam.position.x = Math.sin(t * 0.12) * 0.05;
      cam.position.y = CAM_Y;
      cam.position.z = CAM_Z;
      cam.lookAt(0, LOOK_Y + Math.sin(t * 0.18) * 0.012, LOOK_Z);
      dealer.faceCamera(cam.position.x, cam.position.y, cam.position.z);
    };
    tick();

    ctlRef.current = {
      applyState,
      setTalking: (v) => {
        dealer.setTalking(v);
      },
    };

    // İlk state
    const init = parseState(
      propsRef.current.session.state as Record<string, unknown>,
      propsRef.current.session.playerIds,
    );
    const labels: Record<string, string> = {};
    for (const pid of propsRef.current.session.playerIds) {
      labels[pid] = labelFor(propsRef.current, pid);
    }
    applyState(init, propsRef.current.session.playerIds.slice(0, 4), labels);

    return () => {
      dealerCancelled = true;
      cancelAnimationFrame(raf);
      ctlRef.current = null;
      dealer.dispose?.();
      disposeVenue();
      disposeObject(root);
      assets.dispose();
      scene.remove(root);
    };
  }, []);

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[#0c080a]">
      <ThreeSceneHost className="absolute inset-0" onReady={onReady} />
      <GameHud
        title="21 Blackjack"
        status={statusText}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-[#11131e]/75 px-2.5 py-1">
              {seatsOrdered.filter((id) => !id.startsWith('_empty_')).length}/4 oyuncu
              {st.round ? ` · Tur ${st.round}` : ''}
              {canPlay ? ` · Chip ${myBank}` : ''}
              {canPlay && (st.phase === 'idle' || st.phase === 'result')
                ? ` · Bahis ${myPendingBet}`
                : mySeat?.bet
                  ? ` · Bahis ${mySeat.bet}`
                  : ''}
              {st.phase === 'play' && myTurn ? ' · Senin sıran' : ''}
              {st.dealer.length > 0
                ? st.holeHidden
                  ? ` · Kurpiyer ${dealerVal.total}+?`
                  : ` · Kurpiyer ${dealerVal.total}`
                : ''}
            </span>
            <GameSoundControls />
          </div>
        }
        players={session.playerIds.map((pid) => {
          const seat = st.seats[pid];
          const v = seat ? handValue(seat.cards).total : 0;
          const chips = st.bank[pid] ?? START_BANK;
          const bet =
            st.phase === 'idle' || st.phase === 'result'
              ? st.pendingBets[pid] ?? DEFAULT_BET
              : seat?.bet ?? 0;
          const res =
            seat?.result === 'blackjack'
              ? 'BJ!'
              : seat?.result === 'win'
                ? 'Kazandı'
                : seat?.result === 'push'
                  ? 'Berabere'
                  : seat?.result === 'lose'
                    ? 'Kaybetti'
                    : seat?.status === 'bust'
                      ? 'Bust'
                      : seat?.status === 'blackjack'
                        ? 'BJ'
                        : seat?.cards.length
                          ? `${v}`
                          : '—';
          return {
            id: pid,
            label: labelFor(props, pid),
            active: st.turn === pid && st.phase === 'play',
            detail: `${res} · ${chips} chip · ${bet}`,
          };
        })}
        actions={
          <div className="flex flex-wrap items-center justify-center gap-2">
            {canPlay && (st.phase === 'idle' || st.phase === 'result') && (
              <>
                <div className="flex flex-wrap items-center gap-1">
                  {BET_OPTIONS.map((b) => (
                    <GameHudButton
                      key={b}
                      variant={myPendingBet === b ? 'success' : 'secondary'}
                      disabled={busy || myBank < b}
                      onClick={() => setMyBet(b)}
                    >
                      {b}
                    </GameHudButton>
                  ))}
                </div>
                {st.phase === 'idle' && (
                  <GameHudButton
                    disabled={busy || session.playerIds.length < 1 || myBank < BET_OPTIONS[0]}
                    onClick={() => {
                      GameAudio.unlock();
                      warmDealerVoices();
                      startRound();
                    }}
                  >
                    Turu başlat
                  </GameHudButton>
                )}
                {st.phase === 'result' && (
                  <>
                    <GameHudButton
                      disabled={busy}
                      onClick={() => {
                        GameAudio.unlock();
                        warmDealerVoices();
                        autoContinueRef.current = st.round;
                        startRound();
                      }}
                    >
                      Devam et{countdown > 0 ? ` (${countdown})` : ''}
                    </GameHudButton>
                    <GameHudButton
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        autoContinueRef.current = st.round;
                        void props.onLeave?.();
                      }}
                    >
                      Çık
                    </GameHudButton>
                  </>
                )}
              </>
            )}
            {myTurn && mySeat?.status === 'playing' && (
              <>
                <GameHudButton
                  disabled={busy}
                  onClick={() => {
                    GameAudio.unlock();
                    act('hit');
                  }}
                >
                  Kart al
                </GameHudButton>
                <GameHudButton
                  disabled={busy}
                  onClick={() => act('stand')}
                  variant="secondary"
                >
                  Dur
                </GameHudButton>
                {mySeat.cards.length === 2 && (myBank >= mySeat.bet) && (
                  <GameHudButton
                    disabled={busy}
                    onClick={() => act('double')}
                    variant="success"
                  >
                    Double
                  </GameHudButton>
                )}
              </>
            )}
          </div>
        }
      />
    </div>
  );
}
