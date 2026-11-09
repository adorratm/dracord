import { Column, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/**
 * Sunucu günlük sayaçları (B2) — mesajlar tablodan hesaplanır;
 * burada yalnız geçmişi başka yerde tutulmayanlar: katılan/ayrılan, ses dakikası.
 * day = Europe/Istanbul takvim günü (YYYY-MM-DD).
 */
@Entity('guild_stats_daily')
@Index(['guildId', 'day'], { unique: true })
export class GuildStatsDaily extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'date' })
  day!: string;

  @Column({ type: 'int', default: 0 })
  joins!: number;

  @Column({ type: 'int', default: 0 })
  leaves!: number;

  @Column({ type: 'int', default: 0 })
  voiceMinutes!: number;
}
