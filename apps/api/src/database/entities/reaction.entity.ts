import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Message } from './message.entity';
import type { User } from './user.entity';

@Entity('reactions')
@Unique(['messageId', 'userId', 'emoji'])
export class Reaction extends CuidEntity {
  @Column({ type: 'varchar' })
  messageId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  emoji!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('Message', 'reactions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message!: Message;

  @ManyToOne('User', 'reactions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
