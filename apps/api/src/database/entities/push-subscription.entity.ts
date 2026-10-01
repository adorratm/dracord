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
import type { User } from './user.entity';

@Entity('push_subscriptions')
@Unique(['endpoint'])
@Index(['userId'])
export class PushSubscription extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'text' })
  endpoint!: string;

  @Column({ type: 'varchar' })
  p256dh!: string;

  @Column({ type: 'varchar' })
  auth!: string;

  @Column({ type: 'varchar', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
