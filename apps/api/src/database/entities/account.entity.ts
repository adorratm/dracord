import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AuthProvider } from '../enums';
import { CuidEntity } from './cuid-base.entity';
import type { User } from './user.entity';

@Entity('accounts')
@Unique(['provider', 'providerAccountId'])
export class Account extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'enum', enum: AuthProvider })
  provider!: AuthProvider;

  @Column({ type: 'varchar' })
  providerAccountId!: string;

  @Column({ type: 'varchar', nullable: true })
  accessToken!: string | null;

  @Column({ type: 'varchar', nullable: true })
  refreshToken!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('User', 'accounts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
