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

/** Harici OAuth (Spotify vb.) — token’lar sunucuda tutulur */
@Entity('oauth_connections')
@Unique(['userId', 'provider'])
@Index(['provider', 'userId'])
export class OauthConnection extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  provider!: string;

  @Column({ type: 'text' })
  accessToken!: string;

  @Column({ type: 'text', nullable: true })
  refreshToken!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  externalUserId!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  scopes!: string[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
