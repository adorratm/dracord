import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { PublicUser, UserActivity, UserActivitySource } from '@dracord/types';
import { toPublicUser } from '@/common/user.mapper';
import { User } from '@/database/entities/user.entity';
import { UserStatus } from '@/database/enums';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { SpotifyService } from '@/spotify/spotify.service';
import { UserActivityService } from './user-activity.service';

@Injectable()
export class PresenceService {
  constructor(
    private readonly em: EntityManager,
    private readonly broadcast: SocketBroadcastService,
    private readonly activities: UserActivityService,
    @Inject(forwardRef(() => SpotifyService))
    private readonly spotify: SpotifyService,
  ) {}

  async updateStatus(
    userId: string,
    status: UserStatus,
    opts?: { customStatus?: string | null; manual?: boolean },
  ): Promise<PublicUser> {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    user.status = status;
    if (opts?.manual) {
      // OFFLINE manuel seçilmez; IDLE/DND/ONLINE tercih olarak saklanır
      user.preferredStatus =
        status === UserStatus.OFFLINE ? UserStatus.ONLINE : status;
    }
    if (opts?.customStatus !== undefined) {
      const trimmed = opts.customStatus?.trim().slice(0, 128) || null;
      user.customStatus = trimmed;
    }
    const updated = await this.em.save(User, user);
    const pub = toPublicUser(updated);
    this.broadcast.broadcastPresence({
      userId,
      status: updated.status,
      customStatus: updated.customStatus,
      activity: pub.activity ?? null,
      activities: pub.activities ?? null,
    });
    return pub;
  }

  async putManualActivity(
    userId: string,
    activity: UserActivity | null,
  ): Promise<PublicUser> {
    await this.activities.setActivity(userId, activity, { force: true });
    return this.getStatus(userId);
  }

  async clearActivitySource(userId: string, source: UserActivitySource): Promise<void> {
    await this.activities.clearActivity(userId, source);
    // Masaüstü oyun bitince Spotify dinlemeyi hemen geri yükle
    if (source === 'desktop' || source === 'dracord') {
      void this.spotify.refreshListening(userId).catch(() => undefined);
    }
  }

  /** Socket bağlandığında: tercih edilen durum veya ONLINE. */
  async markConnected(userId: string): Promise<PublicUser> {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    const preferred = user.preferredStatus;
    if (
      preferred === UserStatus.IDLE ||
      preferred === UserStatus.DND ||
      preferred === UserStatus.ONLINE
    ) {
      user.status = preferred;
    } else {
      user.status = UserStatus.ONLINE;
      user.preferredStatus = UserStatus.ONLINE;
    }
    const updated = await this.em.save(User, user);
    return toPublicUser(updated);
  }

  /** Son socket koptuğunda çevrimdışı göster (tercih saklanır). */
  async markDisconnected(userId: string): Promise<PublicUser> {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    user.status = UserStatus.OFFLINE;
    const updated = await this.em.save(User, user);
    return toPublicUser(updated);
  }

  async getStatus(userId: string): Promise<PublicUser> {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    return toPublicUser(user);
  }
}
