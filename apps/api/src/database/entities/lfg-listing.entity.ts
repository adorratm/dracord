import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** C5 — takım arkadaşı arama ilanı (sunucu içi, süreli) */
@Entity('lfg_listings')
@Index(['guildId', 'expiresAt'])
export class LfgListing extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  authorId!: string;

  @Column({ type: 'varchar' })
  game!: string;

  @Column({ type: 'int' })
  slots!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  memberIds!: string[];

  @Column({ type: 'varchar', nullable: true })
  rank!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ type: 'boolean', default: false })
  voice!: boolean;

  @Column({ type: 'varchar', nullable: true })
  voiceChannelId!: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
