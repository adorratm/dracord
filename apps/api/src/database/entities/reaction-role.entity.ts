import { Column, CreateDateColumn, Entity, Index, Unique } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** B5 — bir mesaja bu emojiyle tepki veren bu rolü alır (tepkiyi kaldırınca rol de gider) */
@Entity('reaction_roles')
@Unique(['messageId', 'emoji'])
@Index(['guildId'])
export class ReactionRole extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  channelId!: string;

  @Column({ type: 'varchar' })
  messageId!: string;

  @Column({ type: 'varchar' })
  emoji!: string;

  @Column({ type: 'varchar' })
  roleId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
