import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import type { TournamentGame, TournamentMatch, TournamentStatus } from '@dracord/types';
import { CuidEntity } from './cuid-base.entity';

/** Turnuva (C2) — tek eleme; ağaç jsonb (satır kilidiyle atomik güncellenir) */
@Entity('tournaments')
@Index(['guildId', 'status'])
export class Tournament extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar' })
  game!: TournamentGame;

  @Column({ type: 'varchar', nullable: true })
  externalGameName!: string | null;

  @Column({ type: 'varchar', default: 'registration' })
  status!: TournamentStatus;

  @Column({ type: 'int', default: 16 })
  maxPlayers!: number;

  @Column({ type: 'varchar' })
  creatorId!: string;

  /** Kayıt sırası; başlarken karıştırılıp tohum sırasına çevrilir */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  participantIds!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  matches!: TournamentMatch[];

  @Column({ type: 'int', default: 0 })
  rounds!: number;

  @Column({ type: 'varchar', nullable: true })
  winnerId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
