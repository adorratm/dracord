import { Column, CreateDateColumn, Entity, Index, Unique } from 'typeorm';
import { CuidEntity } from './cuid-base.entity';

/** F2 — sunucu abonelik kademesi (sahibin tanımladığı; ödeme Dracord dışında) */
@Entity('guild_subscription_tiers')
@Index(['guildId'])
export class GuildSubscriptionTier extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', default: '' })
  perks!: string;

  @Column({ type: 'varchar', default: '' })
  priceText!: string;

  @Column({ type: 'varchar', nullable: true })
  roleId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/** F2 — üyenin aboneliği (elle ya da kodla) */
@Entity('guild_subscriptions')
@Unique(['guildId', 'userId', 'tierId'])
@Index(['expiresAt'])
export class GuildSubscription extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  tierId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'varchar', default: 'manual' })
  source!: 'manual' | 'code';

  @Column({ type: 'varchar', nullable: true })
  grantedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/** F2 — kullanılabilir üyelik kodu */
@Entity('guild_subscription_codes')
@Unique(['code'])
@Index(['guildId'])
export class GuildSubscriptionCode extends CuidEntity {
  @Column({ type: 'varchar' })
  guildId!: string;

  @Column({ type: 'varchar' })
  tierId!: string;

  @Column({ type: 'varchar' })
  code!: string;

  /** null = süresiz */
  @Column({ type: 'int', nullable: true })
  days!: number | null;

  @Column({ type: 'int', default: 1 })
  maxUses!: number;

  @Column({ type: 'int', default: 0 })
  uses!: number;

  @Column({ type: 'varchar' })
  createdById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
