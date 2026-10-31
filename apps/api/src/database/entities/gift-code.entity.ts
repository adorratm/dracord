import { Column, CreateDateColumn, Entity, Index } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

export type GiftKind = 'nitro' | 'boost';

/** Sunucu tarafı hediye kodu — kullanıcılar arası redeem */
@Entity('gift_codes')
export class GiftCode extends CuidEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Column({ type: 'varchar' })
  kind!: GiftKind;

  @Column({ type: 'varchar' })
  label!: string;

  @Index()
  @Column({ type: 'varchar' })
  createdByUserId!: string;

  @Column({ type: 'varchar', nullable: true })
  redeemedByUserId!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  redeemedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
