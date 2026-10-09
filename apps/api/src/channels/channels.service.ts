import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EntityManager, In } from 'typeorm';
import type { ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import {
  GuildsService,
  type MemberPermContext,
  PERM_MANAGE_CHANNELS,
} from '@/guilds/guilds.service';
import { GuildPermissions } from '@/common/permissions';
import { ActivitySession } from '@/database/entities/activity-session.entity';
import { Channel } from '@/database/entities/channel.entity';
import { DMChannelMember } from '@/database/entities/dm-channel-member.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { User } from '@/database/entities/user.entity';
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
    const everyoneId = await this.guilds.ensureDefaultEveryoneRole(guildId);
    const permCtx = await this.guilds.buildMemberPermContext(guildId, userId, everyoneId);
    if (!permCtx) return [];

    const channels = await this.em.find(Channel, {
      where: { guildId },
      order: { categoryId: 'ASC', position: 'ASC' },
    });
    const voiceMap = await this.voicePresence.listGuildVoice(guildId);
    const activityMembers = await this.listActivityMembersByChannel(guildId);
    const unreadMap = await this.unreadByChannelIds(
      userId,
      channels
        .filter((c) => c.type === ChannelType.TEXT || c.type === ChannelType.FORUM)
        .map((c) => c.id),
    );
    const canManage = permCtx.canManageChannels;
    const summaries = channels.map((c) => {
      const canView =
        canManage || this.memberCanInChannelWithContext(c, userId, 'VIEW_CHANNEL', permCtx);
      if (!canView) return null;
      const isActivity =
        c.type === ChannelType.GAME || c.type === ChannelType.WATCH_PARTY;
      return this.toSummary(c, {
        voiceMembers: c.type === ChannelType.VOICE
          ? voiceMap[c.id]
          : isActivity
            ? activityMembers[c.id]
            : undefined,
        unreadCount:
          c.type === ChannelType.TEXT || c.type === ChannelType.FORUM
            ? unreadMap.get(c.id)
            : undefined,
        includeDenied: canManage,
      });
    });
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
      type: 'TEXT' | 'VOICE' | 'FORUM' | 'GAME' | 'WATCH_PARTY';
      categoryId?: string | null;
      topic?: string | null;
      gameKind?: 'billiards' | 'okey' | 'bowling' | 'tavla' | null;
    },
  ): Promise<ChannelSummary> {
    await this.guilds.requirePermission(guildId, userId, 'MANAGE_CHANNELS');
    const preserveCase =
      data.type === 'VOICE' || data.type === 'GAME' || data.type === 'WATCH_PARTY';
    const name = preserveCase
      ? data.name.trim().slice(0, 100)
      : data.name.trim().replace(/\s+/g, '-').toLowerCase().slice(0, 100);
    if (!name) throw new BadRequestException('Kanal adı gerekli');

    const channelType =
      data.type === 'VOICE'
        ? ChannelType.VOICE
        : data.type === 'FORUM'
          ? ChannelType.FORUM
          : data.type === 'GAME'
            ? ChannelType.GAME
            : data.type === 'WATCH_PARTY'
              ? ChannelType.WATCH_PARTY
              : ChannelType.TEXT;

    let gameKind: string | null = null;
    if (channelType === ChannelType.GAME) {
      const allowed = new Set(['billiards', 'okey', 'bowling', 'tavla']);
      if (!data.gameKind || !allowed.has(data.gameKind)) {
        throw new BadRequestException('Oyun türü gerekli (billiards/okey/bowling/tavla)');
      }
      gameKind = data.gameKind;
    }

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
        type: channelType,
        gameKind,
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
      const preserveCase =
        channel.type === ChannelType.VOICE ||
        channel.type === ChannelType.GAME ||
        channel.type === ChannelType.WATCH_PARTY;
      channel.name = preserveCase
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
      const everyoneId = await this.guilds.ensureDefaultEveryoneRole(channel.guildId);
      const permCtx = await this.guilds.buildMemberPermContext(
        channel.guildId,
        userId,
        everyoneId,
      );
      if (!permCtx) {
        throw new ForbiddenException('Bu ses kanalına bağlanma iznin yok');
      }
      const canConnect = this.memberCanInChannelWithContext(
        channel,
        userId,
        'CONNECT',
        permCtx,
      );
      if (!canConnect) {
        throw new ForbiddenException('Bu ses kanalına bağlanma iznin yok');
      }
      const denied = channel.deniedUserIds ?? [];
      if (denied.includes(userId)) {
        throw new ForbiddenException('Bu odaya girmen engellendi');
      }
      const canBypass =
        permCtx.isOwner ||
        permCtx.isAdministrator ||
        permCtx.isPlatformAdmin ||
        permCtx.canManageChannels;
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
    const denied = channel.deniedUserIds ?? [];
    if (denied.includes(userId)) {
      throw new ForbiddenException('Bu odaya girmen engellendi');
    }
    return channel;
  }

  /** Erişim kontrolü sonrası Channel entity (mesaj/send hot path). */
  async assertChannelAccess(channelId: string, userId: string): Promise<Channel> {
    const channel = await this.em.findOne(Channel, { where: { id: channelId } });
    if (!channel) throw new NotFoundException('Channel not found');
    if (channel.guildId) {
      await this.guilds.ensureMember(channel.guildId, userId);
      const canManage = await this.canManageChannels(channel.guildId, userId);
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

    for (const id of channelIds) map.set(id, 0);

    try {
      const rows = (await this.em.query(
        `SELECT m."channelId" AS "channelId", COUNT(*)::int AS c
         FROM messages m
         LEFT JOIN channel_read_states crs
           ON crs."channelId" = m."channelId" AND crs."userId" = $1
         LEFT JOIN messages lr ON lr.id = crs."lastReadMessageId"
         WHERE m."channelId" = ANY($2::varchar[])
           AND m."deletedAt" IS NULL
           AND m."threadRootId" IS NULL
           AND (
             crs."lastReadMessageId" IS NULL
             OR m."createdAt" > COALESCE(lr."createdAt", '-infinity'::timestamptz)
           )
         GROUP BY m."channelId"`,
        [userId, channelIds],
      )) as Array<{ channelId: string; c: number }>;

      for (const row of rows) {
        map.set(row.channelId, Number(row.c ?? 0));
      }
    } catch {
      // Unread sorgusu başarısız olsa bile kanal listesini düşürme
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
      gameKind:
        channel.type === ChannelType.GAME
          ? ((channel.gameKind as ChannelSummary['gameKind']) ?? null)
          : undefined,
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

  /** Aktif oyun / watch party oturumlarındaki oyuncuları ses üyesi gibi listele */
  private async listActivityMembersByChannel(
    guildId: string,
  ): Promise<Record<string, VoiceMemberSummary[]>> {
    const sessions = await this.em
      .createQueryBuilder(ActivitySession, 'a')
      .where('a.guildId = :guildId', { guildId })
      .andWhere('a.status IN (:...st)', { st: ['lobby', 'playing'] })
      .getMany();
    if (sessions.length === 0) return {};

    const userIds = new Set<string>();
    for (const s of sessions) {
      for (const id of s.playerIds ?? []) userIds.add(id);
      for (const id of s.spectatorIds ?? []) userIds.add(id);
    }
    const users =
      userIds.size > 0
        ? await this.em.find(User, { where: { id: In([...userIds]) } })
        : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    const out: Record<string, VoiceMemberSummary[]> = {};
    for (const s of sessions) {
      const ids = [...(s.playerIds ?? []), ...(s.spectatorIds ?? [])];
      const members: VoiceMemberSummary[] = [];
      for (const id of ids) {
        const u = byId.get(id);
        if (!u) continue;
        members.push({
          id: u.id,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          muted: false,
          deafened: false,
          isBot: Boolean(u.isBot),
        });
      }
      out[s.channelId] = members;
    }
    return out;
  }

  /** Kanal overwrite + önceden yüklenmiş sunucu izinleri (listGuildChannels hot path). */
  memberCanInChannelWithContext(
    channel: Channel,
    userId: string,
    perm: 'VIEW_CHANNEL' | 'SEND_MESSAGES' | 'CONNECT' | 'SPEAK',
    ctx: MemberPermContext,
  ): boolean {
    if (!channel.guildId) return true;
    if (ctx.isOwner || ctx.isAdministrator) return true;

    const overwrites = channel.permissionOverwrites ?? [];
    const memberOw = overwrites.find((o) => o.type === 'member' && o.id === userId);
    if (memberOw) {
      if (memberOw.deny?.includes(perm)) return false;
      if (memberOw.allow?.includes(perm)) return true;
    }
    let roleAllow = false;
    let roleDeny = false;
    for (const roleId of ctx.roleIds) {
      const ow = overwrites.find((o) => o.type === 'role' && o.id === roleId);
      if (!ow) continue;
      if (ow.deny?.includes(perm)) roleDeny = true;
      if (ow.allow?.includes(perm)) roleAllow = true;
    }
    if (roleDeny && !roleAllow) return false;
    if (roleAllow) return true;

    if (perm === 'VIEW_CHANNEL') {
      return true;
    }
    if (perm === 'SEND_MESSAGES') {
      return ctx.permissions.has(GuildPermissions.SEND_MESSAGES);
    }
    return true;
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

    // Overwrite yok / inherit → üye kanalı görür. Gizli kanallar @everyone deny ile kapatılır.
    if (perm === 'VIEW_CHANNEL') {
      return true;
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
