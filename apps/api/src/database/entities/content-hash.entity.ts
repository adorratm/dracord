import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { TrustSafetyCategory } from './trust-safety-report.entity';

/**
 * Yerel içerik parmak izi eşlemesi.
 * PhotoDNA / NCMEC ortaklığı değildir — partner hash’leri buraya
 * import edilebilir; gerçek CSAM pipeline yasal anlaşma ister.
 */
@Entity('content_hashes')
export class ContentHash extends CuidEntity {
  /** SHA-256 öneki (24 hex) veya tam hash — algoritmaya göre */
  @Index()
  @Column({ type: 'varchar', length: 128 })
  hashValue!: string;

  @Column({ type: 'varchar', default: 'sha256-prefix' })
  algorithm!: string;

  @Column({ type: 'varchar' })
  category!: TrustSafetyCategory;

  @Column({ type: 'float', default: 0.95 })
  score!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'varchar', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
