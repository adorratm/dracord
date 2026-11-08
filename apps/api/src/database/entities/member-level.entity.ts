import { Column, Entity, Index, UpdateDateColumn } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Sunucu bazlı üye XP / seviye (B1) */
@Entity('member_levels')
@Index(['guildId', 'userId'], { unique: true })
@Index(['guildId', 'xp'])
export class MemberLevel extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'int', default: 0 })
  xp!: number;

  @Column({ type: 'int', default: 0 })
  level!: number;

  @Column({ type: 'int', default: 0 })
  messageCount!: number;

  @Column({ type: 'int', default: 0 })
  voiceMinutes!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageXpAt!: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
