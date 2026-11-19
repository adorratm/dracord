import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, Unique } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** B6 — destek talebi ayarı (sunucu başına bir) */
@Entity('guild_ticket_settings')
export class GuildTicketSettings {
  @PrimaryColumn({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  staffRoleIds!: string[];

  @Column({ type: 'varchar', nullable: true })
  logChannelId!: string | null;

  @Column({ type: 'varchar', default: '' })
  greeting!: string;

  /** son verilen talep numarası */
  @Column({ type: 'int', default: 0 })
  counter!: number;
}

/** B6 — destek talebi (özel kanal) */
@Entity('tickets')
@Unique(['guildId', 'number'])
@Index(['guildId', 'openerId'])
export class Ticket extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'int' })
  number!: number;

  @Column({ type: 'varchar' })
  openerId!: string;

  @Column({ type: 'varchar' })
  subject!: string;

  @Column({ type: 'varchar', default: 'open' })
  status!: 'open' | 'closed';

  @Column({ type: 'varchar', nullable: true })
  closedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
