/**
 * Okey 101 kural motoru (standart “eli bitir” okey değil).
 * - 21 taş / oyuncu
 * - Açılış ≥33 puan ve en az 2 yan (per/seri) veya 5 çift
 * - Masaya per/seri açma; ceza puanı birikimi (eleme 101)
 */

export const TILE_COUNT = 106;
export const HAND_SIZE = 21;
export const OPEN_THRESHOLD = 33;
/** Açılışta en az kaç ayrı per/seri (yan) gerekir */
export const MIN_OPEN_GROUPS = 2;
export const PAIR_OPEN_COUNT = 5;
export const ELIMINATION_SCORE = 101;

export const COLOR_HEX = ['#d4a017', '#2563eb', '#1f2937', '#dc2626'] as const;
export const COLOR_NAME = ['Sarı', 'Mavi', 'Siyah', 'Kırmızı'] as const;

export const colorOf = (code: number) => Math.floor((code % 52) / 13);
export const numOf = (code: number) => (code % 13) + 1;

export type OkeyFace = { c: number; n: number };
export type NT = { c: number; n: number; code: number; wild?: boolean };

export function okeyFromIndicator(ind: number | undefined): OkeyFace | null {
  if (ind === undefined || ind >= 104) return null;
  return { c: colorOf(ind), n: (numOf(ind) % 13) + 1 };
}

export function isJoker(code: number, okey: OkeyFace | null): boolean {
  if (!okey || code >= 104) return false;
  return colorOf(code) === okey.c && numOf(code) === okey.n;
}

/** Sahte okey, gösterge okeyinin sabit taşı gibi davranır */
export function asTile(code: number, okey: OkeyFace | null): NT {
  if (code >= 104 && okey) return { c: okey.c, n: okey.n, code, wild: false };
  if (isJoker(code, okey)) return { c: -1, n: -1, code, wild: true };
  return { c: colorOf(code), n: numOf(code), code, wild: false };
}

export function tilePoints(code: number, okey: OkeyFace | null): number {
  if (isJoker(code, okey)) return 25;
  if (code >= 104 && okey) return okey.n;
  return numOf(code);
}

export function sortKey(code: number, okey: OkeyFace | null) {
  if (isJoker(code, okey) || code >= 104) return 1000 + code;
  return colorOf(code) * 13 + numOf(code);
}

export function sortHand(codes: number[], okey: OkeyFace | null) {
  return [...codes].sort(
    (a, b) => sortKey(a, okey) - sortKey(b, okey) || a - b,
  );
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Geçerli per: aynı sayı, ≥3 farklı renk (joker ile) */
export function isValidSet(codes: number[], okey: OkeyFace | null): boolean {
  if (codes.length < 3 || codes.length > 4) return false;
  const tiles = codes.map((c) => asTile(c, okey));
  const wilds = tiles.filter((t) => t.wild).length;
  const fixed = tiles.filter((t) => !t.wild);
  if (fixed.length === 0) return wilds >= 3;
  const n = fixed[0]!.n;
  if (fixed.some((t) => t.n !== n)) return false;
  const colors = new Set(fixed.map((t) => t.c));
  if (colors.size !== fixed.length) return false;
  return fixed.length + wilds >= 3 && fixed.length + wilds <= 4;
}

/** Geçerli seri: aynı renk, ardışık (≥3) */
export function isValidRun(codes: number[], okey: OkeyFace | null): boolean {
  if (codes.length < 3) return false;
  const tiles = codes.map((c) => asTile(c, okey));
  const wilds = tiles.filter((t) => t.wild).length;
  const fixed = tiles.filter((t) => !t.wild).sort((a, b) => a.n - b.n);
  if (fixed.length === 0) return wilds >= 3;
  const c = fixed[0]!.c;
  if (fixed.some((t) => t.c !== c)) return false;
  for (let i = 1; i < fixed.length; i++) {
    if (fixed[i]!.n === fixed[i - 1]!.n) return false;
  }
  let gaps = 0;
  for (let i = 1; i < fixed.length; i++) {
    gaps += fixed[i]!.n - fixed[i - 1]!.n - 1;
  }
  if (gaps > wilds) return false;
  const span = fixed[fixed.length - 1]!.n - fixed[0]!.n + 1;
  const total = fixed.length + wilds;
  if (total < 3 || span > total) return false;
  if (fixed[0]!.n - (wilds - gaps) < 1) return false;
  if (fixed[fixed.length - 1]!.n + Math.max(0, wilds - gaps - (span - fixed.length)) > 13) {
    /* jokerler uçlara da gidebilir — gevşek kontrol */
  }
  return total >= 3;
}

export function isValidMeld(codes: number[], okey: OkeyFace | null): boolean {
  return isValidSet(codes, okey) || isValidRun(codes, okey);
}

export function meldPoints(codes: number[], okey: OkeyFace | null): number {
  return codes.reduce((s, c) => s + tilePoints(c, okey), 0);
}

export function isPairsOpen(groups: number[][], okey: OkeyFace | null): boolean {
  if (groups.length < PAIR_OPEN_COUNT) return false;
  let pairs = 0;
  for (const g of groups) {
    if (g.length !== 2) return false;
    const [a, b] = g;
    if (a === undefined || b === undefined) return false;
    const ta = asTile(a, okey);
    const tb = asTile(b, okey);
    if (ta.wild || tb.wild) {
      pairs++;
      continue;
    }
    if (ta.c === tb.c && ta.n === tb.n) pairs++;
    else return false;
  }
  return pairs >= PAIR_OPEN_COUNT;
}

export function canOpen(
  groups: number[][],
  okey: OkeyFace | null,
): { ok: boolean; points: number; reason?: string } {
  if (groups.length === 0) return { ok: false, points: 0, reason: 'En az bir per/seri seç' };
  for (const g of groups) {
    if (g.length === 2) {
      // çift açılışı ayrı
    } else if (!isValidMeld(g, okey)) {
      return { ok: false, points: 0, reason: 'Geçersiz per/seri var' };
    }
  }
  if (groups.every((g) => g.length === 2)) {
    if (!isPairsOpen(groups, okey)) {
      return { ok: false, points: 0, reason: `Çift açılış için ${PAIR_OPEN_COUNT} çift gerekir` };
    }
    return { ok: true, points: 0 };
  }
  if (groups.some((g) => g.length === 2)) {
    return { ok: false, points: 0, reason: 'Çiftler ile per/seri karıştırılamaz' };
  }
  if (groups.length < MIN_OPEN_GROUPS) {
    return {
      ok: false,
      points: groups.reduce((s, g) => s + meldPoints(g, okey), 0),
      reason: `Açılış için en az ${MIN_OPEN_GROUPS} yan (per/seri) gerekir`,
    };
  }
  const points = groups.reduce((s, g) => s + meldPoints(g, okey), 0);
  if (points < OPEN_THRESHOLD) {
    return {
      ok: false,
      points,
      reason: `Açılış için en az ${OPEN_THRESHOLD} puan ve ${MIN_OPEN_GROUPS} yan (şu an ${points}p / ${groups.length} yan)`,
    };
  }
  return { ok: true, points };
}

export type Okey101State = {
  hands: Record<string, number[]>;
  deck: number[];
  discard: number[];
  ind: number | undefined;
  win: number | undefined;
  scores: Record<string, number>;
  melds: Record<string, number[][]>;
  opened: Record<string, boolean>;
  dealt: boolean;
  eliminated: string[];
};

function ints(v: unknown): number[] {
  return Array.isArray(v)
    ? v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < TILE_COUNT)
    : [];
}

export function readOkey101(state: Record<string, unknown>): Okey101State {
  const hands: Record<string, number[]> = {};
  const raw = state.hands;
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
      else if (k === '_elim') continue;
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
  const melds: Record<string, number[][]> = {};
  if (state.melds && typeof state.melds === 'object' && !Array.isArray(state.melds)) {
    for (const [k, v] of Object.entries(state.melds as Record<string, unknown>)) {
      if (!Array.isArray(v)) continue;
      melds[k] = v
        .filter(Array.isArray)
        .map((g) => ints(g))
        .filter((g) => g.length >= 2);
    }
  }
  const opened: Record<string, boolean> = {};
  if (state.opened && typeof state.opened === 'object' && !Array.isArray(state.opened)) {
    for (const [k, v] of Object.entries(state.opened as Record<string, unknown>)) {
      opened[k] = Boolean(v);
    }
  }
  const eliminated: string[] = [];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const elim = (raw as Record<string, unknown>)._elim;
    if (Array.isArray(elim)) {
      for (const id of elim) if (typeof id === 'string') eliminated.push(id);
    }
  }
  return { hands, deck, discard, ind, win, scores, melds, opened, dealt, eliminated };
}

export function packHands(
  hands: Record<string, number[]>,
  deck: number[],
  discard: number[],
  ind: number | undefined,
  win?: number,
  eliminated?: string[],
) {
  const out: Record<string, number[] | string[]> = {
    ...hands,
    _deck: deck,
    _discard: discard,
  };
  if (ind !== undefined) out._ind = [ind];
  if (win !== undefined) out._win = [win];
  if (eliminated && eliminated.length) out._elim = eliminated;
  return out;
}

export function handPenalty(codes: number[], okey: OkeyFace | null): number {
  return codes.reduce((s, c) => s + tilePoints(c, okey), 0);
}
