import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import type {
  RoleBadgeKey,
  RoleDto,
  RoleProfileBgKey,
} from '@dracord/types';
import { PlatformAdminService } from '@/auth/platform-admin.service';
import { GuildPermissions } from '@/common/permissions';
import { GuildsService } from '@/guilds/guilds.service';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildMemberRole } from '@/database/entities/guild-member-role.entity';
import { Role } from '@/database/entities/role.entity';
import { RolePermission } from '@/database/entities/role-permission.entity';

const BADGE_KEYS = new Set([
  'none',
  'crown',
  'shield',
  'star',
  'fire',
  'sparkle',
  'diamond',
  'heart',
]);
const BG_KEYS = new Set([
  'none',
  'aurora',
  'ember',
  'ocean',
  'noir',
  'candy',
  'mint',
  'sunset',
]);

export type CreateRoleInput = {
  name: string;
  color?: string;
  permissions?: string[];
  badgeKey?: RoleBadgeKey | null;
  profileBgKey?: RoleProfileBgKey | null;
  hoist?: boolean;
  position?: number;
};

export type UpdateRoleInput = Partial<CreateRoleInput>;

@Injectable()
export class RolesService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly platformAdmin: PlatformAdminService,
  ) {}

  private toDto(r: Role): RoleDto {
    return {
      id: r.id,
      guildId: r.guildId,
      name: r.name,
      color: r.color,
      position: r.position,
      permissions: (r.permissions ?? []).map((p) => p.permission),
      badgeKey: (r.badgeKey as RoleBadgeKey) || 'none',
      profileBgKey: (r.profileBgKey as RoleProfileBgKey) || 'none',
      hoist: Boolean(r.hoist),
    };
  }

  private normalizeBadge(v?: string | null): string {
    const key = (v || 'none').toLowerCase();
    return BADGE_KEYS.has(key) ? key : 'none';
  }

  private normalizeBg(v?: string | null): string {
    const key = (v || 'none').toLowerCase();
    return BG_KEYS.has(key) ? key : 'none';
  }

  async listGuildRoles(guildId: string, userId: string): Promise<RoleDto[]> {
    await this.guilds.ensureMember(guildId, userId);
    const roles = await this.em.find(Role, {
      where: { guildId },
      relations: { permissions: true },
      order: { position: 'DESC' },
    });
    return roles.map((r) => this.toDto(r));
  }

  async createRole(guildId: string, userId: string, input: CreateRoleInput): Promise<RoleDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_ROLES);
    const name = input.name?.trim();
    if (!name || name.length < 1) throw new BadRequestException('Rol adı gerekli');
    if (name.length > 32) throw new BadRequestException('Rol adı çok uzun');

    const maxPos = await this.em
      .createQueryBuilder(Role, 'r')
      .select('MAX(r.position)', 'max')
      .where('r.guildId = :guildId', { guildId })
      .getRawOne<{ max: string | null }>();
    const position = input.position ?? (Number(maxPos?.max ?? 0) + 1);

    const role = await this.em.save(
      Role,
      this.em.create(Role, {
        guildId,
        name,
        color: input.color?.trim() || '#99AAB5',
        position,
        badgeKey: this.normalizeBadge(input.badgeKey),
        profileBgKey: this.normalizeBg(input.profileBgKey),
        hoist: Boolean(input.hoist),
      }),
    );

    const perms = [...new Set(input.permissions ?? [])].filter(Boolean);
    if (perms.length) {
      await this.em.save(
        RolePermission,
        perms.map((permission) =>
          this.em.create(RolePermission, { roleId: role.id, permission }),
        ),
      );
    }

    const full = await this.em.findOne(Role, {
      where: { id: role.id },
      relations: { permissions: true },
    });
    return this.toDto(full!);
  }

  async updateRole(
    guildId: string,
    roleId: string,
    userId: string,
    input: UpdateRoleInput,
  ): Promise<RoleDto> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_ROLES);
    const role = await this.em.findOne(Role, {
      where: { id: roleId, guildId },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundException('Rol bulunamadı');
    const isEveryone = role.name === '@everyone';
    if (isEveryone && input.name != null && input.name.trim() !== '@everyone') {
      throw new BadRequestException('@everyone rolü yeniden adlandırılamaz');
    }

    if (input.name != null && !isEveryone) {
      const name = input.name.trim();
      if (!name) throw new BadRequestException('Rol adı gerekli');
      role.name = name.slice(0, 32);
    }
    if (input.color != null) role.color = input.color.trim() || role.color;
    if (input.position != null) role.position = input.position;
    if (input.badgeKey !== undefined) role.badgeKey = this.normalizeBadge(input.badgeKey);
    if (input.profileBgKey !== undefined) {
      role.profileBgKey = this.normalizeBg(input.profileBgKey);
    }
    if (input.hoist !== undefined) role.hoist = Boolean(input.hoist);
    await this.em.save(Role, role);

    if (input.permissions) {
      await this.em.delete(RolePermission, { roleId: role.id });
      const perms = new Set(input.permissions.filter(Boolean));
      // @everyone her zaman kanalları görebilmeli (katılan üyeler boş sunucu görmesin)
      if (isEveryone) {
        perms.add(GuildPermissions.VIEW_CHANNELS);
        perms.add(GuildPermissions.SEND_MESSAGES);
      }
      if (perms.size) {
        await this.em.save(
          RolePermission,
          [...perms].map((permission) =>
            this.em.create(RolePermission, { roleId: role.id, permission }),
          ),
        );
      }
    }

    const full = await this.em.findOne(Role, {
      where: { id: role.id },
      relations: { permissions: true },
    });
    return this.toDto(full!);
  }

  async deleteRole(guildId: string, roleId: string, userId: string): Promise<{ ok: true }> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_ROLES);
    const role = await this.em.findOne(Role, { where: { id: roleId, guildId } });
    if (!role) throw new NotFoundException('Rol bulunamadı');
    if (role.name === '@everyone') {
      throw new BadRequestException('@everyone silinemez');
    }
    await this.em.remove(Role, role);
    return { ok: true };
  }

  async setMemberRoles(
    guildId: string,
    targetUserId: string,
    actorId: string,
    roleIds: string[],
  ): Promise<{ ok: true; roleIds: string[] }> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_ROLES);
    await this.platformAdmin.assertNotPlatformAdminTarget(targetUserId);
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId: targetUserId },
      relations: { roles: true },
    });
    if (!member) throw new NotFoundException('Üye bulunamadı');

    const unique = [...new Set(roleIds)];
    const roles =
      unique.length === 0
        ? []
        : await this.em.find(Role, { where: { guildId, id: In(unique) } });
    if (roles.length !== unique.length) {
      throw new BadRequestException('Geçersiz rol');
    }

    await this.em.delete(GuildMemberRole, { guildMemberId: member.id });
    const everyoneId = await this.guilds.ensureDefaultEveryoneRole(guildId);
    const withEveryone = roles.some((r) => r.id === everyoneId)
      ? roles
      : [
          ...roles,
          ...(await this.em.find(Role, { where: { id: everyoneId } })),
        ];
    if (withEveryone.length) {
      await this.em.save(
        GuildMemberRole,
        withEveryone.map((r) =>
          this.em.create(GuildMemberRole, {
            guildMemberId: member.id,
            roleId: r.id,
          }),
        ),
      );
    }
    return { ok: true, roleIds: withEveryone.map((r) => r.id) };
  }

  async addMemberRole(
    guildId: string,
    targetUserId: string,
    actorId: string,
    roleId: string,
  ): Promise<{ ok: true }> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_ROLES);
    await this.platformAdmin.assertNotPlatformAdminTarget(targetUserId);
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Üye bulunamadı');
    const role = await this.em.findOne(Role, { where: { id: roleId, guildId } });
    if (!role) throw new NotFoundException('Rol bulunamadı');
    const existing = await this.em.findOne(GuildMemberRole, {
      where: { guildMemberId: member.id, roleId },
    });
    if (!existing) {
      await this.em.save(
        GuildMemberRole,
        this.em.create(GuildMemberRole, {
          guildMemberId: member.id,
          roleId,
        }),
      );
    }
    return { ok: true };
  }

  async removeMemberRole(
    guildId: string,
    targetUserId: string,
    actorId: string,
    roleId: string,
  ): Promise<{ ok: true }> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_ROLES);
    await this.platformAdmin.assertNotPlatformAdminTarget(targetUserId);
    const member = await this.em.findOne(GuildMember, {
      where: { guildId, userId: targetUserId },
    });
    if (!member) throw new NotFoundException('Üye bulunamadı');
    await this.em.delete(GuildMemberRole, {
      guildMemberId: member.id,
      roleId,
    });
    return { ok: true };
  }
}
