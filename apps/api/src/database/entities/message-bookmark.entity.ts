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
import type { Message } from './message.entity';
import type { User } from './user.entity';

@Entity('message_bookmarks')
@Unique(['userId', 'messageId'])
@Index(['userId', 'createdAt'])
export class MessageBookmark extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  messageId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne('Message', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message!: Message;
}
