import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Channel } from './channel.entity';
import type { User } from './user.entity';
import type { Reaction } from './reaction.entity';

@Entity('messages')
export class Message extends CuidEntity {
  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar' })
  authorId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments!: Array<{
    id: string;
    url: string;
    filename: string;
    contentType: string;
    size: number;
  }> | null;

  @Column({ type: 'jsonb', nullable: true })
  embeds!: Array<{
    url: string;
    title?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    siteName?: string | null;
  }> | null;

  /** Anket: soru, seçenekler ve oy veren kullanıcı id'leri */
  @Column({ type: 'jsonb', nullable: true })
  poll!: {
    question: string;
    options: Array<{ id: string; text: string }>;
    votes: Record<string, string[]>;
    multi: boolean;
    closed?: boolean;
  } | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  updatedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne('Channel', 'messages', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel!: Channel;

  @ManyToOne('User', 'messages', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @OneToMany('Reaction', 'message')
  reactions!: Reaction[];
}
