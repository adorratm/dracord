import { Column, CreateDateColumn, Entity, Index, UpdateDateColumn } from 'typeorm';
import type { AutomodReason, GuildAutomodConfigDto } from '@dracord/types';
import { CuidEntity } from './cuid-base.entity';

/** Sunucu otomatik moderasyon kuralları (D2) */
@Entity('guild_automod_configs')
@Index(['guildId'], { unique: true })
export class GuildAutomodConfig extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'jsonb' })
  config!: Omit<GuildAutomodConfigDto, 'guildId'>;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** Otomatik moderasyon günlüğü (D2) — sunucu başına son N kayıt tutulur */
@Entity('guild_automod_events')
@Index(['guildId', 'createdAt'])
export class GuildAutomodEvent extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar', nullable: true })
  channelId!: string | null;

  @Column({ type: 'varchar' })
  reason!: AutomodReason;

  @Column({ type: 'varchar', nullable: true })
  detail!: string | null;

  /** İlk 160 karakter (moderatör incelemesi) */
  @Column({ type: 'varchar', length: 200 })
  preview!: string;

  @Column({ type: 'varchar' })
  action!: 'blocked' | 'timeout';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
