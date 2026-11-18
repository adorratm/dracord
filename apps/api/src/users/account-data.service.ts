import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { EntityManager, In, IsNull, LessThanOrEqual, Not } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Account } from '@/database/entities/account.entity';
import { Channel } from '@/database/entities/channel.entity';
import { Friendship } from '@/database/entities/friendship.entity';
import { Guild } from '@/database/entities/guild.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { Message } from '@/database/entities/message.entity';
import { Reaction } from '@/database/entities/reaction.entity';
import { Session } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { SearchIndexerService } from '@/search/search-indexer.service';
import { VoicePresenceService } from '@/voice/voice-presence.service';

/** KVKK m.7 / GDPR m.17: talepten sonra silmeden önce geri dönme süresi */
export const ACCOUNT_DELETION_GRACE_DAYS = 14;
const DAY_MS = 86_400_000;
const PURGE_EVERY_MS = 30 * 60_000;
const EXPORT_COOLDOWN_MS = 10 * 60_000;
const EXPORT_PAGE = 1000;

/** Writes a chunk and waits when the client reads slowly (no unbounded buffering). */
export interface ExportSink {
  write(chunk: string): boolean;
  once(event: 'drain', cb: () => void): unknown;
}

/**
 * E5 — personal data export (KVKK m.11 / GDPR m.15, m.20) and account deletion with a
 * 14-day grace period. Logging in during the grace period lets the user cancel it.
 */
@Injectable()
export class AccountDataService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AccountDataService.name);
  private readonly lastExport = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private purging = false;

  constructor(
    private readonly em: EntityManager,
    private readonly indexer: SearchIndexerService,
    private readonly voicePresence: VoicePresenceService,
  ) {}

  onModuleInit(): void {
    if (process.env.ACCOUNT_PURGE_DISABLED === '1') return;
    this.timer = setInterval(() => void this.purgeDue(), PURGE_EVERY_MS);
    this.timer.unref?.();
    setTimeout(() => void this.purgeDue(), 60_000).unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async verify(userId: string, password?: string, confirm?: string): Promise<User> {
    const c = (confirm ?? '').trim().toUpperCase();
    if (c !== 'SİL' && c !== 'SIL' && c !== 'DELETE') {
      throw new BadRequestException('Onay için SİL yazmalısın');
    }
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.passwordHash) {
      if (!password) throw new BadRequestException('Şifre gerekli');
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthorizedException('Şifre yanlış');
      }
    }
    return user;
  }

  private async assertNoOwnedGuilds(userId: string): Promise<void> {
    const owned = await this.em.count(Guild, { where: { ownerId: userId } });
    if (owned > 0) {
      throw new BadRequestException(
        `Hesabında ${owned} sunucunun sahipliği var — önce sahipliği devret veya sunucuları sil`,
      );
    }
  }

  /** Schedules deletion in 14 days and signs out every device. */
  async requestDeletion(
    userId: string,
    opts: { password?: string; confirm?: string },
  ): Promise<{ ok: true; deletionScheduledAt: string }> {
    const user = await this.verify(userId, opts.password, opts.confirm);
    await this.assertNoOwnedGuilds(userId);
    const at = user.deletionScheduledAt ?? new Date(Date.now() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);
    await this.em.update(User, { id: userId }, { deletionScheduledAt: at });
    await this.voicePresence.leaveEverywhere(userId).catch(() => undefined);
    await this.em.delete(Session, { userId });
    return { ok: true, deletionScheduledAt: at.toISOString() };
  }

  async cancelDeletion(userId: string): Promise<{ ok: true }> {
    await this.em.update(User, { id: userId }, { deletionScheduledAt: null });
    return { ok: true };
  }

  /** Permanently deletes accounts whose grace period is over (owners are kept until they hand over). */
  async purgeDue(now = new Date()): Promise<number> {
    if (this.purging) return 0;
    this.purging = true;
    let n = 0;
    try {
      const due = await this.em.find(User, {
        where: { deletionScheduledAt: LessThanOrEqual(now) },
        select: { id: true },
        take: 50,
      });
      for (const { id } of due) {
        const owned = await this.em.count(Guild, { where: { ownerId: id } });
        if (owned > 0) {
          this.log.warn(`hesap silme ertelendi (sunucu sahibi): ${id}`);
          continue;
        }
        try {
          await this.voicePresence.leaveEverywhere(id).catch(() => undefined);
          await this.em.delete(Session, { userId: id });
          await this.em.delete(User, { id, deletionScheduledAt: Not(IsNull()) });
          void this.indexer.deleteUser(id).catch(() => undefined);
          n++;
        } catch (err) {
          this.log.error(`hesap silinemedi ${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (n) this.log.log(`${n} hesap kalıcı silindi (14 gün doldu)`);
    } catch (err) {
      this.log.error(`hesap silme taraması: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.purging = false;
    }
    return n;
  }

  /** null when allowed now, otherwise seconds until the next export */
  exportRetryAfter(userId: string): number | null {
    const last = this.lastExport.get(userId);
    if (last && Date.now() - last < EXPORT_COOLDOWN_MS) {
      return Math.ceil((EXPORT_COOLDOWN_MS - (Date.now() - last)) / 1000);
    }
    this.lastExport.set(userId, Date.now());
    if (this.lastExport.size > 20_000) this.lastExport.clear();
    return null;
  }

  /** Streams everything Dracord keeps about the user as one JSON document. */
  async streamExport(userId: string, out: ExportSink): Promise<void> {
    const write = async (s: string) => {
      if (!out.write(s)) await new Promise<void>((r) => out.once('drain', r));
    };
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const [accounts, sessions, friendships, memberships] = await Promise.all([
      this.em.find(Account, { where: { userId }, select: { provider: true, createdAt: true } }),
      this.em.find(Session, {
        where: { userId },
        select: { platform: true, userAgent: true, ip: true, createdAt: true, lastUsedAt: true },
      }),
      this.em.find(Friendship, { where: [{ userId }, { friendId: userId }] }),
      this.em.find(GuildMember, { where: { userId }, relations: { guild: true } }),
    ]);
    const profile = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bannerColor: user.bannerColor,
      accentColor: user.accentColor,
      bio: user.bio,
      socialLinks: user.socialLinks,
      customStatus: user.customStatus,
      twoFactorEnabled: user.totpEnabled,
      createdAt: user.createdAt,
      deletionScheduledAt: user.deletionScheduledAt,
      settings: user.clientSettings,
    };
    await write(
      `{"exportedAt":${JSON.stringify(new Date().toISOString())},` +
        `"about":${JSON.stringify('Dracord kişisel veri dökümü (KVKK m.11 / GDPR m.15). Mesaj içerikleri yalnız senin yazdıkların; uçtan uca şifreli DM içerikleri sunucuda okunamaz ve şifreli haliyle yer alır.')},` +
        `"profile":${JSON.stringify(profile)},` +
        `"loginMethods":${JSON.stringify(accounts.map((a) => ({ provider: a.provider, linkedAt: a.createdAt })))},` +
        `"sessions":${JSON.stringify(sessions)},` +
        `"friendships":${JSON.stringify(
          friendships.map((f) => ({
            otherUserId: f.userId === userId ? f.friendId : f.userId,
            direction: f.userId === userId ? 'sent' : 'received',
            status: f.status,
            createdAt: f.createdAt,
          })),
        )},` +
        `"servers":${JSON.stringify(
          memberships.map((m) => ({
            guildId: m.guildId,
            name: m.guild?.name ?? null,
            nickname: m.nickname,
            joinedAt: m.joinedAt,
          })),
        )},`,
    );
    // messages, oldest first, in pages (a big account must not be held in memory)
    await write('"messages":[');
    const channelNames = new Map<string, string | null>();
    // keyset on (createdAt, id) read back from the row itself: JS dates lose Postgres microseconds
    let cursor: string | null = null;
    let first = true;
    for (;;) {
      const qb = this.em
        .createQueryBuilder(Message, 'm')
        .where('m.authorId = :userId', { userId })
        .orderBy('m.createdAt', 'ASC')
        .addOrderBy('m.id', 'ASC')
        .take(EXPORT_PAGE);
      if (cursor) {
        qb.andWhere('(m.createdAt, m.id) > (SELECT c."createdAt", c.id FROM messages c WHERE c.id = :cid)', { cid: cursor });
      }
      const page = await qb.getMany();
      if (page.length === 0) break;
      const missing = [...new Set(page.map((m) => m.channelId))].filter((id) => !channelNames.has(id));
      if (missing.length) {
        const chans = await this.em.find(Channel, { where: { id: In(missing) }, select: { id: true, name: true } });
        for (const id of missing) channelNames.set(id, chans.find((c) => c.id === id)?.name ?? null);
      }
      let chunk = '';
      for (const m of page) {
        chunk += (first ? '' : ',') + JSON.stringify({
          id: m.id,
          channelId: m.channelId,
          channel: channelNames.get(m.channelId) ?? null,
          content: m.content,
          attachments: (m.attachments ?? []).map((a) => ({ name: a.filename, url: a.url })),
          replyToId: m.replyToId,
          createdAt: m.createdAt,
          editedAt: m.updatedAt,
          deletedAt: m.deletedAt,
        });
        first = false;
      }
      await write(chunk);
      const last = page[page.length - 1]!;
      cursor = last.id;
      if (page.length < EXPORT_PAGE) break;
    }
    await write('],"reactions":[');
    let rCursor: string | null = null;
    first = true;
    for (;;) {
      const qb = this.em
        .createQueryBuilder(Reaction, 'r')
        .where('r.userId = :userId', { userId })
        .orderBy('r.createdAt', 'ASC')
        .addOrderBy('r.id', 'ASC')
        .take(EXPORT_PAGE);
      if (rCursor) {
        qb.andWhere('(r.createdAt, r.id) > (SELECT c."createdAt", c.id FROM reactions c WHERE c.id = :rid)', { rid: rCursor });
      }
      const page = await qb.getMany();
      if (page.length === 0) break;
      await write(
        page.map((r, i) => (first && i === 0 ? '' : ',') + JSON.stringify({ messageId: r.messageId, emoji: r.emoji, createdAt: r.createdAt })).join(''),
      );
      first = false;
      rCursor = page[page.length - 1]!.id;
      if (page.length < EXPORT_PAGE) break;
    }
    await write(']}');
  }
}
