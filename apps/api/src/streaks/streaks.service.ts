import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import type { UserStreakDto } from '@dracord/types';
import { UserStreak } from '@/database/entities/user-streak.entity';
import { advance, dayKey, liveCurrent, MAX_FREEZES, nextMilestone, streakTier } from './streak-math';

/**
 * Günlük seriler (D2): mesaj atmak ya da seste bulunmak o günü sayar.
 * Gün başına kullanıcı başına en fazla bir DB yazımı (bellek önbelleği).
 */
@Injectable()
export class StreaksService {
  private readonly log = new Logger(StreaksService.name);
  private seenDay = '';
  private seen = new Set<string>();

  constructor(@InjectEntityManager() private readonly em: EntityManager) {}

  /** Aktiflik — çağıranı asla bozmaz */
  async touch(userId: string): Promise<void> {
    if (!userId || userId === DRACORD_BOT_USER_ID) return;
    const today = dayKey();
    if (today !== this.seenDay) {
      this.seenDay = today;
      this.seen = new Set();
    }
    if (this.seen.has(userId)) return;
    this.seen.add(userId);
    try {
      await this.em.transaction(async (tx) => {
        const row = await tx.findOne(UserStreak, { where: { userId }, lock: { mode: 'pessimistic_write' } });
        const prev = row ?? { current: 0, best: 0, lastDay: null, freezes: 0, freezesUsed: 0 };
        if (prev.lastDay === today) return;
        const next = advance(prev, today);
        await tx.upsert(
          UserStreak,
          { userId, current: next.current, best: next.best, lastDay: next.lastDay, freezes: next.freezes, freezesUsed: next.freezesUsed },
          ['userId'],
        );
      });
    } catch (e) {
      this.seen.delete(userId);
      this.log.warn(`streak touch failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async get(userId: string): Promise<UserStreakDto> {
    const row = await this.em.findOne(UserStreak, { where: { userId } });
    const today = dayKey();
    const s = row ?? { current: 0, best: 0, lastDay: null, freezes: 0, freezesUsed: 0 };
    const current = liveCurrent(s, today);
    return {
      current,
      best: s.best,
      activeToday: s.lastDay === today,
      freezes: s.freezes,
      maxFreezes: MAX_FREEZES,
      freezesUsed: s.freezesUsed,
      nextMilestone: nextMilestone(current),
      tier: streakTier(s.best),
      day: today,
    };
  }

  /** Profil için kısa özet */
  async badge(userId: string): Promise<{ current: number; best: number; tier: number | null } | null> {
    const row = await this.em.findOne(UserStreak, { where: { userId } });
    if (!row) return null;
    const current = liveCurrent(row, dayKey());
    if (current < 2 && !streakTier(row.best)) return null;
    return { current, best: row.best, tier: streakTier(row.best) };
  }
}
