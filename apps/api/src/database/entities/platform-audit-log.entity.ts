import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Platform / bot API denetim kaydı (guild audit’ten ayrı) */
@Entity('platform_audit_logs')
@Index(['applicationId', 'createdAt'])
@Index(['action', 'createdAt'])
export class PlatformAuditLog extends CuidEntity {
  @Column({ type: 'varchar', nullable: true })
  applicationId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'varchar' })
  action!: string;

  @Column({ type: 'varchar', nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
