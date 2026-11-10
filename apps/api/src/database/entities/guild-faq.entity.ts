import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';
import type { GuildFaqEntry } from '@dracord/types';
import { CuidEntity } from './cuid-base.entity';

/** Sunucu SSS (D4) */
@Entity('guild_faqs')
@Index(['guildId'], { unique: true })
export class GuildFaq extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  entries!: GuildFaqEntry[];

  @Column({ type: 'boolean', default: false })
  autoAnswer!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  autoChannelIds!: string[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
