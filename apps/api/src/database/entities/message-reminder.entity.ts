import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Message } from './message.entity';
import type { User } from './user.entity';

export type MessageReminderStatus = 'pending' | 'fired' | 'cancelled' | 'snoozed';

@Entity('message_reminders')
@Index(['userId', 'remindAt'])
@Index(['status', 'remindAt'])
export class MessageReminder extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  messageId!: string;

  @Column({ type: 'varchar', nullable: true })
  channelId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  guildId!: string | null;

  @Column({ type: 'timestamptz' })
  remindAt!: Date;

  @Column({ type: 'varchar', default: 'pending' })
  status!: MessageReminderStatus;

  @Column({ type: 'timestamptz', nullable: true })
  snoozedUntil!: Date | null;

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
