import { Column, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Üye haftalık sayaçları (C3) — week = Europe/Istanbul pazartesi */
@Entity('member_weekly_stats')
@Index(['guildId', 'userId', 'week'], { unique: true })
@Index(['guildId', 'week'])
export class MemberWeeklyStats extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'date' })
  week!: string;

  /** Mesaj + ses ile kazanılan XP */
  @Column({ type: 'int', default: 0 })
  xp!: number;

  /** Görev ödülleri */
  @Column({ type: 'int', default: 0 })
  bonusXp!: number;

  @Column({ type: 'int', default: 0 })
  messages!: number;

  @Column({ type: 'int', default: 0 })
  voiceMinutes!: number;
}
