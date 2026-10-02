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
import { GuildPermissions } from '@/common/permissions';
import { Channel } from '@/database/entities/channel.entity';
import { ChannelReadState } from '@/database/entities/channel-read-state.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { ChannelType } from '@/database/enums';
import { VoicePresenceService } from '@/voice/voice-presence.service';
import { SearchIndexerService } from '@/search/search-indexer.service';

export type ChannelUpdateInput = {
  name?: string;
  topic?: string | null;
  categoryId?: string | null;
  position?: number;
  locked?: boolean;
  /** Düz şifre; null/'' = şifreyi kaldır */
  password?: string | null;
  deniedUserIds?: string[];
  permissionOverwrites?: ChannelOverwriteDto[] | null;
};

export type ChannelOverwriteDto = {
  id: string;
  type: 'role' | 'member';
  allow: string[];
  deny: string[];
};

export const CHANNEL_OVERWRITE_PERMS = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'CONNECT',
  'SPEAK',
] as const;

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
      channels
        .filter((c) => c.type === ChannelType.TEXT || c.type === ChannelType.FORUM)
        .map((c) => c.id),
    );
    const canManage = await this.canManageChannels(guildId, userId);
    const summaries = await Promise.all(
      channels.map(async (c) => {
        const canView = canManage || (await this.memberCanInChannel(c, userId, 'VIEW_CHANNEL'));
        if (!canView) return null;
        return this.toSummary(c, {
          voiceMembers: c.type === ChannelType.VOICE ? voiceMap[c.id] : undefined,
          unreadCount:
            c.type === ChannelType.TEXT || c.type === ChannelType.FORUM
              ? unreadMap.get(c.id)
              : undefined,
          includeDenied: canManage,
        });
      }),
    );
    return summaries.filter((s): s is ChannelSummary => Boolean(s));
  }

  async getChannel(channelId: string, userId: string): Promise<ChannelSummary> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    let canManage = false;
    if (channel.guildId) {
      await this.guilds.ensureMember(channel.guildId, userId);
      canManage = await this.canManageChannels(channel.guildId, userId);
      if (!canManage) {
        const canView = await this.memberCanInChannel(channel, userId, 'VIEW_CHANNEL');
        if (!canView) throw new ForbiddenException('Bu kanalı görme yetkin yok');
      }
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
    return this.toSummary(channel, { voiceMembers, includeDenied: canManage });
  }

  async createChannel(
    guildId: string,
    userId: string,
    data: {
      name: string;
      type: 'TEXT' | 'VOICE' | 'FORUM';
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
    const channelType =
      data.type === 'VOICE'
        ? ChannelType.VOICE
        : data.type === 'FORUM'
          ? ChannelType.FORUM
          : ChannelType.TEXT;
    const channel = await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId,
        name,
        type: channelType,
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
    if (data.position !== undefined) {
      channel.position = data.position;
    }
    if (data.permissionOverwrites !== undefined) {
      channel.permissionOverwrites = data.permissionOverwrites;
    }
    if (channel.locked === false && data.password === undefined) {
      // kilit kapatılırsa şifreyi de temizle (açıkça password verilmediyse)
      if (data.locked === false) channel.passwordHash = null;
    }
    await this.em.save(Channel, channel);
    return this.toSummary(channel, { includeDenied: true });
  }

  async reorderChannels(
    guildId: string,
    userId: string,
    items: Array<{ id: string; position: number; categoryId?: string | null }>,
  ): Promise<ChannelSummary[]> {
    await this.guilds.requirePermission(guildId, userId, 'MANAGE_CHANNELS');
    if (!items.length) return this.listGuildChannels(guildId, userId);
    const ids = items.map((i) => i.id);
    const channels = await this.em.find(Channel, {
      where: { guildId, id: In(ids) },
    });
    const byId = new Map(channels.map((c) => [c.id, c]));
    for (const item of items) {
      const ch = byId.get(item.id);
      if (!ch) continue;
      ch.position = item.position;
      if (item.categoryId !== undefined) ch.categoryId = item.categoryId;
    }
    await this.em.save(Channel, [...byId.values()]);
    return this.listGuildChannels(guildId, userId);
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

    // DM araması: TEXT + dmChannelId
    if (channel.dmChannelId && channel.type === ChannelType.TEXT) {
      const member = await this.em.findOne(DMChannelMember, {
        where: { dmChannelId: channel.dmChannelId, userId },
      });
      if (!member) throw new ForbiddenException('Bu DM’nin üyesi değilsin');
      return channel;
    }

    if (channel.type !== ChannelType.VOICE) {
      throw new BadRequestException('Channel is not a voice channel');
    }
    if (channel.guildId) {
      await this.guilds.ensureMember(channel.guildId, userId);
      const canConnect = await this.memberCanInChannel(channel, userId, 'CONNECT');
      if (!canConnect) {
        throw new ForbiddenException('Bu ses kanalına bağlanma iznin yok');
      }
    }
    const denied = channel.deniedUserIds ?? [];
    if (denied.includes(userId)) {
      throw new ForbiddenException('Bu odaya girmen engellendi');
    }
    const canBypass =
      channel.guildId != null &&
      ((await this.canManageChannels(channel.guildId, userId)) ||
        (await this.guilds.memberHasPermission(
          channel.guildId,
          userId,
          GuildPermissions.ADMINISTRATOR,
        )));
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

  /** TEXT kanallar için okunmamış sayısı (lastRead sonrası mesajlar). */
  async unreadByChannelIds(
    userId: string,
    channelIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (channelIds.length === 0) return map;

    const states = await this.em.find(ChannelReadState, {
      where: { userId, channelId: In(channelIds) },
    });
    const lastRead = new Map(
      states.map((s) => [s.channelId, s.lastReadMessageId] as const),
    );

    for (const channelId of channelIds) {
      const readId = lastRead.get(channelId) ?? null;
      if (!readId) {
        const rows = (await this.em.query(
          `SELECT COUNT(*)::int AS c FROM messages
           WHERE "channelId" = $1 AND "deletedAt" IS NULL
             AND "threadRootId" IS NULL`,
          [channelId],
        )) as Array<{ c: number }>;
        map.set(channelId, Number(rows[0]?.c ?? 0));
        continue;
      }
      const rows = (await this.em.query(
        `SELECT COUNT(*)::int AS c FROM messages m
         WHERE m."channelId" = $1 AND m."deletedAt" IS NULL
           AND m."threadRootId" IS NULL
           AND m."createdAt" > COALESCE(
             (SELECT m2."createdAt" FROM messages m2 WHERE m2.id = $2),
             '-infinity'::timestamptz
           )`,
        [channelId, readId],
      )) as Array<{ c: number }>;
      map.set(channelId, Number(rows[0]?.c ?? 0));
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
      unreadCount?: number;
      includeDenied?: boolean;
    },
  ): ChannelSummary {
    const isVoice = channel.type === ChannelType.VOICE;
    const unreadCount = opts?.unreadCount;
    const unread =
      opts?.unread ?? (unreadCount != null ? unreadCount > 0 : undefined);
    return {
      id: channel.id,
      guildId: channel.guildId,
      name: channel.name,
      type: channel.type,
      categoryId: channel.categoryId,
      position: channel.position,
      topic: channel.topic ?? null,
      voiceMembers: opts?.voiceMembers,
      unread,
      unreadCount,
      dmChannelId: channel.dmChannelId ?? null,
      locked: isVoice ? Boolean(channel.locked) : undefined,
      hasPassword: isVoice ? Boolean(channel.passwordHash) : undefined,
      deniedUserIds:
        isVoice && opts?.includeDenied ? (channel.deniedUserIds ?? []) : undefined,
      permissionOverwrites: channel.permissionOverwrites ?? undefined,
    };
  }

  /** Kanal overwrite + sunucu izni birleşimi */
  async memberCanInChannel(
    channel: Channel,
    userId: string,
    perm: 'VIEW_CHANNEL' | 'SEND_MESSAGES' | 'CONNECT' | 'SPEAK',
  ): Promise<boolean> {
    if (!channel.guildId) return true;
    const guild = await this.em.findOne(Guild, { where: { id: channel.guildId } });
    if (!guild) return false;
    if (guild.ownerId === userId) return true;
    // memberHasPermission platform admin için true döner
    if (
      await this.guilds.memberHasPermission(
        channel.guildId,
        userId,
        GuildPermissions.ADMINISTRATOR,
      )
    ) {
      return true;
    }

    const member = await this.em.findOne(GuildMember, {
      where: { guildId: channel.guildId, userId },
    });
    if (!member) return false;
    const roleIds = await this.guilds.resolveMemberRoleIds(channel.guildId, member.id);

    const overwrites = channel.permissionOverwrites ?? [];
    const memberOw = overwrites.find((o) => o.type === 'member' && o.id === userId);
    if (memberOw) {
      if (memberOw.deny?.includes(perm)) return false;
      if (memberOw.allow?.includes(perm)) return true;
    }
    let roleAllow = false;
    let roleDeny = false;
    for (const roleId of roleIds) {
      const ow = overwrites.find((o) => o.type === 'role' && o.id === roleId);
      if (!ow) continue;
      if (ow.deny?.includes(perm)) roleDeny = true;
      if (ow.allow?.includes(perm)) roleAllow = true;
    }
    if (roleDeny && !roleAllow) return false;
    if (roleAllow) return true;

    // Varsayılan: sunucu izni
    if (perm === 'VIEW_CHANNEL') {
      return this.guilds.memberHasPermission(
        channel.guildId,
        userId,
        GuildPermissions.VIEW_CHANNELS,
      );
    }
    if (perm === 'SEND_MESSAGES') {
      return this.guilds.memberHasPermission(
        channel.guildId,
        userId,
        GuildPermissions.SEND_MESSAGES,
      );
    }
    // CONNECT / SPEAK: üye olmak yeterli (overwrite yoksa)
    return true;
  }
}
