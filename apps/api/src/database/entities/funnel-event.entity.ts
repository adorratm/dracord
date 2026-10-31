import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Kalıcı funnel / ürün metrik olayı */
@Entity('funnel_events')
@Index(['event', 'createdAt'])
export class FunnelEventRow extends CuidEntity {
  @Index()
  @Column({ type: 'varchar', length: 64 })
  event!: string;

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, string> | null;

  @Column({ type: 'varchar', nullable: true })
  userId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
