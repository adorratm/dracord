import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, ILike } from 'typeorm';
import type {
  CategoryDto,
  GuildInviteDto,
  GuildPermissionsDto,
  GuildSummary,
  PublicUser,
} from '@dracord/types';
import { createId } from '@paralleldrive/cuid2';
import { toPublicUser } from '@/common/user.mapper';
import {
  GuildPermissions,
  type GuildPermissionName,
} from '@/common/permissions';
import { Category } from '@/database/entities/category.entity';
import { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildBan } from '@/database/entities/guild-ban.entity';
import { AuditLog } from '@/database/entities/audit-log.entity';
import { GuildInvite } from '@/database/entities/guild-invite.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildMemberRole } from '@/database/entities/guild-member-role.entity';
import { Role } from '@/database/entities/role.entity';
import { RolePermission } from '@/database/entities/role-permission.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { PlatformAdminService } from '@/auth/platform-admin.service';
import { BotService } from '@/bot/bot.service';
import { BUILTIN_COMMANDS } from '@/bot/bots.controller';
import { SearchIndexerService } from '@/search/search-indexer.service';
import { VoicePresenceService } from '@/voice/voice-presence.service';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { SlashCommand } from '@/database/entities/slash-command.entity';

export const PERM_MANAGE_GUILD = GuildPermissions.MANAGE_GUILD;
export const PERM_MANAGE_CHANNELS = GuildPermissions.MANAGE_CHANNELS;
export const PERM_ADMINISTRATOR = GuildPermissions.ADMINISTRATOR;
export const PERM_MANAGE_MESSAGES = GuildPermissions.MANAGE_MESSAGES;

/** Tek istekte kanal listesi için önceden yüklenmiş üye/sunucu izinleri. */
export type MemberPermContext = {
  isOwner: boolean;
  isPlatformAdmin: boolean;
  isAdministrator: boolean;
  canManageChannels: boolean;
  roleIds: string[];
  permissions: Set<string>;
};

@Injectable()
export class GuildsService {
  constructor(
    private readonly em: EntityManager,
    private readonly indexer: SearchIndexerService,
    private readonly bot: BotService,
    private readonly voicePresence: VoicePresenceService,
    private readonly broadcast: SocketBroadcastService,
    private readonly platformAdmin: PlatformAdminService,
  ) {}

  private async writeAudit(
    guildId: string,
    actorId: string,
    action: string,
    targetId?: string | null,
    targetType?: string | null,
    meta?: Record<string, unknown> | null,
  ) {
    await this.em.save(
      AuditLog,
      this.em.create(AuditLog, {
        guildId,
        actorId,
        action,
        targetId: targetId ?? null,
        targetType: targetType ?? null,
        meta: meta ?? null,
      }),
    );
  }

  private async assertNotBanned(guildId: string, userId: string) {
    const ban = await this.em.findOne(GuildBan, { where: { guildId, userId } });
    if (ban) throw new ForbiddenException('Bu sunucudan yasaklandın');
  }

  /** Discord: @everyone tüm üyelere örtük uygulanır. */
  async getEveryoneRoleId(guildId: string): Promise<string | null> {
    const cached = this.everyoneRoleCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.id;
    const everyone = await this.em.findOne(Role, {
      where: { guildId, name: '@everyone' },
    });
    if (everyone) {
      this.everyoneRoleCache.set(guildId, {
        id: everyone.id,
        expiresAt: Date.now() + 60_000,
      });
    }
    return everyone?.id ?? null;
  }

  private readonly everyoneRoleCache = new Map<
    string,
    { id: string; expiresAt: number }
  >();

  /** @everyone + varsayılan kanal görünürlük izinleri (katılma / eski sunucular). */
  async ensureDefaultEveryoneRole(guildId: string): Promise<string> {
    const cached = this.everyoneRoleCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.id;

    let everyone = await this.em.findOne(Role, {
      where: { guildId, name: '@everyone' },
    });
    if (!everyone) {
      everyone = await this.em.save(
        Role,
        this.em.create(Role, {
          guildId,
          name: '@everyone',
          color: '#99AAB5',
          position: 0,
          badgeKey: 'none',
          profileBgKey: 'none',
          hoist: false,
        }),
      );
    }

    const defaults = [
      GuildPermissions.VIEW_CHANNELS,
      GuildPermissions.SEND_MESSAGES,
      GuildPermissions.ADD_REACTIONS,
      GuildPermissions.CREATE_POLLS,
    ] as const;
    const existing = await this.em.find(RolePermission, {
      where: { roleId: everyone.id },
    });
    const have = new Set(existing.map((p) => p.permission));
    const missing = defaults.filter((p) => !have.has(p));
    if (missing.length) {
      await this.em.save(
        RolePermission,
        missing.map((permission) =>
          this.em.create(RolePermission, { roleId: everyone.id, permission }),
        ),
      );
    }
    this.everyoneRoleCache.set(guildId, {
      id: everyone.id,
      expiresAt: Date.now() + 60_000,
    });
    return everyone.id;
  }

  /** Üyeye @everyone rolünü bağla (yoksa). */
  async ensureEveryoneRole(guildId: string, guildMemberId: string): Promise<void> {
    const everyoneId = await this.ensureDefaultEveryoneRole(guildId);
    const existing = await this.em.findOne(GuildMemberRole, {
      where: { guildMemberId, roleId: everyoneId },
    });
    if (existing) return;
    await this.em.save(
      GuildMemberRole,
      this.em.create(GuildMemberRole, {
        guildMemberId,
        roleId: everyoneId,
      }),
    );
  }

  /** Üye rol id'leri + her zaman @everyone (link olmasa bile). */
  async resolveMemberRoleIds(guildId: string, guildMemberId: string): Promise<string[]> {
    const links = await this.em.find(GuildMemberRole, {
      where: { guildMemberId },
    });
    const roleIds = new Set(links.map((l) => l.roleId));
    const everyoneId = await this.getEveryoneRoleId(guildId);
    if (everyoneId) roleIds.add(everyoneId);
    return [...roleIds];
  }

  /** listGuildChannels: Guild/Member/rol sorgularını kanal döngüsünden çıkarır. */
  async buildMemberPermContext(
    guildId: string,
    userId: string,
    everyoneId: string,
  ): Promise<MemberPermContext | null> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) return null;

    const isOwner = guild.ownerId === userId;
    const isPlatformAdmin = await this.platformAdmin.isPlatformAdmin(userId);
    if (isOwner || isPlatformAdmin) {
      return {
        isOwner,
        isPlatformAdmin,
        isAdministrator: true,
        canManageChannels: true,
        roleIds: [],
        permissions: new Set(Object.values(GuildPermissions)),
      };
    }

    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) return null;

    const links = await this.em.find(GuildMemberRole, {
      where: { guildMemberId: member.id },
    });
    const roleIds = new Set(links.map((l) => l.roleId));
    roleIds.add(everyoneId);

    const roleIdList = [...roleIds];
    if (!roleIdList.length) {
      return {
        isOwner: false,
        isPlatformAdmin: false,
        isAdministrator: false,
        canManageChannels: false,
        roleIds: roleIdList,
        permissions: new Set(),
      };
    }

    const perms = await this.em
      .createQueryBuilder(RolePermission, 'rp')
      .where('rp.roleId IN (:...roleIds)', { roleIds: roleIdList })
      .getMany();
    const permissions = new Set(perms.map((p) => p.permission));
    const isAdministrator = permissions.has(PERM_ADMINISTRATOR);

    return {
      isOwner: false,
      isPlatformAdmin: false,
      isAdministrator,
      canManageChannels: isAdministrator || permissions.has(PERM_MANAGE_CHANNELS),
      roleIds: roleIdList,
      permissions,
    };
  }

  /** Eksik @everyone linklerini tüm sunucu üyelerine backfill et. */
  async backfillEveryoneRoles(): Promise<number> {
    const guilds = await this.em.find(Guild, { select: { id: true } });
    let added = 0;
    for (const g of guilds) {
      const everyoneId = await this.ensureDefaultEveryoneRole(g.id);
      const result = await this.em.query(
        `INSERT INTO guild_member_roles ("guildMemberId", "roleId")
         SELECT gm.id, $1
         FROM guild_members gm
         WHERE gm."guildId" = $2
           AND NOT EXISTS (
             SELECT 1 FROM guild_member_roles gmr
             WHERE gmr."guildMemberId" = gm.id AND gmr."roleId" = $1
           )
         RETURNING "guildMemberId"`,
        [everyoneId, g.id],
      );
      added += Array.isArray(result) ? result.length : 0;
    }
    return added;
  }

  async listForUser(userId: string): Promise<GuildSummary[]> {
    if (await this.platformAdmin.isPlatformAdmin(userId)) {
      const all = await this.em.find(Guild, {
        order: { name: 'ASC' },
        select: {
          id: true,
          name: true,
          iconUrl: true,
          bannerUrl: true,
          ownerId: true,
          discoverable: true,
          afkChannelId: true,
          afkTimeoutMinutes: true,
        },
      });
      return all.map((g) => this.toSummary(g));
    }
    const memberships = await this.em.find(GuildMember, {
      where: { userId },
      relations: { guild: true },
    });
    return memberships.map((m) => this.toSummary(m.guild));
  }

  async discover(q?: string): Promise<GuildSummary[]> {
    const trimmed = q?.trim() ?? '';
    const guilds = await this.em.find(Guild, {
      where: {
        discoverable: true,
        ...(trimmed ? { name: ILike(`%${trimmed}%`) } : {}),
      },
      take: 50,
      order: { createdAt: 'DESC' },
    });
    if (!guilds.length) return [];
    const ids = guilds.map((g) => g.id);
    const countRows = await this.em
      .createQueryBuilder(GuildMember, 'gm')
      .select('gm.guildId', 'guildId')
      .addSelect('COUNT(*)', 'cnt')
      .where('gm.guildId IN (:...ids)', { ids })
      .groupBy('gm.guildId')
      .getRawMany<{ guildId: string; cnt: string }>();
    const countMap = new Map(countRows.map((r) => [r.guildId, Number(r.cnt) || 0]));
    return guilds.map((g) => ({
      ...this.toSummary(g),
      memberCount: countMap.get(g.id) ?? 0,
    }));
  }

  async getGuild(guildId: string, userId: string): Promise<GuildSummary> {
    await this.ensureMember(guildId, userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    return this.toSummary(guild);
  }

  private async ensureUsernameConfirmed(userId: string): Promise<void> {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.usernameConfirmed === false) {
      throw new ForbiddenException('Önce kullanıcı adını belirlemelisin');
    }
  }

  async createGuild(
    userId: string,
    data: { name: string; iconUrl?: string | null; discoverable?: boolean },
  ): Promise<GuildSummary> {
    await this.ensureUsernameConfirmed(userId);
    const name = data.name.trim();
    if (name.length < 2) throw new BadRequestException('Sunucu adı çok kısa');

    const guild = await this.em.save(
      Guild,
      this.em.create(Guild, {
        name,
        iconUrl: data.iconUrl ?? null,
        bannerUrl: null,
        ownerId: userId,
        discoverable: data.discoverable ?? false,
      }),
    );

    await this.em.save(
      GuildMember,
      this.em.create(GuildMember, { guildId: guild.id, userId }),
    );
    await this.bot.ensureBotInGuild(guild.id);

    // Varsayılan @everyone + Moderasyon rolleri
    const everyone = await this.em.save(
      Role,
      this.em.create(Role, {
        guildId: guild.id,
        name: '@everyone',
        color: '#99AAB5',
        position: 0,
        badgeKey: 'none',
        profileBgKey: 'none',
        hoist: false,
      }),
    );
    await this.em.save(
      RolePermission,
      [
        GuildPermissions.VIEW_CHANNELS,
        GuildPermissions.SEND_MESSAGES,
        GuildPermissions.ADD_REACTIONS,
        GuildPermissions.CREATE_POLLS,
      ].map((permission) =>
        this.em.create(RolePermission, { roleId: everyone.id, permission }),
      ),
    );

    const mod = await this.em.save(
      Role,
      this.em.create(Role, {
        guildId: guild.id,
        name: 'Moderatör',
        color: '#ED4245',
        position: 10,
        badgeKey: 'shield',
        profileBgKey: 'ember',
        hoist: true,
      }),
    );
    await this.em.save(
      RolePermission,
      [
        GuildPermissions.MANAGE_MESSAGES,
        GuildPermissions.KICK_MEMBERS,
        GuildPermissions.BAN_MEMBERS,
        GuildPermissions.MOVE_MEMBERS,
        GuildPermissions.MODERATE_MEMBERS,
        GuildPermissions.MANAGE_CHANNELS,
        GuildPermissions.VIEW_CHANNELS,
        GuildPermissions.SEND_MESSAGES,
      ].map((permission) =>
        this.em.create(RolePermission, { roleId: mod.id, permission }),
      ),
    );

    const vip = await this.em.save(
      Role,
      this.em.create(Role, {
        guildId: guild.id,
        name: 'VIP',
        color: '#FEE75C',
        position: 5,
        badgeKey: 'crown',
        profileBgKey: 'aurora',
        hoist: true,
      }),
    );

    const ownerMember = await this.em.findOne(GuildMember, {
      where: { guildId: guild.id, userId },
    });
    if (ownerMember) {
      await this.em.save(
        GuildMemberRole,
        [everyone, mod, vip].map((r) =>
          this.em.create(GuildMemberRole, {
            guildMemberId: ownerMember.id,
            roleId: r.id,
          }),
        ),
      );
    }

    const textCat = await this.em.save(
      Category,
      this.em.create(Category, {
        guildId: guild.id,
        name: 'Metin kanalları',
        position: 0,
      }),
    );
    const voiceCat = await this.em.save(
      Category,
      this.em.create(Category, {
        guildId: guild.id,
        name: 'Ses kanalları',
        position: 1,
      }),
    );

    await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId: guild.id,
        categoryId: textCat.id,
        name: 'genel',
        type: ChannelType.TEXT,
        position: 0,
      }),
    );
    await this.em.save(
      Channel,
      this.em.create(Channel, {
        guildId: guild.id,
        categoryId: voiceCat.id,
        name: 'Genel',
        type: ChannelType.VOICE,
        position: 0,
      }),
    );

    void this.indexer.indexGuild(guild).catch(() => undefined);
    const createdChannels = await this.em.find(Channel, { where: { guildId: guild.id } });
    for (const c of createdChannels) {
      void this.indexer.indexChannel(c).catch(() => undefined);
    }

    return this.toSummary(guild);
  }

  async updateGuild(
    guildId: string,
    userId: string,
    data: {
      name?: string;
      iconUrl?: string | null;
      bannerUrl?: string | null;
      discoverable?: boolean;
      afkChannelId?: string | null;
      afkTimeoutMinutes?: number;
    },
  ): Promise<GuildSummary> {
    await this.ensureMember(guildId, userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');

    const touchesIdentity =
      data.name != null || data.iconUrl !== undefined || data.bannerUrl !== undefined;
    if (touchesIdentity || data.afkChannelId !== undefined || data.afkTimeoutMinutes !== undefined) {
      await this.requirePermission(guildId, userId, PERM_MANAGE_GUILD);
    }
    if (data.discoverable !== undefined) {
      await this.requireOwner(guildId, userId);
      guild.discoverable = data.discoverable;
    }
    if (data.name != null) {
      const trimmed = data.name.trim();
      if (!trimmed) throw new BadRequestException('Sunucu adı boş olamaz');
      guild.name = trimmed;
    }
    if (data.iconUrl !== undefined) guild.iconUrl = data.iconUrl;
    if (data.bannerUrl !== undefined) guild.bannerUrl = data.bannerUrl;
    if (data.afkChannelId !== undefined) guild.afkChannelId = data.afkChannelId;
    if (data.afkTimeoutMinutes !== undefined) {
      const mins = Math.max(0, Math.min(120, Math.floor(data.afkTimeoutMinutes)));
      guild.afkTimeoutMinutes = mins;
    }
    await this.em.save(Guild, guild);
    void this.indexer.indexGuild(guild).catch(() => undefined);
    return this.toSummary(guild);
  }

  async deleteGuild(guildId: string, userId: string): Promise<void> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    const isOwner = guild.ownerId === userId;
    const isAdmin =
      !isOwner &&
      (await this.memberHasPermission(guildId, userId, PERM_ADMINISTRATOR));
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Sunucuyu yalnızca sahip veya yönetici silebilir');
    }
    await this.em.remove(Guild, guild);
  }

  async listMyPermissions(guildId: string, userId: string): Promise<GuildPermissionsDto> {
    await this.ensureMember(guildId, userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    const owner = guild.ownerId === userId;
    const platformAdmin = await this.platformAdmin.isPlatformAdmin(userId);
    if (owner || platformAdmin) {
      return {
        guildId,
        owner: owner || platformAdmin,
        platformAdmin,
        permissions: Object.values(GuildPermissions) as GuildPermissionsDto['permissions'],
      };
    }
    const permissions = await this.collectMemberPermissions(guildId, userId);
    return { guildId, owner: false, platformAdmin: false, permissions };
  }

  async collectMemberPermissions(
    guildId: string,
    userId: string,
  ): Promise<GuildPermissionsDto['permissions']> {
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) return [];
    const roleIds = await this.resolveMemberRoleIds(guildId, member.id);
    if (!roleIds.length) return [];
    const perms = await this.em
      .createQueryBuilder(RolePermission, 'rp')
      .where('rp.roleId IN (:...roleIds)', { roleIds })
      .getMany();
    const set = new Set(perms.map((p) => p.permission));
    if (set.has(PERM_ADMINISTRATOR)) {
      return Object.values(GuildPermissions) as GuildPermissionsDto['permissions'];
    }
    return [...set] as GuildPermissionsDto['permissions'];
  }

  async createInvite(
    guildId: string,
    userId: string,
    opts?: { maxUses?: number | null; expiresInHours?: number | null },
  ): Promise<GuildInviteDto> {
    await this.ensureMember(guildId, userId);
    const guild = await this.em.findOneOrFail(Guild, { where: { id: guildId } });
    const code = createId().slice(0, 8);
    const expiresAt =
      opts?.expiresInHours != null
        ? new Date(Date.now() + opts.expiresInHours * 3600_000)
        : null;
    const invite = await this.em.save(
      GuildInvite,
      this.em.create(GuildInvite, {
        code,
        guildId,
        creatorId: userId,
        maxUses: opts?.maxUses ?? null,
        uses: 0,
        expiresAt,
      }),
    );
    return this.toInviteDto(invite, guild.name);
  }

  async joinByInvite(code: string, userId: string): Promise<GuildSummary> {
    await this.ensureUsernameConfirmed(userId);
    const invite = await this.em.findOne(GuildInvite, {
      where: { code },
      relations: { guild: true },
    });
    if (!invite) throw new NotFoundException('Davet bulunamadı');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Davet süresi dolmuş');
    }
    if (invite.maxUses != null && invite.uses >= invite.maxUses) {
      throw new BadRequestException('Davet kullanım limiti dolmuş');
    }
    await this.assertNotBanned(invite.guildId, userId);

    const existing = await this.em.findOne(GuildMember, {
      where: { guildId: invite.guildId, userId },
    });
    if (!existing) {
      const member = await this.em.save(
        GuildMember,
        this.em.create(GuildMember, { guildId: invite.guildId, userId }),
      );
      await this.ensureEveryoneRole(invite.guildId, member.id);
      invite.uses += 1;
      await this.em.save(GuildInvite, invite);
    } else {
      await this.ensureEveryoneRole(invite.guildId, existing.id);
    }
    return this.toSummary(invite.guild);
  }

  async joinDiscoverable(guildId: string, userId: string): Promise<GuildSummary> {
    await this.ensureUsernameConfirmed(userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (!guild.discoverable) {
      throw new ForbiddenException('Bu sunucu keşiften katılmaya açık değil');
    }
    await this.assertNotBanned(guildId, userId);
    const existing = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!existing) {
      const member = await this.em.save(
        GuildMember,
        this.em.create(GuildMember, { guildId, userId }),
      );
      await this.ensureEveryoneRole(guildId, member.id);
    } else {
      await this.ensureEveryoneRole(guildId, existing.id);
    }
    return this.toSummary(guild);
  }

  async listMembers(guildId: string, userId: string): Promise<PublicUser[]> {
    await this.ensureMember(guildId, userId);
    const members = await this.em.find(GuildMember, {
      where: { guildId },
      relations: {
        user: true,
        roles: { role: true },
      },
      take: 250,
      order: { joinedAt: 'ASC' },
    });
    const out: PublicUser[] = [];
    for (const m of members) {
      if (!m.user) continue;
      const pub = toPublicUser(m.user, { viewerId: userId });
      const roles = (m.roles ?? [])
        .map((mr) => mr.role)
        .filter((r): r is NonNullable<typeof r> => Boolean(r))
        .sort((a, b) => b.position - a.position)
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          position: r.position,
          badgeKey: (r.badgeKey || 'none') as import('@dracord/types').RoleBadgeKey,
          profileBgKey: (r.profileBgKey || 'none') as import('@dracord/types').RoleProfileBgKey,
          hoist: Boolean(r.hoist),
        }));
      const isPlatformAdmin = this.platformAdmin.isPlatformAdminByEmail(m.user.email);
      out.push({ ...pub, roles, isPlatformAdmin });
    }
    return out;
  }

  async ensureMember(guildId: string, userId: string): Promise<void> {
    if (await this.platformAdmin.isPlatformAdmin(userId)) return;
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) throw new ForbiddenException('Not a member of this guild');
  }

  /** Kullanıcının kendi isteğiyle sunucudan ayrılması. */
  async leaveGuild(guildId: string, userId: string): Promise<{ ok: true }> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === userId) {
      throw new BadRequestException(
        'Sunucu sahibi ayrılamaz. Önce sahipliği devret veya sunucuyu sil.',
      );
    }
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) throw new NotFoundException('Bu sunucunun üyesi değilsin');
    await this.em.remove(GuildMember, member);
    const leaves = await this.voicePresence.leaveEverywhere(userId);
    for (const p of leaves) {
      if (p.guildId === guildId) this.broadcast.broadcastVoiceState(p);
    }
    await this.writeAudit(guildId, userId, 'MEMBER_LEAVE', userId, 'user');
    return { ok: true };
  }

  async kickMember(
    guildId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<{ ok: true }> {
    await this.requirePermission(guildId, actorId, GuildPermissions.KICK_MEMBERS);
    await this.platformAdmin.assertNotPlatformAdminTarget(targetUserId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === targetUserId) {
      throw new BadRequestException('Sahip atılamaz');
    }
    if (actorId === targetUserId) {
      throw new BadRequestException('Kendini atamazsın');
    }
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Üye bulunamadı');
    await this.em.remove(GuildMember, member);
    const leaves = await this.voicePresence.leaveEverywhere(targetUserId);
    for (const p of leaves) {
      if (p.guildId === guildId) this.broadcast.broadcastVoiceState(p);
    }
    await this.writeAudit(guildId, actorId, 'MEMBER_KICK', targetUserId, 'user');
    return { ok: true };
  }

  async banMember(
    guildId: string,
    actorId: string,
    targetUserId: string,
    reason?: string | null,
  ): Promise<{ ok: true }> {
    await this.requirePermission(guildId, actorId, GuildPermissions.BAN_MEMBERS);
    await this.platformAdmin.assertNotPlatformAdminTarget(targetUserId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === targetUserId) {
      throw new BadRequestException('Sahip yasaklanamaz');
    }
    if (actorId === targetUserId) {
      throw new BadRequestException('Kendini yasaklayamazsın');
    }
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId: targetUserId },
    });
    if (member) await this.em.remove(GuildMember, member);
    const existingBan = await this.em.findOne(GuildBan, {
      where: { guildId, userId: targetUserId },
    });
    if (!existingBan) {
      await this.em.save(
        GuildBan,
        this.em.create(GuildBan, {
          guildId,
          userId: targetUserId,
          bannedById: actorId,
          reason: reason?.trim() || null,
        }),
      );
    }
    const leaves = await this.voicePresence.leaveEverywhere(targetUserId);
    for (const p of leaves) {
      if (p.guildId === guildId) this.broadcast.broadcastVoiceState(p);
    }
    await this.writeAudit(guildId, actorId, 'MEMBER_BAN', targetUserId, 'user', {
      reason: reason ?? null,
    });
    return { ok: true };
  }

  async unbanMember(
    guildId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<{ ok: true }> {
    await this.requirePermission(guildId, actorId, GuildPermissions.BAN_MEMBERS);
    const ban = await this.em.findOne(GuildBan, {
      where: { guildId, userId: targetUserId },
    });
    if (!ban) throw new NotFoundException('Yasak kaydı yok');
    await this.em.remove(GuildBan, ban);
    await this.writeAudit(guildId, actorId, 'MEMBER_UNBAN', targetUserId, 'user');
    return { ok: true };
  }

  async listBans(
    guildId: string,
    actorId: string,
  ): Promise<
    Array<{ userId: string; reason: string | null; bannedById: string; createdAt: string }>
  > {
    await this.requirePermission(guildId, actorId, GuildPermissions.BAN_MEMBERS);
    const bans = await this.em.find(GuildBan, {
      where: { guildId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return bans.map((b) => ({
      userId: b.userId,
      reason: b.reason,
      bannedById: b.bannedById,
      createdAt: b.createdAt.toISOString(),
    }));
  }

  async timeoutMember(
    guildId: string,
    actorId: string,
    targetUserId: string,
    minutes: number,
  ): Promise<{ ok: true; timeoutUntil: string | null }> {
    await this.requirePermission(guildId, actorId, GuildPermissions.MODERATE_MEMBERS);
    await this.platformAdmin.assertNotPlatformAdminTarget(targetUserId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === targetUserId) {
      throw new BadRequestException('Sahibe timeout uygulanamaz');
    }
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Üye bulunamadı');
    const mins = Math.max(0, Math.min(60 * 24 * 28, Math.floor(minutes)));
    member.timeoutUntil =
      mins <= 0 ? null : new Date(Date.now() + mins * 60_000);
    await this.em.save(GuildMember, member);
    await this.writeAudit(guildId, actorId, 'MEMBER_TIMEOUT', targetUserId, 'user', {
      minutes: mins,
      timeoutUntil: member.timeoutUntil?.toISOString() ?? null,
    });
    return {
      ok: true,
      timeoutUntil: member.timeoutUntil?.toISOString() ?? null,
    };
  }

  async listAuditLogs(
    guildId: string,
    actorId: string,
  ): Promise<
    Array<{
      id: string;
      actorId: string;
      action: string;
      targetId: string | null;
      targetType: string | null;
      meta: Record<string, unknown> | null;
      createdAt: string;
    }>
  > {
    await this.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const logs = await this.em.find(AuditLog, {
      where: { guildId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return logs.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      action: l.action,
      targetId: l.targetId,
      targetType: l.targetType,
      meta: l.meta,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async assertNotTimedOut(guildId: string, userId: string): Promise<void> {
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member?.timeoutUntil) return;
    if (member.timeoutUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Timeout süren dolmadan mesaj gönderemezsin');
    }
    member.timeoutUntil = null;
    await this.em.save(GuildMember, member);
  }

  async requireOwner(guildId: string, userId: string): Promise<Guild> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === userId) return guild;
    if (await this.platformAdmin.isPlatformAdmin(userId)) return guild;
    throw new ForbiddenException('Only the owner can manage this guild');
  }

  async requirePermission(
    guildId: string,
    userId: string,
    permission: string,
  ): Promise<Guild> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === userId) return guild;
    if (await this.platformAdmin.isPlatformAdmin(userId)) return guild;

    const allowed = await this.memberHasPermission(guildId, userId, permission);
    if (!allowed) {
      throw new ForbiddenException('Bu işlem için yetkin yok');
    }
    return guild;
  }

  async memberHasPermission(
    guildId: string,
    userId: string,
    permission: string,
  ): Promise<boolean> {
    if (await this.platformAdmin.isPlatformAdmin(userId)) return true;

    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) return false;

    const roleIds = await this.resolveMemberRoleIds(guildId, member.id);
    if (!roleIds.length) return false;

    const perms = await this.em
      .createQueryBuilder(RolePermission, 'rp')
      .where('rp.roleId IN (:...roleIds)', { roleIds })
      .andWhere('rp.permission IN (:...perms)', {
        perms: [permission, PERM_ADMINISTRATOR],
      })
      .getMany();
    return perms.length > 0;
  }

  private toSummary(guild: Guild): GuildSummary {
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

  private toInviteDto(invite: GuildInvite, guildName: string): GuildInviteDto {
    return {
      code: invite.code,
      guildId: invite.guildId,
      guildName,
      url: `/invite/${invite.code}`,
      maxUses: invite.maxUses,
      uses: invite.uses,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    };
  }

  private toCategoryDto(cat: Category): CategoryDto {
    return {
      id: cat.id,
      guildId: cat.guildId,
      name: cat.name,
      position: cat.position,
    };
  }

  async listCategories(guildId: string, userId: string): Promise<CategoryDto[]> {
    await this.ensureMember(guildId, userId);
    const cats = await this.em.find(Category, {
      where: { guildId },
      order: { position: 'ASC', name: 'ASC' },
    });
    return cats.map((c) => this.toCategoryDto(c));
  }

  async createCategory(
    guildId: string,
    userId: string,
    name: string,
  ): Promise<CategoryDto> {
    await this.requirePermission(guildId, userId, 'MANAGE_CHANNELS');
    const trimmed = name.trim().slice(0, 100);
    if (!trimmed) throw new BadRequestException('Kategori adı gerekli');
    const last = await this.em.findOne(Category, {
      where: { guildId },
      order: { position: 'DESC' },
    });
    const cat = await this.em.save(
      Category,
      this.em.create(Category, {
        guildId,
        name: trimmed,
        position: (last?.position ?? -1) + 1,
      }),
    );
    return this.toCategoryDto(cat);
  }

  async updateCategory(
    guildId: string,
    categoryId: string,
    userId: string,
    data: { name?: string; position?: number },
  ): Promise<CategoryDto> {
    await this.requirePermission(guildId, userId, 'MANAGE_CHANNELS');
    const cat = await this.em.findOne(Category, { where: { id: categoryId, guildId } });
    if (!cat) throw new NotFoundException('Kategori bulunamadı');
    if (data.name != null) {
      const trimmed = data.name.trim().slice(0, 100);
      if (!trimmed) throw new BadRequestException('Kategori adı gerekli');
      cat.name = trimmed;
    }
    if (data.position != null) cat.position = data.position;
    await this.em.save(Category, cat);
    return this.toCategoryDto(cat);
  }

  async deleteCategory(
    guildId: string,
    categoryId: string,
    userId: string,
  ): Promise<void> {
    await this.requirePermission(guildId, userId, 'MANAGE_CHANNELS');
    const cat = await this.em.findOne(Category, { where: { id: categoryId, guildId } });
    if (!cat) throw new NotFoundException('Kategori bulunamadı');
    await this.em.update(Channel, { categoryId }, { categoryId: null });
    await this.em.remove(Category, cat);
  }

  async listSlashCommands(guildId: string, userId: string) {
    await this.ensureMember(guildId, userId);
    const rows = await this.em.find(SlashCommand, {
      where: { guildId },
      order: { name: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      aliases: row.aliases ?? [],
      description: row.description,
      usage: row.usage,
      botUserId: row.botUserId,
      botName: row.botName,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async registerSlashCommand(
    guildId: string,
    userId: string,
    data: {
      name: string;
      description: string;
      usage?: string;
      aliases?: string[];
      botName?: string;
      responseTemplate?: string;
    },
  ) {
    await this.requirePermission(guildId, userId, PERM_MANAGE_GUILD);
    const name = (data.name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 32);
    if (name.length < 2) {
      throw new BadRequestException('Komut adı en az 2 karakter olmalı (a-z, 0-9, _, -)');
    }
    if (
      BUILTIN_COMMANDS.some(
        (c) => c.name === name || (c.aliases as readonly string[]).includes(name),
      )
    ) {
      throw new BadRequestException('Bu komut adı sistem komutuyla çakışıyor');
    }
    const description = (data.description ?? '').trim().slice(0, 200);
    if (!description) throw new BadRequestException('Açıklama gerekli');
    const usage = (data.usage ?? `/${name}`).trim().slice(0, 120) || `/${name}`;
    const aliases = (data.aliases ?? [])
      .map((a) => a.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32))
      .filter((a) => a.length >= 2 && a !== name)
      .slice(0, 5);
    const responseTemplate =
      (data.responseTemplate ?? '').trim().slice(0, 2000) || null;

    const existing = await this.em.findOne(SlashCommand, { where: { guildId, name } });
    if (existing) throw new BadRequestException('Bu isimde komut zaten var');

    const row = this.em.create(SlashCommand, {
      guildId,
      name,
      description,
      usage,
      aliases: aliases.length ? aliases : null,
      responseTemplate,
      botUserId: null,
      botName: (data.botName ?? 'Özel').trim().slice(0, 64) || 'Özel',
      createdById: userId,
    });
    await this.em.save(SlashCommand, row);
    return {
      id: row.id,
      name: row.name,
      aliases: row.aliases ?? [],
      description: row.description,
      usage: row.usage,
      responseTemplate: row.responseTemplate,
      botUserId: row.botUserId,
      botName: row.botName,
      createdById: row.createdById,
      createdAt: (row.createdAt ?? new Date()).toISOString(),
    };
  }

  async deleteSlashCommand(
    guildId: string,
    commandId: string,
    userId: string,
  ): Promise<void> {
    await this.requirePermission(guildId, userId, PERM_MANAGE_GUILD);
    const row = await this.em.findOne(SlashCommand, { where: { id: commandId, guildId } });
    if (!row) throw new NotFoundException('Komut bulunamadı');
    await this.em.remove(SlashCommand, row);
  }
}
