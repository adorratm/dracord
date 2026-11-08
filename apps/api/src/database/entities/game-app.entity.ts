import { Column, CreateDateColumn, Entity, Index, UpdateDateColumn } from 'typeorm';
import type { GameAppStatus, GamePlatform } from '@dracord/types';
import { CuidEntity } from './cuid-base.entity';

/** Harici oyun (C1) — geliştirici yükler, admin yayına alır */
@Entity('game_apps')
@Index(['slug'], { unique: true })
@Index(['status'])
@Index(['ownerUserId'])
export class GameApp extends CuidEntity {
  @Column({ type: 'varchar' })
  ownerUserId!: string;

  @Column({ type: 'varchar', length: 40 })
  name!: string;

  @Column({ type: 'varchar', length: 48 })
  slug!: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  shortDescription!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverUrl!: string | null;

  @Column({ type: 'varchar' })
  entryUrl!: string;

  @Column({ type: 'int', default: 1 })
  minPlayers!: number;

  @Column({ type: 'int', default: 8 })
  maxPlayers!: number;

  @Column({ type: 'varchar', default: 'any' })
  orientation!: 'any' | 'landscape' | 'portrait';

  @Column({ type: 'jsonb', default: ['web', 'desktop'] })
  platforms!: GamePlatform[];

  @Column({ type: 'varchar', default: 'draft' })
  status!: GameAppStatus;

  @Column({ type: 'text', nullable: true })
  reviewNote!: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'jsonb', default: [] })
  testerUserIds!: string[];

  /** sha256(secret) — oyun sunucusu token doğrulaması için */
  @Column({ type: 'varchar', nullable: true })
  secretHash!: string | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  secretLast4!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
