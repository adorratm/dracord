/** Bowling skor / sıra (render bağımsız) */

export type BowlingFrameState = { rolls: number[]; complete: boolean };

export type BowlingLastRoll = {
  by: string;
  pins: number;
  knocked: number[];
  standing: number[];
  standingBefore: number[];
  tx: number;
  vx: number;
  vz: number;
  t: number;
};

export const BOWLING_ALL_PINS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function bowlingParseFrames(rolls: number[]): BowlingFrameState[] {
  const frames: BowlingFrameState[] = [];
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

export function bowlingScoreRolls(rolls: number[]): number {
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

export function bowlingReadFrames(raw: unknown): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.map((n) => Math.max(0, Math.min(10, Number(n) || 0)));
    }
  }
  return out;
}

export function bowlingNextShooter(
  playerIds: string[],
  frames: Record<string, number[]>,
): string | null {
  const parsed = playerIds.map((id) => bowlingParseFrames(frames[id] ?? []));
  for (let f = 0; f < 10; f++) {
    for (let p = 0; p < playerIds.length; p++) {
      const fr = parsed[p]![f];
      if (!fr || !fr.complete) return playerIds[p]!;
    }
  }
  return null;
}

export function bowlingReadLastRoll(raw: unknown): BowlingLastRoll | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map(Number).filter((n) => n >= 0 && n < 10) : [];
  const knocked = arr(o.knocked);
  const standing = Array.isArray(o.standing) ? arr(o.standing) : BOWLING_ALL_PINS;
  let standingBefore = Array.isArray(o.standingBefore) ? arr(o.standingBefore) : null;
  if (!standingBefore) {
    if (knocked.length === 0) standingBefore = standing.length ? standing : BOWLING_ALL_PINS;
    else if (standing.length === 10) standingBefore = BOWLING_ALL_PINS;
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
    standingBefore: standingBefore.length ? standingBefore : BOWLING_ALL_PINS,
    tx,
    vx: Number.isFinite(vx) ? vx : tx * 0.55,
    vz: Number.isFinite(vz) && vz < 0 ? vz : -16,
    t: Number(o.t ?? 0),
  };
}
