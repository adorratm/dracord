import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type { ChannelSummary, GuildSummary, PublicUser, VoiceMemberSummary } from '@dracord/types';
import { toPublicUser } from '@/common/user.mapper';
import { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Message } from '@/database/entities/message.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { VoicePresenceService } from '@/voice/voice-presence.service';

export type PlatformAdminGuildDetail = GuildSummary & {
  memberCount: number;
  channelCount: number;
};

export type PlatformAdminMessageRow = {
  id: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type PlatformAdminVoiceRow = {
  channelId: string;
  channelName: string;
  members: VoiceMemberSummary[];
  screenSharers: VoiceMemberSummary[];
};

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly em: EntityManager,
    private readonly voicePresence: VoicePresenceService,
  ) {}

  private toGuildSummary(guild: Guild): GuildSummary {
    return {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconUrl,
      bannerUrl: guild.bannerUrl ?? null,
      ownerId: guild.ownerId,
      discoverable: guild.discoverable,
      afkChannelId: guild.afkChannelId ?? null,
      afkTimeoutMinutes: guild.afkTimeoutMinutes ?? 0,
    };
  }

  async listGuilds(): Promise<PlatformAdminGuildDetail[]> {
    const guilds = await this.em.find(Guild, { order: { name: 'ASC' } });
    const out: PlatformAdminGuildDetail[] = [];
    for (const g of guilds) {
      const memberCount = await this.em.count(GuildMember, { where: { guildId: g.id } });
      const channelCount = await this.em.count(Channel, { where: { guildId: g.id } });
      out.push({
        ...this.toGuildSummary(g),
        memberCount,
        channelCount,
      });
    }
    return out;
  }

  async getGuild(guildId: string): Promise<PlatformAdminGuildDetail> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    const memberCount = await this.em.count(GuildMember, { where: { guildId } });
    const channelCount = await this.em.count(Channel, { where: { guildId } });
    return {
      ...this.toGuildSummary(guild),
      memberCount,
      channelCount,
    };
  }

  async listChannels(guildId: string): Promise<ChannelSummary[]> {
    await this.getGuild(guildId);
    const channels = await this.em.find(Channel, {
      where: { guildId },
      order: { position: 'ASC', name: 'ASC' },
    });
    return channels.map((c) => ({
      id: c.id,
      guildId: c.guildId,
      name: c.name,
      type:
        c.type === ChannelType.VOICE
          ? 'VOICE'
          : c.type === ChannelType.FORUM
            ? 'FORUM'
            : 'TEXT',
      topic: c.topic,
      categoryId: c.categoryId,
      position: c.position,
      locked: c.type === ChannelType.VOICE ? Boolean(c.locked) : undefined,
      hasPassword: c.type === ChannelType.VOICE ? Boolean(c.passwordHash) : undefined,
    }));
  }

  async listMembers(guildId: string): Promise<PublicUser[]> {
    await this.getGuild(guildId);
    const members = await this.em.find(GuildMember, {
      where: { guildId },
      relations: { user: true },
      take: 500,
      order: { joinedAt: 'ASC' },
    });
    return members.filter((m) => m.user).map((m) => toPublicUser(m.user!));
  }

  async listRecentMessages(
    guildId: string,
    limit = 50,
  ): Promise<PlatformAdminMessageRow[]> {
    await this.getGuild(guildId);
    const channels = await this.em.find(Channel, {
      where: { guildId },
      select: { id: true, name: true },
    });
    if (!channels.length) return [];
    const channelIds = channels.map((c) => c.id);
    const nameById = new Map(channels.map((c) => [c.id, c.name]));
    const take = Math.max(1, Math.min(200, Math.floor(limit)));
    const messages = await this.em.find(Message, {
      where: { channelId: In(channelIds) },
      order: { createdAt: 'DESC' },
      take,
    });
    const authorIds = [...new Set(messages.map((m) => m.authorId))];
    const authors =
      authorIds.length === 0
        ? []
        : await this.em.find(User, { where: { id: In(authorIds) } });
    const authorById = new Map(authors.map((u) => [u.id, u]));
    return messages.map((m) => {
      const author = authorById.get(m.authorId);
      return {
        id: m.id,
        channelId: m.channelId,
        channelName: nameById.get(m.channelId) ?? m.channelId,
        authorId: m.authorId,
        authorName: author?.displayName || author?.username || m.authorId,
        content: m.content.slice(0, 500),
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  async listVoice(guildId: string): Promise<PlatformAdminVoiceRow[]> {
    await this.getGuild(guildId);
    const voiceMap = await this.voicePresence.listGuildVoice(guildId);
    const channelIds = Object.keys(voiceMap);
    if (!channelIds.length) return [];
    const channels = await this.em.find(Channel, {
      where: { id: In(channelIds) },
    });
    const nameById = new Map(channels.map((c) => [c.id, c.name]));
    return channelIds.map((channelId) => {
      const members = voiceMap[channelId] ?? [];
      return {
        channelId,
        channelName: nameById.get(channelId) ?? channelId,
        members,
        screenSharers: members.filter((m) => m.screenSharing),
      };
    });
  }
}
