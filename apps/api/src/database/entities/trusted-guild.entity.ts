import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** Platform admin’in T&S floor muafiyeti verdiği sunucular */
@Entity('trusted_guilds')
export class TrustedGuild extends CuidEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ type: 'varchar' })
  createdByUserId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
