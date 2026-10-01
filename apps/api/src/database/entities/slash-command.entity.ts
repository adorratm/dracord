import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Guild } from './guild.entity';
import type { User } from './user.entity';

/** Sunucuya özel veya global slash komut kaydı */
@Entity('slash_commands')
@Unique(['guildId', 'name'])
@Index(['guildId'])
export class SlashCommand extends CuidEntity {
  /** null = global (builtin dışı uygulama komutu) */
  @Column({ type: 'varchar', nullable: true })
  guildId!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'simple-json', nullable: true })
  aliases!: string[] | null;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ type: 'varchar' })
  usage!: string;

  /** Bot yanıt şablonu: {user} {args} {command} — boşsa varsayılan özet */
  @Column({ type: 'varchar', nullable: true })
  responseTemplate!: string | null;

  @Column({ type: 'varchar', nullable: true })
  botUserId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  botName!: string | null;

  @Column({ type: 'varchar' })
  createdById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('Guild', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'guildId' })
  guild!: Guild | null;

  @ManyToOne('User', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'botUserId' })
  botUser!: User | null;
}
