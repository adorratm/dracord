import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  UpdateDateColumn,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

export type ActivityKind =
  | 'billiards'
  | 'okey'
  | 'bowling'
  | 'tavla'
  | 'watch_party';

export type ActivityStatus = 'lobby' | 'playing' | 'ended';

@Entity('activity_sessions')
export class ActivitySession extends CuidEntity {
  @Index()
  @Column({ type: 'varchar' })
  guildId!: string;

  /** GAME / WATCH_PARTY kanal id (eski kolon adı: voiceChannelId) */
  @Index()
  @Column({ type: 'varchar', name: 'voiceChannelId' })
  channelId!: string;

  @Column({ type: 'varchar' })
  kind!: ActivityKind;

  @Column({ type: 'varchar' })
  hostUserId!: string;

  @Column({ type: 'int' })
  minPlayers!: number;

  @Column({ type: 'int' })
  maxPlayers!: number;

  @Column({ type: 'varchar', default: 'lobby' })
  status!: ActivityStatus;

  @Column({ type: 'jsonb', default: [] })
  playerIds!: string[];

  @Column({ type: 'jsonb', default: [] })
  spectatorIds!: string[];

  @Column({ type: 'jsonb', default: {} })
  state!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
