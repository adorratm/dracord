import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Guild } from './guild.entity';
import type { RolePermission } from './role-permission.entity';
import type { GuildMemberRole } from './guild-member-role.entity';

@Entity('roles')
@Index(['guildId'])
@Index(['guildId', 'name'])
export class Role extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', default: '#99AAB5' })
  color!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  /** Animasyonlu rozet: crown | shield | star | fire | sparkle | diamond | heart | none */
  @Column({ type: 'varchar', default: 'none' })
  badgeKey!: string;

  /** Profil kartı arka planı: aurora | ember | ocean | noir | candy | mint | sunset | none */
  @Column({ type: 'varchar', default: 'none' })
  profileBgKey!: string;

  @Column({ type: 'boolean', default: false })
  hoist!: boolean;

  @ManyToOne('Guild', 'roles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildId' })
  guild!: Guild;

  @OneToMany('RolePermission', 'role')
  permissions!: RolePermission[];

  @OneToMany('GuildMemberRole', 'role')
  members!: GuildMemberRole[];
}
