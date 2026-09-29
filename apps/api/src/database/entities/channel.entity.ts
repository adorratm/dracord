import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { ChannelType } from '../enums';
import { CuidEntity } from './cuid-base.entity';
import type { Guild } from './guild.entity';
import type { Category } from './category.entity';
import type { DMChannel } from './dm-channel.entity';
import type { Message } from './message.entity';

@Entity('channels')
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
