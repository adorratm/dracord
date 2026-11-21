import { Column, CreateDateColumn, Entity, Index, UpdateDateColumn } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** İstemci hataları (web/desktop/mobil) — parmak izine göre gruplanır; kişisel veri tutulmaz */
@Entity('client_errors')
@Index(['fingerprint'], { unique: true })
@Index(['lastSeen'])
export class ClientError extends CuidEntity {
  @Column({ type: 'varchar' })
  fingerprint!: string;

  @Column({ type: 'varchar' })
  platform!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'text', default: '' })
  stack!: string;

  @Column({ type: 'int', default: 1 })
  count!: number;

  @Column({ type: 'varchar', nullable: true })
  lastVersion!: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastPath!: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastAgent!: string | null;

  @Column({ type: 'boolean', default: false })
  resolved!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  firstSeen!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  lastSeen!: Date;
}
