/** Paylaşılan 21 Blackjack kuralları / state (DOM/RN bağımsız) */

export type BjPhase = 'idle' | 'dealing' | 'play' | 'dealer' | 'result';
export type BjSeatStatus = 'idle' | 'playing' | 'stand' | 'bust' | 'blackjack' | 'done';

export type BjSeat = {
  cards: number[];
  status: BjSeatStatus;
  bet: number;
  result?: 'win' | 'lose' | 'push' | 'blackjack';
};

export type BjState = {
  phase: BjPhase;
  deck: number[];
  dealer: number[];
  holeHidden: boolean;
  seats: Record<string, BjSeat>;
  turn: string | null;
  round: number;
  bank: Record<string, number>;
  pendingBets: Record<string, number>;
  resultUntil: number | null;
};

export const BJ_START_BANK = 1000;
export const BJ_BET_OPTIONS = [10, 25, 50, 100, 250] as const;
export const BJ_DEFAULT_BET = 25;
export const BJ_RESULT_MS = 5000;

export function bjHandValue(cards: number[]): { total: number; soft: boolean } {
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

export function bjShuffle(): number[] {
  const d = Array.from({ length: 52 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = d[i]!;
    d[i] = d[j]!;
    d[j] = t;
  }
  return d;
}

export function bjDraw(deck: number[], n: number): { cards: number[]; deck: number[] } {
  return { cards: deck.slice(0, n), deck: deck.slice(n) };
}

export function bjEmptySeat(bet = 0): BjSeat {
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
    out[pid] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : BJ_START_BANK;
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
    out[pid] = Number.isFinite(n) && n > 0 ? Math.floor(n) : BJ_DEFAULT_BET;
  }
  return out;
}

export function bjParseState(raw: Record<string, unknown>, playerIds: string[]): BjState {
  const phase = (['idle', 'dealing', 'play', 'dealer', 'result'] as const).includes(
    raw.phase as BjPhase,
  )
    ? (raw.phase as BjPhase)
    : 'idle';
  const deck = Array.isArray(raw.deck)
    ? raw.deck.map(Number).filter((n) => n >= 0 && n < 52)
    : [];
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
  const seats: Record<string, BjSeat> = {};
  for (const pid of playerIds) {
    const s = seatsRaw[pid];
    if (s && typeof s === 'object' && !Array.isArray(s)) {
      const o = s as Record<string, unknown>;
      const cards = Array.isArray(o.cards)
        ? o.cards.map(Number).filter((n) => n >= 0 && n < 52)
        : [];
      const status = (o.status as BjSeatStatus) || 'idle';
      const result = o.result as BjSeat['result'];
      const bet = Math.max(0, Math.floor(Number(o.bet) || 0));
      seats[pid] = { cards, status, bet, ...(result ? { result } : {}) };
    } else {
      seats[pid] = bjEmptySeat(pendingBets[pid] ?? BJ_DEFAULT_BET);
    }
  }
  return {
    phase,
    deck,
    dealer,
    holeHidden,
    seats,
    turn,
    round,
    bank,
    pendingBets,
    resultUntil,
  };
}

export function bjNextPlayer(
  playerIds: string[],
  seats: Record<string, BjSeat>,
  after: string | null,
) {
  const start = after ? playerIds.indexOf(after) + 1 : 0;
  for (let i = 0; i < playerIds.length; i++) {
    const id = playerIds[(start + i) % playerIds.length]!;
    if (seats[id]?.status === 'playing') return id;
  }
  return null;
}

export function bjSettle(
  dealerCards: number[],
  seats: Record<string, BjSeat>,
  bank: Record<string, number>,
): { seats: Record<string, BjSeat>; bank: Record<string, number> } {
  const d = bjHandValue(dealerCards).total;
  const dealerBust = d > 21;
  const nextSeats = { ...seats };
  const nextBank = { ...bank };
  for (const [pid, seat] of Object.entries(seats)) {
    const bet = Math.max(0, seat.bet || 0);
    if (seat.status === 'blackjack') {
      const dealerBj = dealerCards.length === 2 && d === 21;
      const result: BjSeat['result'] = dealerBj ? 'push' : 'blackjack';
      nextSeats[pid] = { ...seat, status: 'done', result };
      if (result === 'blackjack') {
        nextBank[pid] = (nextBank[pid] ?? 0) + bet + Math.floor(bet * 1.5);
      } else nextBank[pid] = (nextBank[pid] ?? 0) + bet;
      continue;
    }
    if (seat.status === 'bust') {
      nextSeats[pid] = { ...seat, status: 'done', result: 'lose' };
      continue;
    }
    const p = bjHandValue(seat.cards).total;
    let result: BjSeat['result'] = 'lose';
    if (dealerBust) result = 'win';
    else if (p > d) result = 'win';
    else if (p === d) result = 'push';
    nextSeats[pid] = { ...seat, status: 'done', result };
    if (result === 'win') nextBank[pid] = (nextBank[pid] ?? 0) + bet * 2;
    else if (result === 'push') nextBank[pid] = (nextBank[pid] ?? 0) + bet;
  }
  return { seats: nextSeats, bank: nextBank };
}

export function bjCardLabel(code: number): string {
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = ['♠', '♥', '♦', '♣'];
  return `${ranks[code % 13]}${suits[Math.floor(code / 13) % 4]}`;
}
