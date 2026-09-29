import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { DMChannel } from './dm-channel.entity';
import type { User } from './user.entity';

@Entity('dm_channel_members')
export class DMChannelMember {
  @PrimaryColumn({ type: 'varchar' })
  dmChannelId!: string;

  @PrimaryColumn({ type: 'varchar' })
  userId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt!: Date;

  @ManyToOne('DMChannel', 'members', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dmChannelId' })
  dmChannel!: DMChannel;

  @ManyToOne('User', 'dmMembers', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
