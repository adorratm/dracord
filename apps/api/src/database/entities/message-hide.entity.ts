import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Message } from './message.entity';
import type { User } from './user.entity';

export type MessageHideMode = 'HIDDEN' | 'SUPPRESSED';

@Entity('message_hides')
@Unique(['userId', 'messageId'])
@Index(['userId', 'mode'])
export class MessageHide extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  messageId!: string;

  /** HIDDEN = gizle (geri açılabilir), SUPPRESSED = bir daha gösterme */
  @Column({ type: 'varchar', default: 'HIDDEN' })
  mode!: MessageHideMode;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne('Message', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message!: Message;
}
