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

/** Kaynak başına saklama — oyun + Spotify birlikte */
type ActivityBag = {
  _v: 2;
  bySource: Partial<Record<UserActivitySource, UserActivity>>;
};

function isActivityShape(o: Record<string, unknown>): o is UserActivity & Record<string, unknown> {
  return (
    typeof o.type === 'string' &&
    typeof o.name === 'string' &&
    typeof o.source === 'string'
  );
}

function parseBag(raw: unknown): ActivityBag {
  if (!raw || typeof raw !== 'object') return { _v: 2, bySource: {} };
  const o = raw as Record<string, unknown>;
  if (o._v === 2 && o.bySource && typeof o.bySource === 'object') {
    return {
      _v: 2,
      bySource: o.bySource as Partial<Record<UserActivitySource, UserActivity>>,
    };
  }
  // Eski tek-aktivite formatı
  if (isActivityShape(o)) {
    const src = o.source as UserActivitySource;
    return { _v: 2, bySource: { [src]: o as unknown as UserActivity } };
  }
  return { _v: 2, bySource: {} };
}

@Injectable()
export class UserActivityService {
  constructor(
    private readonly em: EntityManager,
    private readonly broadcast: SocketBroadcastService,
  ) {}

  isExpired(activity: UserActivity | null | undefined): boolean {
    if (!activity?.expiresAt) return false;
    return new Date(activity.expiresAt).getTime() < Date.now();
  }

  filterForPublic(user: User, activity: UserActivity | null): UserActivity | null {
    if (!activity || this.isExpired(activity)) return null;
    const settings = mergeClientSettings(user.clientSettings);
    if (!settings.activity.displayActivity) return null;
    if (activity.source === 'dracord' && !settings.activity.shareGames) return null;
    if (activity.source === 'spotify' && settings.activity.shareSpotify === false) {
      return null;
    }
    if (
      activity.source === 'desktop' &&
      settings.activity.shareDesktopActivity === false
    ) {
      return null;
    }
    return activity;
  }

  private listFromBag(user: User, bag: ActivityBag, forSelf: boolean): UserActivity[] {
    const out: UserActivity[] = [];
    for (const act of Object.values(bag.bySource)) {
      if (!act) continue;
      const filtered = forSelf
        ? this.isExpired(act)
          ? null
          : act
        : this.filterForPublic(user, act);
      if (filtered) out.push(filtered);
    }
    out.sort(
      (a, b) => (PRIORITY[b.source] ?? 0) - (PRIORITY[a.source] ?? 0),
    );
    return out;
  }

  private primaryOf(list: UserActivity[]): UserActivity | null {
    return list[0] ?? null;
  }

  private emitPresence(user: User, list: UserActivity[]) {
    this.broadcast.broadcastPresence({
      userId: user.id,
      status: user.status,
      customStatus: user.customStatus,
      activity: this.primaryOf(list),
      activities: list,
    });
  }

  /**
   * Kaynak slotuna yaz. Spotify, desktop oyun varken de kalır (öncelik ezmez).
   * `force` + null + source yok → tümünü temizle.
   */
  async setActivity(
    userId: string,
    activity: UserActivity | null,
    opts?: { force?: boolean },
  ): Promise<UserActivity | null> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) return null;

    const bag = parseBag(user.liveActivity);

    // Tam temizleme
    if (activity === null && opts?.force) {
      user.liveActivity = { _v: 2, bySource: {} } as unknown as Record<string, unknown>;
      await this.em.save(User, user);
      this.emitPresence(user, []);
      return null;
    }

    if (activity === null) {
      // Kaynaksız null — birincil kaynağı temizle (geriye uyum)
      const list = this.listFromBag(user, bag, true);
      const primary = list[0];
      if (primary?.source) delete bag.bySource[primary.source];
      user.liveActivity = bag as unknown as Record<string, unknown>;
      await this.em.save(User, user);
      const publicList = this.listFromBag(user, bag, false);
      this.emitPresence(user, publicList);
      return this.primaryOf(publicList);
    }

    const source = activity.source;
    const current = bag.bySource[source] ?? null;

    // Aynı içerik: TTL yenile, gereksiz broadcast yok
    if (
      current &&
      !this.isExpired(current) &&
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
      bag.bySource[source] = renewed;
      user.liveActivity = bag as unknown as Record<string, unknown>;
      await this.em.save(User, user);
      return this.primaryOf(this.listFromBag(user, bag, false));
    }

    const next: UserActivity = {
      ...activity,
      startedAt:
        current?.name === activity.name
          ? current.startedAt ?? activity.startedAt
          : activity.startedAt,
    };
    bag.bySource[source] = next;
    user.liveActivity = bag as unknown as Record<string, unknown>;
    await this.em.save(User, user);

    const publicList = this.listFromBag(user, bag, false);
    this.emitPresence(user, publicList);
    return this.primaryOf(publicList);
  }

  async clearActivity(userId: string, source?: UserActivitySource) {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) return;
    const bag = parseBag(user.liveActivity);
    if (source) {
      delete bag.bySource[source];
      user.liveActivity = bag as unknown as Record<string, unknown>;
      await this.em.save(User, user);
      const publicList = this.listFromBag(user, bag, false);
      this.emitPresence(user, publicList);
      return;
    }
    await this.setActivity(userId, null, { force: true });
  }

  resolveLiveActivity(user: User): UserActivity | null {
    const bag = parseBag(user.liveActivity);
    return this.primaryOf(this.listFromBag(user, bag, false));
  }

  resolveLiveActivities(user: User, forSelf = false): UserActivity[] {
    const bag = parseBag(user.liveActivity);
    return this.listFromBag(user, bag, forSelf);
  }
}
