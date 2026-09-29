import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { User } from './user.entity';

export type NotificationType =
  | 'MENTION'
  | 'ANNOUNCEMENT'
  | 'SYSTEM'
  | 'FRIEND';

@Entity('notifications')
export class Notification extends CuidEntity {
  @Index()
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  type!: NotificationType;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  /** Uygulama içi rota, örn. /channels/gid/cid?around=mid */
  @Column({ type: 'varchar', nullable: true })
  link!: string | null;

  @Column({ type: 'varchar', nullable: true })
  actorId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  guildId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  channelId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
