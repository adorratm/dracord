import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

export type TrustSafetyCategory =
  | 'csam'
  | 'sexual'
  | 'drugs'
  | 'violence'
  | 'gambling'
  | 'copyright'
  | 'other';

export type TrustSafetyStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';

/** Admin T&S inceleme kuyruğu kaydı */
@Entity('trust_safety_reports')
export class TrustSafetyReport extends CuidEntity {
  @Index()
  @Column({ type: 'varchar' })
  category!: TrustSafetyCategory;

  @Index()
  @Column({ type: 'varchar', default: 'open' })
  status!: TrustSafetyStatus;

  @Column({ type: 'varchar', nullable: true })
  guildId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  channelId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', default: 'auto' })
  source!: string;

  @Column({ type: 'float', default: 0 })
  score!: number;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  evidence!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  resolvedByUserId!: string | null;
}
