import { Column, CreateDateColumn, Entity, Index, UpdateDateColumn } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

@Entity('platform_applications')
export class PlatformApplication extends CuidEntity {
  @Index()
  @Column({ type: 'varchar' })
  ownerUserId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  /** OAuth redirect URI listesi */
  @Column({ type: 'jsonb', default: [] })
  redirectUris!: string[];

  @Column({ type: 'jsonb', default: ['bot', 'identify'] })
  scopes!: string[];

  @Column({ type: 'varchar', nullable: true })
  botUserId!: string | null;

  /** sha256(token) — düz token saklanmaz */
  @Column({ type: 'varchar', nullable: true })
  botTokenHash!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  botTokenLast4!: string | null;

  @Column({ type: 'varchar', nullable: true })
  webhookUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  webhookSecret!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
