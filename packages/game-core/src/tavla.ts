/** Tavla tahta / zar kuralları (render bağımsız) */

export type TavlaBoard = { points: number[]; bar: [number, number]; off: [number, number] };
export type TavlaMove = { from: number | 'bar'; to: number | 'off'; die: number };

export function tavlaInitialBoard(): TavlaBoard {
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

export function tavlaReadBoard(raw: unknown): TavlaBoard {
  if (!raw || typeof raw !== 'object') return tavlaInitialBoard();
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.points) || o.points.length !== 24) return tavlaInitialBoard();
  const pair = (v: unknown): [number, number] =>
    Array.isArray(v) ? [Number(v[0]) || 0, Number(v[1]) || 0] : [0, 0];
  return { points: o.points.map((n) => Number(n) || 0), bar: pair(o.bar), off: pair(o.off) };
}

export function tavlaReadDice(raw: unknown): number[] {
  return Array.isArray(raw)
    ? raw.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 6).slice(0, 4)
    : [];
}

export function tavlaLegalFor(b: TavlaBoard, p: 0 | 1, die: number): TavlaMove[] {
  const dir = p === 0 ? 1 : -1;
  const sign = p === 0 ? 1 : -1;
  const own = (i: number) => (b.points[i] ?? 0) * sign;
  const moves: TavlaMove[] = [];
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
      const need = p === 0 ? 24 - i : i + 1;
      if (die === need) {
        moves.push({ from: i, to: 'off', die });
      } else if (die > need) {
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

export function tavlaApplyMove(b: TavlaBoard, p: 0 | 1, m: TavlaMove): TavlaBoard {
  const sign = p === 0 ? 1 : -1;
  const next: TavlaBoard = {
    points: [...b.points],
    bar: [...b.bar] as [number, number],
    off: [...b.off] as [number, number],
  };
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

export function tavlaRemoveDie(dice: number[], die: number): number[] {
  const i = dice.indexOf(die);
  if (i < 0) return dice;
  return [...dice.slice(0, i), ...dice.slice(i + 1)];
}

export function tavlaMaxDiceUsable(b: TavlaBoard, p: 0 | 1, dice: number[]): number {
  if (dice.length === 0) return 0;
  let best = 0;
  const seen = new Set<number>();
  for (const d of dice) {
    if (seen.has(d)) continue;
    seen.add(d);
    for (const m of tavlaLegalFor(b, p, d)) {
      const n = 1 + tavlaMaxDiceUsable(tavlaApplyMove(b, p, m), p, tavlaRemoveDie(dice, d));
      if (n > best) best = n;
      if (best >= dice.length) return best;
    }
  }
  return best;
}

export function tavlaAllLegal(b: TavlaBoard, p: 0 | 1, dice: number[]): TavlaMove[] {
  if (dice.length === 0) return [];
  const candidates: TavlaMove[] = [];
  for (const d of new Set(dice)) candidates.push(...tavlaLegalFor(b, p, d));
  if (candidates.length === 0) return [];
  const max = tavlaMaxDiceUsable(b, p, dice);
  if (max <= 1) return candidates;
  return candidates.filter((m) => {
    const after =
      1 + tavlaMaxDiceUsable(tavlaApplyMove(b, p, m), p, tavlaRemoveDie(dice, m.die));
    return after >= max;
  });
}
