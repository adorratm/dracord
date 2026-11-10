import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** E3 — kullanıcı cihazının uçtan uca şifreleme açık anahtarı (gizli anahtar cihazda kalır) */
@Entity('e2ee_devices')
@Index(['userId'])
export class E2eeDevice extends CuidEntity {
  @Column({ type: 'varchar' })
  userId!: string;

  /** X25519 açık anahtar (base64, 32 bayt) */
  @Column({ type: 'varchar', length: 64 })
  publicKey!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  platform!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;
}
