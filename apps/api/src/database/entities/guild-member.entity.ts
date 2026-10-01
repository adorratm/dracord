import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Guild } from './guild.entity';
import type { User } from './user.entity';
import type { GuildMemberRole } from './guild-member-role.entity';

@Entity('guild_members')
@Unique(['guildId', 'userId'])
export class GuildMember extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar', nullable: true })
  nickname!: string | null;

  /** Timeout bitiş zamanı; null = yok */
  @Column({ type: 'timestamptz', nullable: true })
  timeoutUntil!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;

  @ManyToOne('Guild', 'members', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildId' })
  guild!: Guild;

  @ManyToOne('User', 'guildMembers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @OneToMany('GuildMemberRole', 'guildMember')
  roles!: GuildMemberRole[];
}
