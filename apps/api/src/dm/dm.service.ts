import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ChannelSummary } from '@dracord/types';
import { EntityManager } from 'typeorm';
import { Channel } from '@/database/entities/channel.entity';
import { DMChannel } from '@/database/entities/dm-channel.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Friendship } from '@/database/entities/friendship.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType, FriendshipStatus } from '@/database/enums';
import { SearchIndexerService } from '@/search/search-indexer.service';

@Injectable()
export class DmService {
  constructor(
    private readonly em: EntityManager,
    private readonly indexer: SearchIndexerService,
  ) {}

  async openOrCreate(userId: string, otherUserId: string): Promise<ChannelSummary> {
    if (userId === otherUserId) {
      throw new BadRequestException('Kendine DM açılamaz');
    }
    const other = await this.em.findOne(User, { where: { id: otherUserId } });
    if (!other) throw new NotFoundException('Kullanıcı bulunamadı');

    const friendship = await this.em.findOne(Friendship, {
      where: [
        { userId, friendId: otherUserId, status: FriendshipStatus.ACCEPTED },
        { userId: otherUserId, friendId: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });
    if (!friendship) {
      throw new BadRequestException('Yalnızca arkadaşlarınla DM açabilirsin');
    }

    // Find existing 1:1 DM where both are members
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

  async listForUser(userId: string): Promise<ChannelSummary[]> {
    const memberships = await this.em.find(DMChannelMember, { where: { userId } });
    const out: ChannelSummary[] = [];
    for (const m of memberships) {
      const channel = await this.em.findOne(Channel, {
        where: { dmChannelId: m.dmChannelId, type: ChannelType.TEXT },
      });
      if (!channel) continue;
      const others = await this.em.find(DMChannelMember, {
        where: { dmChannelId: m.dmChannelId },
        relations: { user: true },
      });
      const peer = others.find((o) => o.userId !== userId);
      out.push(this.toSummary(channel, peer?.user?.displayName ?? channel.name));
    }
    return out;
  }

  private toSummary(channel: Channel, displayName: string): ChannelSummary {
    return {
      id: channel.id,
      guildId: null,
      name: displayName,
      type: 'TEXT',
      categoryId: null,
      position: channel.position,
      topic: channel.topic,
    };
  }
}
