import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Guild } from './guild.entity';
import type { User } from './user.entity';

@Entity('guild_invites')
export class GuildInvite extends CuidEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  code!: string;

  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  creatorId!: string;

  @Column({ type: 'int', nullable: true })
  maxUses!: number | null;

  @Column({ type: 'int', default: 0 })
  uses!: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('Guild', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildId' })
  guild!: Guild;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creatorId' })
  creator!: User;
}
