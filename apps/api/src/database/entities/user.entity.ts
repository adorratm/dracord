import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';
import { UserStatus } from '@/database/enums';
import { CuidEntity } from './cuid-base.entity';
import type { Account } from './account.entity';
import type { Session } from './session.entity';
import type { Guild } from './guild.entity';
import type { GuildMember } from './guild-member.entity';
import type { Message } from './message.entity';
import type { Reaction } from './reaction.entity';
import type { Friendship } from './friendship.entity';
import type { DMChannelMember } from './dm-channel-member.entity';

@Entity('users')
export class User extends CuidEntity {
  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ type: 'varchar' })
  displayName!: string;

  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bannerColor!: string | null;

  @Column({ type: 'varchar', nullable: true })
  bannerUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ type: 'varchar', nullable: true })
  accentColor!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  socialLinks!: Record<string, string> | null;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.OFFLINE })
  status!: UserStatus;

  /** Kullanıcının seçtiği durum (IDLE/DND); bağlantı kesilince OFFLINE görünür, reconnect'te geri yüklenir. */
  @Column({ type: 'varchar', nullable: true, default: null })
  preferredStatus!: UserStatus | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  customStatus!: string | null;

  /** OAuth sonrası kullanıcı adı onayı; false ise onboarding gerekir. */
  @Column({ type: 'boolean', default: true })
  usernameConfirmed!: boolean;

  /** Link/medya önizlemelerini sansürle (bulanık / tıklayınca aç). */
  @Column({ type: 'boolean', default: false })
  censorLinkPreviews!: boolean;

  /** Discord tarzı istemci tercihleri */
  @Column({ type: 'jsonb', nullable: true })
  clientSettings!: Record<string, unknown> | null;

  /** Hesap devre dışı (giriş engeli) */
  @Column({ type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;

  /** Sistem botu (Dracord-Bot vb.) */
  @Column({ type: 'boolean', default: false })
  isBot!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('Account', 'user')
  accounts!: Account[];

  @OneToMany('Session', 'user')
  sessions!: Session[];

  @OneToMany('Guild', 'owner')
  ownedGuilds!: Guild[];

  @OneToMany('GuildMember', 'user')
  guildMembers!: GuildMember[];

  @OneToMany('Message', 'author')
  messages!: Message[];

  @OneToMany('Reaction', 'user')
  reactions!: Reaction[];

  @OneToMany('Friendship', 'user')
  friendshipsSent!: Friendship[];

  @OneToMany('Friendship', 'friend')
  friendshipsRecv!: Friendship[];

  @OneToMany('DMChannelMember', 'user')
  dmMembers!: DMChannelMember[];
}
