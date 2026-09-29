import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { GuildInviteDto, GuildPermissionsDto, GuildSummary, PublicUser } from '@dracord/types';
import { createId } from '@paralleldrive/cuid2';
import { toPublicUser } from '@/common/user.mapper';
import {
  GuildPermissions,
  type GuildPermissionName,
} from '@/common/permissions';
import { Category } from '@/database/entities/category.entity';
import { Channel } from '@/database/entities/channel.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildInvite } from '@/database/entities/guild-invite.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildMemberRole } from '@/database/entities/guild-member-role.entity';
import { RolePermission } from '@/database/entities/role-permission.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { SearchIndexerService } from '@/search/search-indexer.service';

export const PERM_MANAGE_GUILD = GuildPermissions.MANAGE_GUILD;
export const PERM_MANAGE_CHANNELS = GuildPermissions.MANAGE_CHANNELS;
export const PERM_ADMINISTRATOR = GuildPermissions.ADMINISTRATOR;
export const PERM_MANAGE_MESSAGES = GuildPermissions.MANAGE_MESSAGES;

@Injectable()
export class GuildsService {
  constructor(
    private readonly em: EntityManager,
    private readonly indexer: SearchIndexerService,
  ) {}

  async listForUser(userId: string): Promise<GuildSummary[]> {
    const memberships = await this.em.find(GuildMember, {
      where: { userId },
      relations: { guild: true },
    });
    return memberships.map((m) => this.toSummary(m.guild));
  }

  async discover(): Promise<GuildSummary[]> {
    const guilds = await this.em.find(Guild, {
      where: { discoverable: true },
      take: 50,
      order: { createdAt: 'DESC' },
    });
    const withCounts = await Promise.all(
      guilds.map(async (g) => {
        const memberCount = await this.em.count(GuildMember, {
          where: { guildId: g.id },
        });
        return { ...this.toSummary(g), memberCount };
      }),
    );
    return withCounts;
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
    },
  ): Promise<GuildSummary> {
    await this.ensureMember(guildId, userId);
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');

    const touchesIdentity =
      data.name != null || data.iconUrl !== undefined || data.bannerUrl !== undefined;
    if (touchesIdentity) {
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
    if (owner) {
      return {
        guildId,
        owner: true,
        permissions: Object.values(GuildPermissions) as GuildPermissionsDto['permissions'],
      };
    }
    const permissions = await this.collectMemberPermissions(guildId, userId);
    return { guildId, owner: false, permissions };
  }

  async collectMemberPermissions(
    guildId: string,
    userId: string,
  ): Promise<GuildPermissionsDto['permissions']> {
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) return [];
    const links = await this.em.find(GuildMemberRole, {
      where: { guildMemberId: member.id },
    });
    if (!links.length) return [];
    const roleIds = links.map((l) => l.roleId);
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

    const existing = await this.em.findOne(GuildMember, {
      where: { guildId: invite.guildId, userId },
    });
    if (!existing) {
      await this.em.save(
        GuildMember,
        this.em.create(GuildMember, { guildId: invite.guildId, userId }),
      );
      invite.uses += 1;
      await this.em.save(GuildInvite, invite);
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
    const existing = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!existing) {
      await this.em.save(
        GuildMember,
        this.em.create(GuildMember, { guildId, userId }),
      );
    }
    return this.toSummary(guild);
  }

  async listMembers(guildId: string, userId: string): Promise<PublicUser[]> {
    await this.ensureMember(guildId, userId);
    const members = await this.em.find(GuildMember, {
      where: { guildId },
      relations: { user: true },
      take: 250,
      order: { joinedAt: 'ASC' },
    });
    return members.filter((m) => m.user).map((m) => toPublicUser(m.user));
  }

  async ensureMember(guildId: string, userId: string): Promise<void> {
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) throw new ForbiddenException('Not a member of this guild');
  }

  async requireOwner(guildId: string, userId: string): Promise<Guild> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can manage this guild');
    }
    return guild;
  }

  async requirePermission(
    guildId: string,
    userId: string,
    permission: string,
  ): Promise<Guild> {
    const guild = await this.em.findOne(Guild, { where: { id: guildId } });
    if (!guild) throw new NotFoundException('Guild not found');
    if (guild.ownerId === userId) return guild;

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
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId },
    });
    if (!member) return false;

    const links = await this.em.find(GuildMemberRole, {
      where: { guildMemberId: member.id },
    });
    if (!links.length) return false;

    const roleIds = links.map((l) => l.roleId);
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
}
