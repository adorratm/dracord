import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { CuidEntity } from './cuid-base.entity';
import type { User } from './user.entity';
import type { GuildMember } from './guild-member.entity';
import type { Category } from './category.entity';
import type { Channel } from './channel.entity';
import type { Role } from './role.entity';

@Entity('guilds')
export class Guild extends CuidEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  iconUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bannerUrl!: string | null;

  @Column({ type: 'boolean', default: false })
  discoverable!: boolean;

  /** Keşfet kategorisi: gaming | music | entertainment | tech | education */
  @Column({ type: 'varchar', default: 'gaming' })
  discoverCategory!: string;

  /** Keşfet’te öne çıkarma (platform admin); null = pin yok */
  @Column({ type: 'timestamptz', nullable: true })
  discoverPinnedAt!: Date | null;

  /** Pin’ler arası sıra (küçük = üstte) */
  @Column({ type: 'int', nullable: true })
  discoverPinOrder!: number | null;

  @Column({ type: 'varchar', nullable: true })
  afkChannelId!: string | null;

  /** 0 = AFK kapalı. Tipik: 5–60 dk */
  @Column({ type: 'int', default: 0 })
  afkTimeoutMinutes!: number;

  /** Özel davet / tanıtım adresi (B3); küçük harf, benzersiz */
  @Index('IDX_guilds_vanity_code', { unique: true, where: '"vanityCode" IS NOT NULL' })
  @Column({ type: 'varchar', length: 32, nullable: true })
  vanityCode!: string | null;

  /** Tanıtım sayfası herkese açık mı */
  @Column({ type: 'boolean', default: false })
  publicPage!: boolean;

  @Column({ type: 'text', nullable: true })
  publicDescription!: string | null;

  /** Sunucu rozeti (B4) */
  @Column({ type: 'varchar', length: 8, nullable: true })
  badgeTag!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  badgeEmoji!: string | null;

  /** Aktif sunucu takviyesi sayısı */
  @Column({ type: 'int', default: 0 })
  boostCount!: number;

  @Column({ type: 'varchar' })
  ownerId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne('User', 'ownedGuilds')
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @OneToMany('GuildMember', 'guild')
  members!: GuildMember[];

  @OneToMany('Category', 'guild')
  categories!: Category[];

  @OneToMany('Channel', 'guild')
  channels!: Channel[];

  @OneToMany('Role', 'guild')
  roles!: Role[];
}
