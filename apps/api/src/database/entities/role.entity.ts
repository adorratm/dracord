import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Guild } from './guild.entity';
import type { RolePermission } from './role-permission.entity';
import type { GuildMemberRole } from './guild-member-role.entity';

@Entity('roles')
export class Role extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', default: '#99AAB5' })
  color!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @ManyToOne('Guild', 'roles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildId' })
  guild!: Guild;

  @OneToMany('RolePermission', 'role')
  permissions!: RolePermission[];

  @OneToMany('GuildMemberRole', 'role')
  members!: GuildMemberRole[];
}
