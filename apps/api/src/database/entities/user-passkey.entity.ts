import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/** E1 — kullanıcı passkey'i (WebAuthn kimlik bilgisi). id = credential ID (base64url) */
@Entity('user_passkeys')
@Index(['userId'])
export class UserPasskey {
  @PrimaryColumn('varchar', { length: 512 })
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  /** COSE açık anahtar (base64url) */
  @Column({ type: 'text' })
  publicKey!: string;

  @Column({ type: 'bigint', default: 0, transformer: { to: (v: number) => v, from: (v: string | number) => Number(v) } })
  counter!: number;

  @Column({ type: 'jsonb', nullable: true })
  transports!: string[] | null;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  /** singleDevice | multiDevice */
  @Column({ type: 'varchar', length: 16, nullable: true })
  deviceType!: string | null;

  @Column({ type: 'boolean', default: false })
  backedUp!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;
}
