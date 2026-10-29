/** Aktivite state CAS / bilardo shot doğrulama (istemci + API paylaşımı) */

import {
  billiardsParseShot,
  type BilliardShot,
} from './billiards';

export type CasResult = 'ok' | 'missing' | 'conflict';

/** CAS: expected yoksa enforce kapalıysa ok; açıkken missing */
export function activityCasCheck(
  currentVersion: number,
  expectedVersion: number | undefined,
  enforce: boolean,
): CasResult {
  if (expectedVersion === undefined || !Number.isFinite(expectedVersion)) {
    return enforce ? 'missing' : 'ok';
  }
  if (Math.trunc(expectedVersion) !== currentVersion) return 'conflict';
  return 'ok';
}

export function activityNextVersion(current: number): number {
  const n = Number.isFinite(current) ? Math.max(0, Math.trunc(current)) : 0;
  return n + 1;
}

export type BilliardsShotContext = {
  userId: string;
  playerIds: string[];
  turn: unknown;
  prevShot: unknown;
};

export type BilliardsShotValidation =
  | { ok: true; shot: BilliardShot }
  | { ok: false; reason: string };

/** Vuruş: gönderen = by = sıra sahibi; id önceki shot’tan büyük */
export function billiardsValidateShotPatch(
  rawShot: unknown,
  ctx: BilliardsShotContext,
): BilliardsShotValidation {
  const shot = billiardsParseShot(rawShot);
  if (!shot) return { ok: false, reason: 'Geçersiz shot' };
  if (shot.by !== ctx.userId) {
    return { ok: false, reason: 'Shot gönderen uyuşmuyor' };
  }
  const players = ctx.playerIds.filter(Boolean);
  if (players.length === 0) {
    return { ok: false, reason: 'Oyuncu yok' };
  }
  const turnIdx = Number(ctx.turn ?? 0);
  const turnUser =
    players[
      Number.isInteger(turnIdx) && turnIdx >= 0
        ? turnIdx % players.length
        : 0
    ]!;
  if (shot.by !== turnUser) {
    return { ok: false, reason: 'Sıra sende değil' };
  }
  const prev = billiardsParseShot(ctx.prevShot);
  if (prev && shot.id <= prev.id) {
    return { ok: false, reason: 'Shot id geriye gidemez' };
  }
  if (!Number.isFinite(shot.power) || shot.power < 0.05 || shot.power > 1.5) {
    return { ok: false, reason: 'Geçersiz güç' };
  }
  return { ok: true, shot };
}
