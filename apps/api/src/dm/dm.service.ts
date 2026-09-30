import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ChannelSummary, PresenceStatus } from '@dracord/types';
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
    if (other.isBot) {
      throw new BadRequestException('Bot’a DM açılamaz');
    }

    // Self-DM (notlar)
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

    const myMemberships = await this.em.find(DMChannelMember, {
      where: { userId },
    });
    for (const m of myMemberships) {
      const otherMember = await this.em.findOne(DMChannelMember, {
        where: { dmChannelId: m.dmChannelId, userId: otherUserId },
      });
      if (!otherMember) continue;
      const count = await this.em.count(DMChannelMember, {
        where: { dmChannelId: m.dmChannelId },
      });
      if (count !== 2) continue;
      const channel = await this.em.findOne(Channel, {
        where: { dmChannelId: m.dmChannelId, type: ChannelType.TEXT },
      });
      if (channel) return this.toSummary(channel, other.displayName);
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
    const myMemberships = await this.em.find(DMChannelMember, { where: { userId } });
    for (const m of myMemberships) {
      const count = await this.em.count(DMChannelMember, {
        where: { dmChannelId: m.dmChannelId },
      });
      if (count !== 1) continue;
      const channel = await this.em.findOne(Channel, {
        where: { dmChannelId: m.dmChannelId, type: ChannelType.TEXT },
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

  async listForUser(userId: string): Promise<ChannelSummary[]> {
    const memberships = await this.em.find(DMChannelMember, { where: { userId } });
    const out: ChannelSummary[] = [];
    const channelRows: Channel[] = [];
    for (const m of memberships) {
      const channel = await this.em.findOne(Channel, {
        where: { dmChannelId: m.dmChannelId, type: ChannelType.TEXT },
      });
      if (!channel) continue;
      channelRows.push(channel);
      const others = await this.em.find(DMChannelMember, {
        where: { dmChannelId: m.dmChannelId },
        relations: { user: true },
      });
      const isSelfNotes = others.length === 1 && others[0]?.userId === userId;
      const peer = others.find((o) => o.userId !== userId);
      out.push(
        this.toSummary(
          channel,
          isSelfNotes ? 'Notlarım' : (peer?.user?.displayName ?? channel.name),
          isSelfNotes,
          peer?.user
            ? {
                peerUserId: peer.user.id,
                peerAvatarUrl: peer.user.avatarUrl,
                peerStatus: peer.user.status,
              }
            : undefined,
        ),
      );
    }
    const unreadMap = await this.channels.unreadByChannelIds(
      userId,
      channelRows.map((c) => c.id),
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

    // Aynı sunucudaki üyeler birbirine DM açabilir (Discord benzeri)
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
      selfNotes: selfNotes || undefined,
      peerUserId: peer?.peerUserId,
      peerAvatarUrl: peer?.peerAvatarUrl,
      peerStatus: peer?.peerStatus,
    };
  }
}
