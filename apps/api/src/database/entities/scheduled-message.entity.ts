import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import type { MessageAttachment, ScheduledMessageStatus } from '@dracord/types';
import { CuidEntity } from './cuid-base.entity';
import type { User } from './user.entity';

/** Zamanlanmış mesaj — REMINDERS_TICK (20 sn) içinde gönderilir */
@Entity('scheduled_messages')
@Index(['status', 'sendAt'])
@Index(['userId', 'status'])
@Index(['channelId', 'userId'])
export class ScheduledMessage extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar', nullable: true })
  guildId!: string | null;

  @Column({ type: 'text', default: '' })
  content!: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments!: MessageAttachment[] | null;

  @Column({ type: 'varchar', nullable: true })
  replyToId!: string | null;

  @Column({ type: 'timestamptz' })
  sendAt!: Date;

  @Column({ type: 'varchar', default: 'pending' })
  /** 'sending' yalnız sunucu içi (gönderim kilidi) */
  status!: ScheduledMessageStatus | 'sending';

  @Column({ type: 'varchar', nullable: true })
  sentMessageId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  error!: string | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
