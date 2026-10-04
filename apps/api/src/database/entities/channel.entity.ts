import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { ChannelType } from '@/database/enums';
import { CuidEntity } from './cuid-base.entity';
import type { Guild } from './guild.entity';
import type { Category } from './category.entity';
import type { DMChannel } from './dm-channel.entity';
import type { Message } from './message.entity';

@Entity('channels')
@Index(['guildId'])
export class Channel extends CuidEntity {
  @Column({ type: 'varchar', nullable: true })
  guildId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  dmChannelId!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'enum', enum: ChannelType })
  type!: ChannelType;

  @Column({ type: 'varchar', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'varchar', nullable: true })
  topic!: string | null;

  /** Ses kanalı kilidi — şifre gerekir */
  @Column({ type: 'boolean', default: false })
  locked!: boolean;

  /** bcrypt hash; client’a asla gönderilmez */
  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  /** Bu odaya girmesi engellenen kullanıcı id’leri */
  @Column({ type: 'simple-json', nullable: true })
  deniedUserIds!: string[] | null;

  /** Kanal izin overwrite’ları (rol/üye) */
  @Column({ type: 'simple-json', nullable: true })
  permissionOverwrites!: Array<{
    id: string;
    type: 'role' | 'member';
    allow: string[];
    deny: string[];
  }> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('Guild', 'channels', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'guildId' })
  guild!: Guild | null;

  @ManyToOne('Category', 'channels', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category!: Category | null;

  @ManyToOne('DMChannel', 'channels', { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'dmChannelId' })
  dmChannel!: DMChannel | null;

  @OneToMany('Message', 'channel')
  messages!: Message[];
}
