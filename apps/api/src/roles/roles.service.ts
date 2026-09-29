import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { RoleDto } from '@dracord/types';
import { GuildsService } from '@/guilds/guilds.service';
import { Role } from '@/database/entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
  ) {}

  async listGuildRoles(guildId: string, userId: string): Promise<RoleDto[]> {
    await this.guilds.ensureMember(guildId, userId);
    const roles = await this.em.find(Role, {
      where: { guildId },
      relations: { permissions: true },
      order: { position: 'ASC' },
    });
    return roles.map((r) => ({
      id: r.id,
      guildId: r.guildId,
      name: r.name,
      color: r.color,
      position: r.position,
      permissions: r.permissions.map((p) => p.permission),
    }));
  }
}
