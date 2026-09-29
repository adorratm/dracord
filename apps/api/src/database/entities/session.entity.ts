import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { User } from './user.entity';

@Entity('sessions')
export class Session extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  refreshTokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('User', 'sessions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
