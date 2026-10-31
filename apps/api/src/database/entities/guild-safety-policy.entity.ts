import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/**
 * Sunucu güvenlik politikası.
 * Platform floor kapatılamaz; guild yalnızca eşikleri hafifletebilir (soften).
 */
@Entity('guild_safety_policies')
export class GuildSafetyPolicy extends CuidEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  guildId!: string;

  /** 0–1; düşük = daha sıkı. Floor altına inilemez. */
  @Column({ type: 'float', default: 0.55 })
  nsfwThreshold!: number;

  @Column({ type: 'float', default: 0.7 })
  gamblingThreshold!: number;

  @Column({ type: 'boolean', default: true })
  scanScreenShare!: boolean;

  @Column({ type: 'boolean', default: true })
  scanAttachments!: boolean;

  @Column({ type: 'boolean', default: true })
  scanText!: boolean;

  /** Telif heuristiği (pencere başlığı vb.) — TrustedGuild dışında kapatılamaz */
  @Column({ type: 'boolean', default: true })
  copyrightHeuristics!: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
