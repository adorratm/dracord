import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** B9 — yıldız panosu ayarı (sunucu başına bir) */
@Entity('guild_starboards')
export class GuildStarboard {
  @PrimaryColumn({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  channelId!: string | null;

  @Column({ type: 'varchar', default: '⭐' })
  emoji!: string;

  @Column({ type: 'int', default: 3 })
  threshold!: number;

  /** bu kanallardaki mesajlar panoya düşmez */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  ignoredChannelIds!: string[];

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** B9 — panoya düşen mesaj → panodaki kopyası */
@Entity('starboard_entries')
export class StarboardEntry {
  @PrimaryColumn({ type: 'varchar' })
  messageId!: string;

  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  starChannelId!: string;

  @Column({ type: 'varchar' })
  starMessageId!: string;

  @Column({ type: 'int', default: 0 })
  count!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
