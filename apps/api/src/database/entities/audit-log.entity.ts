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

@Entity('audit_logs')
@Index(['guildId', 'createdAt'])
export class AuditLog extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  actorId!: string;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar', nullable: true })
  targetId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetType!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('Guild', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guildId' })
  guild!: Guild;

  @ManyToOne('User', { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorId' })
  actor!: User;
}
