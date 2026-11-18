import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** B7 — çekiliş */
@Entity('giveaways')
@Index(['guildId', 'endsAt'])
export class Giveaway extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar' })
  hostId!: string;

  @Column({ type: 'varchar' })
  prize!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'int', default: 1 })
  winnersCount!: number;

  @Column({ type: 'varchar', nullable: true })
  requiredRoleId!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  entrantIds!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  winnerIds!: string[];

  @Column({ type: 'timestamptz' })
  endsAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/** B7 — sunucu doğum günü kutlaması ayarı */
@Entity('guild_birthday_settings')
export class GuildBirthdaySettings {
  @PrimaryColumn({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  channelId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  roleId!: string | null;

  /** son kutlanan gün (YYYY-MM-DD, Europe/Istanbul) — aynı gün iki kez kutlanmaz */
  @Column({ type: 'varchar', nullable: true })
  lastRunDay!: string | null;

  /** dün rol verilenler: bugün geri alınır */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  roleHolderIds!: string[];
}
