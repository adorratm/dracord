import { CreateDateColumn, Entity, OneToMany } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { DMChannelMember } from './dm-channel-member.entity';
import type { Channel } from './channel.entity';

@Entity('dm_channels')
export class DMChannel extends CuidEntity {
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany('DMChannelMember', 'dmChannel')
  members!: DMChannelMember[];

  @OneToMany('Channel', 'dmChannel')
  channels!: Channel[];
}
