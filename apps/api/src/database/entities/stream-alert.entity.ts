import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** D7 — Twitch / YouTube canlı yayın bildirimi aboneliği */
@Entity('stream_alerts')
@Index('IDX_stream_alerts_guild', ['guildId'])
@Index('IDX_stream_alerts_checked', ['checkedAt'])
export class StreamAlert extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  /** bildirimin düşeceği metin kanalı */
  @Column({ type: 'varchar' })
  channelId!: string;

  /** 'twitch' | 'youtube' */
  @Column({ type: 'varchar', length: 12 })
  platform!: string;

  /** twitch: kullanıcı adı (küçük harf) · youtube: UC… kanal kimliği */
  @Column({ type: 'varchar', length: 64 })
  handle!: string;

  @Column({ type: 'varchar', length: 100 })
  displayName!: string;

  /** {name} {title} {url} yer tutucuları */
  @Column({ type: 'varchar', length: 300, nullable: true })
  message!: string | null;

  @Column({ type: 'boolean', default: false })
  isLive!: boolean;

  /** son bildirilen yayın / video kimliği (tekrar bildirme yok) */
  @Column({ type: 'varchar', length: 64, nullable: true })
  lastItemId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastNotifiedAt!: Date | null;

  @Column({ type: 'timestamptz', default: () => "'1970-01-01'" })
  checkedAt!: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  lastError!: string | null;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
