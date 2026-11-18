import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import type { Channel } from './channel.entity';
import { CuidEntity } from './cuid-base.entity';

/** B8 — duyuru takibi: kaynak duyuru kanalındaki yeni mesajlar hedef kanala da düşer */
@Entity('channel_follows')
@Unique(['sourceChannelId', 'targetChannelId'])
@Index(['targetGuildId'])
export class ChannelFollow extends CuidEntity {
  @Column({ type: 'varchar' })
  sourceChannelId!: string;

  @Column({ type: 'varchar' })
  targetChannelId!: string;

  @Column({ type: 'varchar' })
  targetGuildId!: string;

  @Column({ type: 'varchar' })
  createdById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne('Channel', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceChannelId' })
  source!: Channel;

  @ManyToOne('Channel', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'targetChannelId' })
  target!: Channel;
}
