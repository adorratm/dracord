import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { UserActivity, UserActivitySource } from '@dracord/types';
import { User } from '@/database/entities/user.entity';
import { mergeClientSettings } from '@/users/client-settings';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';

const PRIORITY: Record<UserActivitySource, number> = {
  dracord: 3,
  desktop: 2,
  spotify: 1,
  manual: 0,
};

@Injectable()
export class UserActivityService {
  constructor(
    private readonly em: EntityManager,
    private readonly broadcast: SocketBroadcastService,
  ) {}

  /** Kaynak önceliğine göre aktivite yaz; düşük öncelik yüksek olanı ezmez */
  async setActivity(
    userId: string,
    activity: UserActivity | null,
    opts?: { force?: boolean },
  ): Promise<UserActivity | null> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) return null;

    const current = (user.liveActivity as UserActivity | null) ?? null;
    if (
      !opts?.force &&
      activity &&
      current &&
      current.source &&
      activity.source &&
      PRIORITY[activity.source] < PRIORITY[current.source] &&
      !this.isExpired(current)
    ) {
      return this.filterForPublic(user, current);
    }

    // Aynı içerik: TTL uzat, gereksiz broadcast yok (şarkı sabit kalmasın diye
    // track değişince aşağıdaki dal çalışır)
    if (
      activity &&
      current &&
      !this.isExpired(current) &&
      current.source === activity.source &&
      current.type === activity.type &&
      current.name === activity.name &&
      (current.details ?? null) === (activity.details ?? null) &&
      (current.imageUrl ?? null) === (activity.imageUrl ?? null) &&
      (current.url ?? null) === (activity.url ?? null)
    ) {
      const renewed: UserActivity = {
        ...current,
        expiresAt: activity.expiresAt ?? current.expiresAt,
        startedAt: current.startedAt ?? activity.startedAt,
      };
      user.liveActivity = renewed as unknown as Record<string, unknown>;
      await this.em.save(User, user);
      return this.filterForPublic(user, renewed);
    }

    // Track değişimi: startedAt’i koruma (aynı oturum) — yeni isimde yeni startedAt
    const next: UserActivity | null = activity
      ? {
          ...activity,
          startedAt:
            current?.source === activity.source && current.name === activity.name
              ? current.startedAt ?? activity.startedAt
              : activity.startedAt,
        }
      : null;

    user.liveActivity = next as unknown as Record<string, unknown> | null;
    await this.em.save(User, user);

    const publicActivity = this.filterForPublic(user, next);
    this.broadcast.broadcastPresence({
      userId,
      status: user.status,
      customStatus: user.customStatus,
      activity: publicActivity,
    });
    return publicActivity;
  }

  async clearActivity(userId: string, source?: UserActivitySource) {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) return;
    const current = (user.liveActivity as UserActivity | null) ?? null;
    if (source && current?.source && current.source !== source) return;
    await this.setActivity(userId, null, { force: true });
  }

  isExpired(activity: UserActivity | null | undefined): boolean {
    if (!activity?.expiresAt) return false;
    return new Date(activity.expiresAt).getTime() < Date.now();
  }

  filterForPublic(user: User, activity: UserActivity | null): UserActivity | null {
    if (!activity || this.isExpired(activity)) return null;
    const settings = mergeClientSettings(user.clientSettings);
    if (!settings.activity.displayActivity) return null;
    if (activity.source === 'dracord' && !settings.activity.shareGames) return null;
    if (activity.source === 'spotify' && settings.activity.shareSpotify === false) return null;
    if (
      activity.source === 'desktop' &&
      settings.activity.shareDesktopActivity === false
    ) {
      return null;
    }
    return activity;
  }

  resolveLiveActivity(user: User): UserActivity | null {
    const raw = (user.liveActivity as UserActivity | null) ?? null;
    return this.filterForPublic(user, raw);
  }
}
