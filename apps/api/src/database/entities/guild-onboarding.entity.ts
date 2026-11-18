import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';
import type { GuildOnboardingQuestion } from '@dracord/types';
import { CuidEntity } from './cuid-base.entity';

/** B5 — sunucuya katılış ekranı (kurallar + sorular → rol / kanal önerisi) */
@Entity('guild_onboarding')
@Index(['guildId'], { unique: true })
export class GuildOnboarding extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  rules!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  questions!: GuildOnboardingQuestion[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  defaultChannelIds!: string[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
