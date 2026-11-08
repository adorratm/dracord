import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Sunucu soundboard sesi (A2) */
@Entity('guild_sounds')
@Index(['guildId'])
export class GuildSound extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar', length: 32 })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  emoji!: string | null;

  @Column({ type: 'varchar' })
  url!: string;

  @Column({ type: 'varchar', default: 'audio/mpeg' })
  contentType!: string;

  @Column({ type: 'float', default: 0 })
  durationSec!: number;

  @Column({ type: 'float', default: 1 })
  volume!: number;

  @Column({ type: 'varchar' })
  createdById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
