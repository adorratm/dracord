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

/** Discord ApplicationCommandOptionType uyumlu */
export type SlashOptionType =
  | 3 // STRING
  | 4 // INTEGER
  | 5 // BOOLEAN
  | 6 // USER
  | 7 // CHANNEL
  | 8 // ROLE
  | 9 // MENTIONABLE
  | 10 // NUMBER
  | 11; // ATTACHMENT

export type SlashCommandOption = {
  type: SlashOptionType;
  name: string;
  description: string;
  required?: boolean;
  choices?: Array<{ name: string; value: string | number }>;
};

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

  /** Discord-parity tipli argümanlar (jsonb) */
  @Column({ type: 'jsonb', nullable: true })
  options!: SlashCommandOption[] | null;

  /** Bot yanıt şablonu: {user} {args} {command} {opt.NAME} — boşsa varsayılan özet */
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
