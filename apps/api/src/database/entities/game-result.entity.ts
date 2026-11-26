import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Biten oyun oturumundan oyuncu başına sonuç (profilde oyun istatistikleri) */
@Entity('game_results')
@Index(['userId', 'kind'])
@Index(['sessionId', 'userId'], { unique: true })
export class GameResult extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  kind!: string;

  @Column({ type: 'varchar' })
  sessionId!: string;

  @Column({ type: 'varchar', nullable: true })
  guildId!: string | null;

  @Column({ type: 'boolean' })
  won!: boolean;

  /** Harici oyunlar: puan, leş, süre… (oyun sunucusu bildirir) */
  @Column({ type: 'jsonb', nullable: true })
  stats!: Record<string, number | string | boolean> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
