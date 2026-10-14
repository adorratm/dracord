/** Bilardo state parse helpers (fizik/render platformda) */

export type BilliardBall = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sunk?: boolean;
};
export type BilliardGroupKind = 'solid' | 'stripe';
export type BilliardGroupsMap = Record<string, BilliardGroupKind>;
export type BilliardPocketedMap = Record<string, number[]>;
export type BilliardShot = {
  dx: number;
  dz: number;
  power: number;
  by: string;
  id: number;
};

export function billiardsBallGroup(id: number): BilliardGroupKind | 'eight' | 'cue' {
  if (id === 0) return 'cue';
  if (id === 8) return 'eight';
  return id <= 7 ? 'solid' : 'stripe';
}

export function billiardsParseBalls(raw: unknown): BilliardBall[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: BilliardBall[] = [];
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

export function billiardsParseGroups(raw: unknown): BilliardGroupsMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: BilliardGroupsMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === 'solid' || v === 'stripe') out[k] = v;
  }
  return out;
}

export function billiardsParsePocketed(raw: unknown): BilliardPocketedMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: BilliardPocketedMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    out[k] = v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 15);
  }
  return out;
}

export function billiardsParseShot(raw: unknown): BilliardShot | null {
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

export function billiardsGroupCleared(
  balls: BilliardBall[],
  group: BilliardGroupKind,
): boolean {
  return balls.filter((b) => billiardsBallGroup(b.id) === group).every((b) => b.sunk);
}

export function billiardsOpposite(g: BilliardGroupKind): BilliardGroupKind {
  return g === 'solid' ? 'stripe' : 'solid';
}
