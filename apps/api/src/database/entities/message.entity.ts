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
