import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { FriendshipStatus } from '@/database/enums';
import { CuidEntity } from './cuid-base.entity';
import type { User } from './user.entity';

@Entity('friendships')
@Unique(['userId', 'friendId'])
export class Friendship extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  friendId!: string;

  @Column({
    type: 'enum',
    enum: FriendshipStatus,
    default: FriendshipStatus.PENDING,
  })
  status!: FriendshipStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('User', 'friendshipsSent', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne('User', 'friendshipsRecv', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'friendId' })
  friend!: User;
}
