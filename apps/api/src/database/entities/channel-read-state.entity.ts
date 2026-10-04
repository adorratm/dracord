import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { Channel } from './channel.entity';
import type { User } from './user.entity';

@Entity('channel_read_states')
@Unique(['userId', 'channelId'])
@Index(['userId', 'channelId'])
export class ChannelReadState extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar', nullable: true })
  lastReadMessageId!: string | null;

  /** lastReadMessageId'nin createdAt'i — unread sayımında messages self-join'i önler */
  @Column({ type: 'timestamptz', nullable: true })
  lastReadCreatedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt!: Date | null;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne('Channel', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channelId' })
  channel!: Channel;
}
