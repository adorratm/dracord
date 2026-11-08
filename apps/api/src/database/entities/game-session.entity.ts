import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Ses kanalında çalışan harici oyun oturumu */
@Entity('game_sessions')
@Index(['guildId', 'channelId', 'status'])
@Index(['gameId', 'status'])
export class GameSession extends CuidEntity {
  @Column({ type: 'varchar' })
  gameId!: string;

  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar' })
  hostUserId!: string;

  @Column({ type: 'jsonb', default: [] })
  participantIds!: string[];

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'ended';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;
}
