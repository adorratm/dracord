import { Column, CreateDateColumn, Entity, OneToMany } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { DMChannelMember } from './dm-channel-member.entity';
import type { Channel } from './channel.entity';

@Entity('dm_channels')
export class DMChannel extends CuidEntity {
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  /** E3 — uçtan uca şifreleme açık */
  @Column({ type: 'boolean', default: false })
  e2eeEnabled!: boolean;

  @Column({ type: 'varchar', nullable: true })
  e2eeEnabledById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  e2eeEnabledAt!: Date | null;

  @OneToMany('DMChannelMember', 'dmChannel')
  members!: DMChannelMember[];

  @OneToMany('Channel', 'dmChannel')
  channels!: Channel[];
}
