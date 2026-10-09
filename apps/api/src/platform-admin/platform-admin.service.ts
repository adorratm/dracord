import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, ILike, In, Not } from 'typeorm';
import type {
  ChannelSummary,
  GuildSummary,
  PublicUser,
  RoleDto,
  VoiceMemberSummary,
} from '@dracord/types';
import { PlatformAdminService as PlatformAdminAuth } from '@/auth/platform-admin.service';
import { toPublicUser } from '@/common/user.mapper';
import { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildBan } from '@/database/entities/guild-ban.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Message } from '@/database/entities/message.entity';
import { Role } from '@/database/entities/role.entity';
import { RolePermission } from '@/database/entities/role-permission.entity';
import { Session } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { SearchIndexerService } from '@/search/search-indexer.service';
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
  threadRootId: string | null;
  type: string;
  attachments: Array<{
    id: string;
    url: string;
    filename: string;
    contentType: string;
    size: number;
  }>;
  embeds: Array<{
    url: string;
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    siteName?: string | null;
  }>;
  poll: {
    question: string;
    options: Array<{ id: string; text: string }>;
    multi: boolean;
    closed?: boolean;
  } | null;
};

export type PlatformAdminVoiceRow = {
  channelId: string;
  channelName: string;
  members: VoiceMemberSummary[];
  screenSharers: VoiceMemberSummary[];
};

export type PlatformAdminUserRow = PublicUser & {
  email: string;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
  isPlatformAdmin: boolean;
  guildCount: number;
};

export type PlatformAdminUserDetail = PlatformAdminUserRow & {
  bio: string | null;
  bannerUrl: string | null;
  bannerColor: string | null;
  guilds: Array<{
    id: string;
    name: string;
    owner: boolean;
    timeoutUntil: string | null;
    banned: boolean;
  }>;
  sessionCount: number;
};

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly em: EntityManager,
    private readonly voicePresence: VoicePresenceService,
    private readonly platformAdminAuth: PlatformAdminAuth,
    private readonly indexer: SearchIndexerService,
  ) {}

  private toGuildSummary(guild: Guild): GuildSummary {
    return {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconUrl,
      bannerUrl: guild.bannerUrl ?? null,
      ownerId: guild.ownerId,
      discoverable: guild.discoverable,
      discoverPinned: Boolean(guild.discoverPinnedAt),
      discoverPinOrder: guild.discoverPinOrder ?? null,
      afkChannelId: guild.afkChannelId ?? null,
      afkTimeoutMinutes: guild.afkTimeoutMinutes ?? 0,
    };
  }

  async pinDiscoverGuild(guildId: string): Promise<GuildSummary> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (!guild.discoverable) {
      guild.discoverable = true;
    }
    const maxRow = await this.em
      .createQueryBuilder(Guild, 'g')
      .select('MAX(g.discoverPinOrder)', 'max')
      .where('g.discoverPinnedAt IS NOT NULL')
      .getRawOne<{ max: string | null }>();
    const nextOrder = (Number(maxRow?.max) || 0) + 1;
    guild.discoverPinnedAt = new Date();
    guild.discoverPinOrder = nextOrder;
    await this.em.save(guild);
    return this.toGuildSummary(guild);
  }

  async unpinDiscoverGuild(guildId: string): Promise<GuildSummary> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    guild.discoverPinnedAt = null;
    guild.discoverPinOrder = null;
    await this.em.save(guild);
    return this.toGuildSummary(guild);
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
            : c.type === ChannelType.GAME
              ? 'GAME'
              : c.type === ChannelType.WATCH_PARTY
                ? 'WATCH_PARTY'
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
    limit = 40,
    before?: string | null,
  ): Promise<{ items: PlatformAdminMessageRow[]; hasMore: boolean }> {
    await this.getGuild(guildId);
    const channels = await this.em.find(Channel, {
      where: { guildId },
      select: { id: true, name: true },
    });
    if (!channels.length) return { items: [], hasMore: false };
    const channelIds = channels.map((c) => c.id);
    const nameById = new Map(channels.map((c) => [c.id, c.name]));
    const take = Math.max(1, Math.min(100, Math.floor(limit)));

    const qb = this.em
      .createQueryBuilder(Message, 'm')
      .where('m.channelId IN (:...channelIds)', { channelIds })
      .orderBy('m.createdAt', 'DESC')
      .addOrderBy('m.id', 'DESC')
      .take(take + 1);

    if (before) {
      const pivot = await this.em.findOne(Message, { where: { id: before } });
      if (pivot) {
        qb.andWhere(
          '(m.createdAt < :pivotAt OR (m.createdAt = :pivotAt AND m.id < :pivotId))',
          { pivotAt: pivot.createdAt, pivotId: pivot.id },
        );
      }
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > take;
    const slice = hasMore ? rows.slice(0, take) : rows;
    // UI: eski → yeni (aşağı kaydır = günümüz)
    const chronological = [...slice].reverse();

    const authorIds = [...new Set(chronological.map((m) => m.authorId))];
    const authors =
      authorIds.length === 0
        ? []
        : await this.em.find(User, { where: { id: In(authorIds) } });
    const authorById = new Map(authors.map((u) => [u.id, u]));
    const items = chronological.map((m) => {
      const author = authorById.get(m.authorId);
      return {
        id: m.id,
        channelId: m.channelId,
        channelName: nameById.get(m.channelId) ?? m.channelId,
        authorId: m.authorId,
        authorName: author?.displayName || author?.username || m.authorId,
        content: m.content.slice(0, 2000),
        createdAt: m.createdAt.toISOString(),
        threadRootId: m.threadRootId ?? null,
        type: m.type ?? 'default',
        attachments: m.attachments ?? [],
        embeds: m.embeds ?? [],
        poll: m.poll
          ? {
              question: m.poll.question,
              options: m.poll.options,
              multi: Boolean(m.poll.multi),
              closed: m.poll.closed,
            }
          : null,
      };
    });
    return { items, hasMore };
  }

  async listRoles(guildId: string): Promise<RoleDto[]> {
    await this.getGuild(guildId);
    const roles = await this.em.find(Role, {
      where: { guildId },
      order: { position: 'DESC', name: 'ASC' },
    });
    const roleIds = roles.map((r) => r.id);
    const perms =
      roleIds.length === 0
        ? []
        : await this.em.find(RolePermission, { where: { roleId: In(roleIds) } });
    const permsByRole = new Map<string, string[]>();
    for (const p of perms) {
      const list = permsByRole.get(p.roleId) ?? [];
      list.push(p.permission);
      permsByRole.set(p.roleId, list);
    }
    return roles.map((r) => ({
      id: r.id,
      guildId: r.guildId,
      name: r.name,
      color: r.color,
      position: r.position,
      permissions: permsByRole.get(r.id) ?? [],
      badgeKey: (r.badgeKey as RoleDto['badgeKey']) ?? null,
      profileBgKey: (r.profileBgKey as RoleDto['profileBgKey']) ?? null,
      hoist: Boolean(r.hoist),
    }));
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

  private normalizeUsername(raw: string): string {
    return raw
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 32);
  }

  private async toAdminUserRow(user: User): Promise<PlatformAdminUserRow> {
    const guildCount = await this.em.count(GuildMember, { where: { userId: user.id } });
    const isPlatformAdmin = await this.platformAdminAuth.isPlatformAdmin(user.id);
    return {
      ...toPublicUser(user),
      email: user.email,
      disabledAt: user.disabledAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      isPlatformAdmin,
      guildCount,
    };
  }

  async listUsers(q = '', limit = 50): Promise<PlatformAdminUserRow[]> {
    const take = Math.max(1, Math.min(200, Math.floor(limit)));
    const query = q.trim();
    const users = query
      ? await this.em.find(User, {
          where: [
            { username: ILike(`%${query}%`) },
            { displayName: ILike(`%${query}%`) },
            { email: ILike(`%${query}%`) },
          ],
          order: { createdAt: 'DESC' },
          take,
        })
      : await this.em.find(User, {
          order: { createdAt: 'DESC' },
          take,
        });
    return Promise.all(users.map((u) => this.toAdminUserRow(u)));
  }

  async getUser(userId: string): Promise<PlatformAdminUserDetail> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const row = await this.toAdminUserRow(user);
    const memberships = await this.em.find(GuildMember, {
      where: { userId },
      relations: { guild: true },
    });
    const bans = await this.em.find(GuildBan, { where: { userId } });
    const banGuildIds = new Set(bans.map((b) => b.guildId));
    const owned = await this.em.find(Guild, { where: { ownerId: userId } });
    const guildMap = new Map<string, PlatformAdminUserDetail['guilds'][number]>();
    for (const m of memberships) {
      guildMap.set(m.guildId, {
        id: m.guildId,
        name: m.guild?.name ?? m.guildId,
        owner: m.guild?.ownerId === userId,
        timeoutUntil: m.timeoutUntil?.toISOString() ?? null,
        banned: banGuildIds.has(m.guildId),
      });
    }
    for (const g of owned) {
      if (!guildMap.has(g.id)) {
        guildMap.set(g.id, {
          id: g.id,
          name: g.name,
          owner: true,
          timeoutUntil: null,
          banned: banGuildIds.has(g.id),
        });
      }
    }
    for (const b of bans) {
      if (!guildMap.has(b.guildId)) {
        const g = await this.em.findOne(Guild, { where: { id: b.guildId } });
        guildMap.set(b.guildId, {
          id: b.guildId,
          name: g?.name ?? b.guildId,
          owner: false,
          timeoutUntil: null,
          banned: true,
        });
      } else {
        guildMap.get(b.guildId)!.banned = true;
      }
    }
    const sessionCount = await this.em.count(Session, { where: { userId } });
    return {
      ...row,
      bio: user.bio,
      bannerUrl: user.bannerUrl,
      bannerColor: user.bannerColor,
      guilds: [...guildMap.values()].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
      sessionCount,
    };
  }

  async updateUser(
    actorId: string,
    userId: string,
    data: {
      username?: string;
      displayName?: string;
      email?: string;
      bio?: string | null;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      bannerColor?: string | null;
    },
  ): Promise<PlatformAdminUserDetail> {
    void actorId;
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');

    if (data.username !== undefined) {
      const username = this.normalizeUsername(data.username);
      if (username.length < 2) {
        throw new BadRequestException('Kullanıcı adı en az 2 karakter olmalı');
      }
      const taken = await this.em.findOne(User, {
        where: { username, id: Not(userId) },
      });
      if (taken) throw new ConflictException('Bu kullanıcı adı alınmış');
      user.username = username;
      user.usernameConfirmed = true;
    }
    if (data.displayName !== undefined) {
      const name = data.displayName.trim();
      if (name.length < 1 || name.length > 64) {
        throw new BadRequestException('Görünen ad 1–64 karakter olmalı');
      }
      user.displayName = name;
    }
    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (!email.includes('@')) throw new BadRequestException('Geçersiz e-posta');
      const taken = await this.em.findOne(User, {
        where: { email, id: Not(userId) },
      });
      if (taken) throw new ConflictException('Bu e-posta kullanılıyor');
      user.email = email;
    }
    if (data.bio !== undefined) user.bio = data.bio;
    if (data.avatarUrl !== undefined) user.avatarUrl = data.avatarUrl;
    if (data.bannerUrl !== undefined) user.bannerUrl = data.bannerUrl;
    if (data.bannerColor !== undefined) user.bannerColor = data.bannerColor;

    await this.em.save(User, user);
    void this.indexer.indexUser(user).catch(() => undefined);
    return this.getUser(userId);
  }

  /** Platform engeli: giriş kapat + oturumları düşür */
  async disableUser(
    actorId: string,
    userId: string,
  ): Promise<PlatformAdminUserDetail> {
    if (actorId === userId) {
      throw new BadRequestException('Kendi hesabını engelleyemezsin');
    }
    await this.platformAdminAuth.assertNotPlatformAdminTarget(userId);
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    user.disabledAt = new Date();
    await this.em.save(User, user);
    await this.em.delete(Session, { userId });
    await this.voicePresence.leaveEverywhere(userId);
    return this.getUser(userId);
  }

  async enableUser(userId: string): Promise<PlatformAdminUserDetail> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    user.disabledAt = null;
    await this.em.save(User, user);
    return this.getUser(userId);
  }

  async revokeSessions(userId: string): Promise<{ ok: true; revoked: number }> {
    const sessions = await this.em.find(Session, { where: { userId } });
    if (sessions.length) await this.em.remove(Session, sessions);
    return { ok: true, revoked: sessions.length };
  }

  /** Tüm sunuculardan at (sahiplik hariç) */
  async kickFromAllGuilds(
    actorId: string,
    userId: string,
  ): Promise<{ ok: true; kicked: number }> {
    await this.platformAdminAuth.assertNotPlatformAdminTarget(userId);
    const memberships = await this.em.find(GuildMember, { where: { userId } });
    const guilds = memberships.length
      ? await this.em.find(Guild, { where: { id: In(memberships.map((m) => m.guildId)) } })
      : [];
    const ownerGuildIds = new Set(
      guilds.filter((g) => g.ownerId === userId).map((g) => g.id),
    );
    let kicked = 0;
    for (const m of memberships) {
      if (ownerGuildIds.has(m.guildId)) continue;
      await this.em.remove(GuildMember, m);
      kicked += 1;
    }
    await this.voicePresence.leaveEverywhere(userId);
    void actorId;
    return { ok: true, kicked };
  }

  async timeoutInGuild(
    actorId: string,
    userId: string,
    guildId: string,
    minutes: number,
  ): Promise<{ ok: true; timeoutUntil: string | null }> {
    await this.platformAdminAuth.assertNotPlatformAdminTarget(userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Sunucu bulunamadı');
    if (guild.ownerId === userId) {
      throw new BadRequestException('Sahibe uzaklaştırma uygulanamaz');
    }
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) throw new NotFoundException('Üye bulunamadı');
    const mins = Math.max(0, Math.min(60 * 24 * 28, Math.floor(minutes)));
    member.timeoutUntil = mins <= 0 ? null : new Date(Date.now() + mins * 60_000);
    await this.em.save(GuildMember, member);
    void actorId;
    return { ok: true, timeoutUntil: member.timeoutUntil?.toISOString() ?? null };
  }

  async banFromGuild(
    actorId: string,
    userId: string,
    guildId: string,
    reason?: string | null,
  ): Promise<{ ok: true }> {
    await this.platformAdminAuth.assertNotPlatformAdminTarget(userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Sunucu bulunamadı');
    if (guild.ownerId === userId) {
      throw new BadRequestException('Sahip yasaklanamaz');
    }
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (member) await this.em.remove(GuildMember, member);
    const existing = await this.em.findOne(GuildBan, {
      where: { guildId, userId },
    });
    if (!existing) {
      await this.em.save(
        GuildBan,
        this.em.create(GuildBan, {
          guildId,
          userId,
          bannedById: actorId,
          reason: reason?.trim() || null,
        }),
      );
    }
    const leaves = await this.voicePresence.leaveEverywhere(userId);
    void leaves;
    return { ok: true };
  }

  async unbanFromGuild(userId: string, guildId: string): Promise<{ ok: true }> {
    const ban = await this.em.findOne(GuildBan, { where: { guildId, userId } });
    if (!ban) throw new NotFoundException('Yasak kaydı yok');
    await this.em.remove(GuildBan, ban);
    return { ok: true };
  }

  /**
   * Hesabı kalıcı sil.
   * Sahip olduğu sunucu varsa silinmez (önce devret/sil).
   */
  async deleteUser(
    actorId: string,
    userId: string,
  ): Promise<{ ok: true }> {
    if (actorId === userId) {
      throw new BadRequestException('Kendi hesabını silemezsin');
    }
    await this.platformAdminAuth.assertNotPlatformAdminTarget(userId);
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı');
    const owned = await this.em.count(Guild, { where: { ownerId: userId } });
    if (owned > 0) {
      throw new BadRequestException(
        `Kullanıcı ${owned} sunucunun sahibi — önce sahipliği devret veya sunucuları sil`,
      );
    }
    await this.voicePresence.leaveEverywhere(userId);
    await this.em.delete(Session, { userId });
    // Mesajlar CASCADE; üyelikler CASCADE
    await this.em.remove(User, user);
    void this.indexer.deleteUser(userId).catch(() => undefined);
    return { ok: true };
  }
}
