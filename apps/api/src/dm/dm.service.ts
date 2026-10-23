import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ChannelSummary,
  PresenceStatus,
  UserActivity,
} from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@/bot/bot.constants';
import { toPublicUser } from '@/common/user.mapper';
import { EntityManager, In } from 'typeorm';
import { ChannelsService } from '@/channels/channels.service';
import { Channel } from '@/database/entities/channel.entity';
import { DMChannel } from '@/database/entities/dm-channel.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Friendship } from '@/database/entities/friendship.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType, FriendshipStatus } from '@/database/enums';
import { SearchIndexerService } from '@/search/search-indexer.service';
import { mergeClientSettings } from '@/users/client-settings';

@Injectable()
export class DmService {
  constructor(
    private readonly em: EntityManager,
    private readonly indexer: SearchIndexerService,
    private readonly channels: ChannelsService,
  ) {}

  async openOrCreate(userId: string, otherUserId: string): Promise<ChannelSummary> {
    const other = await this.em.findOne(User, { where: { id: otherUserId } });
    if (!other) throw new NotFoundException('Kullanıcı bulunamadı');
    if (other.isBot || other.id === DRACORD_BOT_USER_ID) {
      throw new BadRequestException('Bot’a DM açılamaz');
    }

    if (userId === otherUserId) {
      return this.openOrCreateSelfNotes(userId);
    }

    const blocked = await this.em.findOne(Friendship, {
      where: [
        { userId: otherUserId, friendId: userId, status: FriendshipStatus.BLOCKED },
        { userId, friendId: otherUserId, status: FriendshipStatus.BLOCKED },
      ],
    });
    if (blocked) {
      throw new BadRequestException('Bu kullanıcıyla DM açılamaz');
    }

    await this.assertDmAllowed(userId, other);

    // Ortak 1:1 DM: her iki kullanıcının da üye olduğu ve tam 2 üyeli kanal
    const existing = await this.em.query(
      `SELECT m1."dmChannelId" AS id
       FROM dm_channel_members m1
       INNER JOIN dm_channel_members m2
         ON m2."dmChannelId" = m1."dmChannelId" AND m2."userId" = $2
       WHERE m1."userId" = $1
         AND (
           SELECT COUNT(*) FROM dm_channel_members c
           WHERE c."dmChannelId" = m1."dmChannelId"
         ) = 2
       LIMIT 1`,
      [userId, otherUserId],
    );
    const existingId = (existing as Array<{ id: string }>)[0]?.id;
    if (existingId) {
      // Liste’den gizlenmişse tekrar aç
      await this.em.update(
        DMChannelMember,
        { dmChannelId: existingId, userId },
        { hiddenAt: null },
      );
      const channel = await this.em.findOne(Channel, {
        where: { dmChannelId: existingId, type: ChannelType.TEXT },
      });
      if (channel) {
        const pub = toPublicUser(other, { viewerId: userId });
        return this.toSummary(channel, other.displayName, false, {
          peerUserId: other.id,
          peerAvatarUrl: pub.avatarUrl,
          peerStatus: pub.status,
          peerActivity: pub.activity ?? null,
          peerActivities: pub.activities ?? null,
        });
      }
    }

    const dm = await this.em.save(DMChannel, this.em.create(DMChannel, {}));
    await this.em.save([
      this.em.create(DMChannelMember, { dmChannelId: dm.id, userId }),
      this.em.create(DMChannelMember, { dmChannelId: dm.id, userId: otherUserId }),
    ]);

    const channel = await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId: null,
        dmChannelId: dm.id,
        name: other.displayName,
        type: ChannelType.TEXT,
        categoryId: null,
        position: 0,
        topic: null,
      }),
    );

    void this.indexer.indexChannel(channel).catch(() => undefined);

    return this.toSummary(channel, other.displayName);
  }

  private async openOrCreateSelfNotes(userId: string): Promise<ChannelSummary> {
    const existing = await this.em.query(
      `SELECT m."dmChannelId" AS id
       FROM dm_channel_members m
       WHERE m."userId" = $1
         AND (
           SELECT COUNT(*) FROM dm_channel_members c
           WHERE c."dmChannelId" = m."dmChannelId"
         ) = 1
       LIMIT 1`,
      [userId],
    );
    const existingId = (existing as Array<{ id: string }>)[0]?.id;
    if (existingId) {
      const channel = await this.em.findOne(Channel, {
        where: { dmChannelId: existingId, type: ChannelType.TEXT },
      });
      if (channel) return this.toSummary(channel, 'Notlarım', true);
    }

    const dm = await this.em.save(DMChannel, this.em.create(DMChannel, {}));
    await this.em.save(
      this.em.create(DMChannelMember, { dmChannelId: dm.id, userId }),
    );

    const channel = await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId: null,
        dmChannelId: dm.id,
        name: 'Notlarım',
        type: ChannelType.TEXT,
        categoryId: null,
        position: 0,
        topic: 'Kendine notlar',
      }),
    );

    void this.indexer.indexChannel(channel).catch(() => undefined);
    return this.toSummary(channel, 'Notlarım', true);
  }

  /** DM’i kendi listesinden gizle (karşı taraf etkilenmez) */
  async closeForUser(userId: string, channelId: string): Promise<{ ok: true }> {
    const channel = await this.em.findOne(Channel, {
      where: { id: channelId, type: ChannelType.TEXT },
    });
    if (!channel?.dmChannelId) throw new NotFoundException('DM bulunamadı');
    const member = await this.em.findOne(DMChannelMember, {
      where: { dmChannelId: channel.dmChannelId, userId },
    });
    if (!member) throw new ForbiddenException('Bu DM’e erişimin yok');
    member.hiddenAt = new Date();
    await this.em.save(DMChannelMember, member);
    return { ok: true };
  }

  async listForUser(userId: string): Promise<ChannelSummary[]> {
    const visible = await this.em
      .createQueryBuilder(DMChannelMember, 'm')
      .select('m.dmChannelId', 'dmChannelId')
      .where('m.userId = :userId', { userId })
      .andWhere('m.hiddenAt IS NULL')
      .getRawMany<{ dmChannelId: string }>();
    if (!visible.length) return [];

    const dmIds = visible.map((m) => m.dmChannelId);
    const [channels, allMembers] = await Promise.all([
      this.em.find(Channel, {
        where: { dmChannelId: In(dmIds), type: ChannelType.TEXT },
      }),
      this.em.find(DMChannelMember, {
        where: { dmChannelId: In(dmIds) },
        relations: { user: true },
      }),
    ]);

    const membersByDm = new Map<string, DMChannelMember[]>();
    for (const m of allMembers) {
      const list = membersByDm.get(m.dmChannelId) ?? [];
      list.push(m);
      membersByDm.set(m.dmChannelId, list);
    }

    const out: ChannelSummary[] = [];
    for (const channel of channels) {
      if (!channel.dmChannelId) continue;
      const others = membersByDm.get(channel.dmChannelId) ?? [];
      const isSelfNotes = others.length === 1 && others[0]?.userId === userId;
      const peer = others.find((o) => o.userId !== userId);
      out.push(
        this.toSummary(
          channel,
          isSelfNotes ? 'Notlarım' : (peer?.user?.displayName ?? channel.name),
          isSelfNotes,
          peer?.user
            ? (() => {
                const pub = toPublicUser(peer.user, { viewerId: userId });
                return {
                  peerUserId: peer.user.id,
                  peerAvatarUrl: pub.avatarUrl,
                  peerStatus: pub.status,
                  peerActivity: pub.activity ?? null,
                  peerActivities: pub.activities ?? null,
                };
              })()
            : undefined,
        ),
      );
    }

    const unreadMap = await this.channels.unreadByChannelIds(
      userId,
      channels.map((c) => c.id),
    );
    return out.map((s) => {
      const count = unreadMap.get(s.id) ?? 0;
      return { ...s, unread: count > 0, unreadCount: count };
    });
  }

  private async assertDmAllowed(fromUserId: string, other: User): Promise<void> {
    if (other.disabledAt) {
      throw new ForbiddenException('Bu hesap kullanılamıyor');
    }
    const settings = mergeClientSettings(other.clientSettings);
    const level = settings.messaging.whoCanDm ?? settings.privacy.dmFilter;
    if (level === 'nobody') {
      throw new ForbiddenException('Bu kullanıcı DM kabul etmiyor');
    }
    if (level === 'everyone') return;

    const friendship = await this.em.findOne(Friendship, {
      where: [
        { userId: fromUserId, friendId: other.id, status: FriendshipStatus.ACCEPTED },
        { userId: other.id, friendId: fromUserId, status: FriendshipStatus.ACCEPTED },
      ],
    });
    if (friendship) return;

    const myGuilds = await this.em.find(GuildMember, {
      where: { userId: fromUserId },
      select: { guildId: true },
    });
    const guildIds = myGuilds.map((m) => m.guildId);
    if (guildIds.length > 0) {
      const shared = await this.em.findOne(GuildMember, {
        where: { userId: other.id, guildId: In(guildIds) },
      });
      if (shared) return;
    }

    throw new BadRequestException(
      'Yalnızca arkadaşlarınla veya ortak sunucu üyeleriyle DM açabilirsin',
    );
  }

  private toSummary(
    channel: Channel,
    displayName: string,
    selfNotes = false,
    peer?: {
      peerUserId: string;
      peerAvatarUrl: string | null;
      peerStatus: PresenceStatus;
      peerActivity?: UserActivity | null;
      peerActivities?: UserActivity[] | null;
    },
  ): ChannelSummary {
    return {
      id: channel.id,
      guildId: null,
      name: displayName,
      type: 'TEXT',
      categoryId: null,
      position: channel.position,
      topic: channel.topic,
      dmChannelId: channel.dmChannelId,
      selfNotes: selfNotes || undefined,
      peerUserId: peer?.peerUserId,
      peerAvatarUrl: peer?.peerAvatarUrl,
      peerStatus: peer?.peerStatus,
      peerActivity: peer?.peerActivity ?? null,
      peerActivities: peer?.peerActivities ?? null,
    };
  }
}
