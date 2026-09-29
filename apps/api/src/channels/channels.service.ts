import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EntityManager, In } from 'typeorm';
import type { ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import { GuildsService, PERM_MANAGE_CHANNELS } from '@/guilds/guilds.service';
import { Channel } from '@/database/entities/channel.entity';
import { ChannelReadState } from '@/database/entities/channel-read-state.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Guild } from '@/database/entities/guild.entity';
import { ChannelType } from '@/database/enums';
import { VoicePresenceService } from '@/voice/voice-presence.service';
import { SearchIndexerService } from '@/search/search-indexer.service';

export type ChannelUpdateInput = {
  name?: string;
  topic?: string | null;
  categoryId?: string | null;
  locked?: boolean;
  /** Düz şifre; null/'' = şifreyi kaldır */
  password?: string | null;
  deniedUserIds?: string[];
};

@Injectable()
export class ChannelsService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly voicePresence: VoicePresenceService,
    private readonly indexer: SearchIndexerService,
  ) {}

  async listGuildChannels(guildId: string, userId: string): Promise<ChannelSummary[]> {
    await this.guilds.ensureMember(guildId, userId);
    const channels = await this.em.find(Channel, {
      where: { guildId },
      order: { categoryId: 'ASC', position: 'ASC' },
    });
    const voiceMap = await this.voicePresence.listGuildVoice(guildId);
    const unreadMap = await this.unreadByChannelIds(
      userId,
      channels.filter((c) => c.type === ChannelType.TEXT).map((c) => c.id),
    );
    const canManage = await this.canManageChannels(guildId, userId);
    return channels.map((c) =>
      this.toSummary(
        c,
        {
          voiceMembers: c.type === ChannelType.VOICE ? voiceMap[c.id] : undefined,
          unread: c.type === ChannelType.TEXT ? unreadMap.get(c.id) : undefined,
          includeDenied: canManage,
        },
      ),
    );
  }

  async getChannel(channelId: string, userId: string): Promise<ChannelSummary> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.guildId) {
      await this.guilds.ensureMember(channel.guildId, userId);
    } else if (channel.dmChannelId) {
      const member = await this.em.findOne(DMChannelMember, {
        where: { dmChannelId: channel.dmChannelId, userId },
      });
      if (!member) throw new ForbiddenException('Not a participant in this DM');
    }
    let voiceMembers: VoiceMemberSummary[] | undefined;
    if (channel.type === ChannelType.VOICE && channel.guildId) {
      voiceMembers = await this.voicePresence.listChannel(channel.guildId, channel.id);
    }
    const canManage = channel.guildId
      ? await this.canManageChannels(channel.guildId, userId)
      : false;
    return this.toSummary(channel, { voiceMembers, includeDenied: canManage });
  }

  async createChannel(
    guildId: string,
    userId: string,
    data: {
      name: string;
      type: 'TEXT' | 'VOICE';
      categoryId?: string | null;
      topic?: string | null;
    },
  ): Promise<ChannelSummary> {
    await this.guilds.requirePermission(guildId, userId, 'MANAGE_CHANNELS');
    const name =
      data.type === 'VOICE'
        ? data.name.trim().slice(0, 100)
        : data.name.trim().replace(/\s+/g, '-').toLowerCase().slice(0, 100);
    if (!name) throw new BadRequestException('Kanal adı gerekli');
    const last = await this.em.findOne(Channel, {
      where: { guildId },
      order: { position: 'DESC' },
    });
    const maxPos = last?.position ?? -1;
    const channel = await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId,
        name,
        type: data.type === 'VOICE' ? ChannelType.VOICE : ChannelType.TEXT,
        categoryId: data.categoryId ?? null,
        topic: data.topic ?? null,
        position: maxPos + 1,
        locked: false,
        passwordHash: null,
        deniedUserIds: null,
      }),
    );
    void this.indexer.indexChannel(channel).catch(() => undefined);
    return this.toSummary(channel, { includeDenied: true });
  }

  async updateChannel(
    channelId: string,
    userId: string,
    data: ChannelUpdateInput,
  ): Promise<ChannelSummary> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) throw new NotFoundException('Channel not found');
    await this.guilds.requirePermission(channel.guildId, userId, 'MANAGE_CHANNELS');
    if (data.name != null) {
      channel.name =
        channel.type === ChannelType.VOICE
          ? data.name.trim().slice(0, 100)
          : data.name.trim().replace(/\s+/g, '-').toLowerCase().slice(0, 100);
    }
    if (data.topic !== undefined) channel.topic = data.topic;
    if (data.categoryId !== undefined) channel.categoryId = data.categoryId;
    if (data.locked !== undefined) channel.locked = Boolean(data.locked);
    if (data.password !== undefined) {
      const plain = data.password?.trim() ?? '';
      if (!plain) {
        channel.passwordHash = null;
      } else {
        channel.passwordHash = await bcrypt.hash(plain, 10);
        channel.locked = true;
      }
    }
    if (data.deniedUserIds !== undefined) {
      channel.deniedUserIds = [...new Set(data.deniedUserIds.filter(Boolean))];
    }
    if (channel.locked === false && data.password === undefined) {
      // kilit kapatılırsa şifreyi de temizle (açıkça password verilmediyse)
      if (data.locked === false) channel.passwordHash = null;
    }
    await this.em.save(Channel, channel);
    return this.toSummary(channel, { includeDenied: true });
  }

  async deleteChannel(channelId: string, userId: string): Promise<void> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) throw new NotFoundException('Channel not found');
    await this.guilds.requirePermission(channel.guildId, userId, 'MANAGE_CHANNELS');
    await this.em.remove(Channel, channel);
  }

  /** Ses token / join öncesi erişim kontrolü */
  async assertVoiceAccess(
    channelId: string,
    userId: string,
    password?: string | null,
  ): Promise<Channel> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.type !== ChannelType.VOICE) {
      throw new BadRequestException('Channel is not a voice channel');
    }
    if (channel.guildId) {
      await this.guilds.ensureMember(channel.guildId, userId);
    }
    const denied = channel.deniedUserIds ?? [];
    if (denied.includes(userId)) {
      throw new ForbiddenException('Bu odaya girmen engellendi');
    }
    const canBypass =
      channel.guildId != null &&
      (await this.canManageChannels(channel.guildId, userId));
    if (channel.locked && !canBypass) {
      if (!channel.passwordHash) {
        throw new ForbiddenException('Bu oda kilitli');
      }
      const ok = password
        ? await bcrypt.compare(password, channel.passwordHash)
        : false;
      if (!ok) {
        throw new ForbiddenException('Oda şifresi gerekli veya hatalı');
      }
    }
    return channel;
  }

  async denyUserFromVoice(
    channelId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<ChannelSummary> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) throw new NotFoundException('Channel not found');
    if (channel.type !== ChannelType.VOICE) {
      throw new BadRequestException('Yalnızca ses kanalları için geçerli');
    }
    await this.guilds.requirePermission(channel.guildId, actorId, 'MANAGE_CHANNELS');
    const list = new Set(channel.deniedUserIds ?? []);
    list.add(targetUserId);
    channel.deniedUserIds = [...list];
    await this.em.save(Channel, channel);
    return this.toSummary(channel, { includeDenied: true });
  }

  async allowUserVoice(
    channelId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<ChannelSummary> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel?.guildId) throw new NotFoundException('Channel not found');
    await this.guilds.requirePermission(channel.guildId, actorId, 'MANAGE_CHANNELS');
    channel.deniedUserIds = (channel.deniedUserIds ?? []).filter((id) => id !== targetUserId);
    await this.em.save(Channel, channel);
    return this.toSummary(channel, { includeDenied: true });
  }

  /** TEXT kanallar için okunmamış bayrağı (en son mesaj ≠ lastRead). */
  async unreadByChannelIds(
    userId: string,
    channelIds: string[],
  ): Promise<Map<string, boolean>> {
    const map = new Map<string, boolean>();
    if (channelIds.length === 0) return map;

    const states = await this.em.find(ChannelReadState, {
      where: { userId, channelId: In(channelIds) },
    });
    const lastRead = new Map(
      states.map((s) => [s.channelId, s.lastReadMessageId] as const),
    );

    const latestRows = (await this.em.query(
      `SELECT DISTINCT ON ("channelId") "channelId", id
       FROM messages
       WHERE "channelId" = ANY($1) AND "deletedAt" IS NULL
       ORDER BY "channelId", "createdAt" DESC`,
      [channelIds],
    )) as Array<{ channelId: string; id: string }>;

    for (const row of latestRows) {
      const readId = lastRead.get(row.channelId) ?? null;
      map.set(row.channelId, !readId || readId !== row.id);
    }
    for (const id of channelIds) {
      if (!map.has(id)) map.set(id, false);
    }
    return map;
  }

  private async canManageChannels(guildId: string, userId: string): Promise<boolean> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) return false;
    if (guild.ownerId === userId) return true;
    return this.guilds.memberHasPermission(guildId, userId, PERM_MANAGE_CHANNELS);
  }

  private toSummary(
    channel: Channel,
    opts?: {
      voiceMembers?: VoiceMemberSummary[];
      unread?: boolean;
      includeDenied?: boolean;
    },
  ): ChannelSummary {
    const isVoice = channel.type === ChannelType.VOICE;
    return {
      id: channel.id,
      guildId: channel.guildId,
      name: channel.name,
      type: channel.type,
      categoryId: channel.categoryId,
      position: channel.position,
      topic: channel.topic ?? null,
      voiceMembers: opts?.voiceMembers,
      unread: opts?.unread,
      locked: isVoice ? Boolean(channel.locked) : undefined,
      hasPassword: isVoice ? Boolean(channel.passwordHash) : undefined,
      deniedUserIds:
        isVoice && opts?.includeDenied ? (channel.deniedUserIds ?? []) : undefined,
    };
  }
}
