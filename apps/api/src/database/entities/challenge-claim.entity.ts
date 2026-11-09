import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Haftalık görev ödülü alındı (C3) — bir kez */
@Entity('challenge_claims')
@Index(['guildId', 'userId', 'challengeId'], { unique: true })
export class ChallengeClaim extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  /** `${week}:${kind}` */
  @Column({ type: 'varchar' })
  challengeId!: string;

  @Column({ type: 'int' })
  rewardXp!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
