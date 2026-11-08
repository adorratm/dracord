import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';
import type { LevelRoleReward } from '@dracord/types';
import { CuidEntity } from './cuid-base.entity';

/** Sunucu seviye ayarları — satır yoksa varsayılanlar geçerli */
@Entity('guild_level_configs')
@Index(['guildId'], { unique: true })
export class GuildLevelConfig extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'varchar', default: 'notification' })
  announce!: 'notification' | 'off';

  @Column({ type: 'int', default: 15 })
  messageXpMin!: number;

  @Column({ type: 'int', default: 25 })
  messageXpMax!: number;

  @Column({ type: 'int', default: 4 })
  voiceXpPerMinute!: number;

  @Column({ type: 'simple-json', nullable: true })
  roleRewards!: LevelRoleReward[] | null;

  @Column({ type: 'simple-json', nullable: true })
  noXpChannelIds!: string[] | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
