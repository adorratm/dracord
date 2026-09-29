import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { GuildMember } from './guild-member.entity';
import type { Role } from './role.entity';

@Entity('guild_member_roles')
export class GuildMemberRole {
  @PrimaryColumn({ type: 'varchar' })
  guildMemberId!: string;

  @PrimaryColumn({ type: 'varchar' })
  roleId!: string;

  @ManyToOne('GuildMember', 'roles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildMemberId' })
  guildMember!: GuildMember;

  @ManyToOne('Role', 'members', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roleId' })
  role!: Role;
}
