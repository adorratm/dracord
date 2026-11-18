import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { EntityManager, In, IsNull, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import {
  SocketEvents,
  type CreateGiveawayInput,
  type GiveawayDto,
  type GuildBirthdayConfig,
  type MyBirthdayDto,
} from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@/bot/bot.constants';
import { BotService } from '@/bot/bot.service';
import { GuildPermissions } from '@/common/permissions';
import { Channel } from '@/database/entities/channel.entity';
import { Giveaway, GuildBirthdaySettings } from '@/database/entities/giveaway.entity';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildMemberRole } from '@/database/entities/guild-member-role.entity';
import { User } from '@/database/entities/user.entity';
import { ChannelType } from '@/database/enums';
import { SocketBroadcastService } from '@/gateway/socket-broadcast.service';
import { GuildsService } from '@/guilds/guilds.service';
import { MessagesService } from '@/messages/messages.service';
import { OnboardingService } from '@/onboarding/onboarding.service';

const TICK_MS = 30_000;
const MAX_WINNERS = 20;
const MAX_OPEN_PER_GUILD = 25;
const TZ = 'Europe/Istanbul';
/** greetings go out after this hour (Istanbul); BIRTHDAY_HOUR overrides */
const BIRTHDAY_HOUR = ((h) => (Number.isFinite(h) ? Math.min(23, Math.max(0, Math.round(h))) : 9))(Number(process.env.BIRTHDAY_HOUR ?? 9));

/** fair draw of n distinct ids (crypto RNG, partial Fisher–Yates) */
export function drawWinners(pool: string[], n: number, rng: (max: number) => number = randomInt): string[] {
  const a = [...new Set(pool)];
  const k = Math.min(n, a.length);
  for (let i = 0; i < k; i++) {
    const j = i + rng(a.length - i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, k);
}

/** "MM-DD" or null; also checks the day exists (29 Feb allowed) */
export function normalizeBirthday(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mm < 1 || mm > 12 || dd < 1 || dd > days[mm - 1]!) return null;
  return `${m[1]}-${m[2]}`;
}

/** today in Istanbul → { day: 'YYYY-MM-DD', md: 'MM-DD', hour } */
export function istanbulNow(d = new Date()): { day: string; md: string; hour: number; leapless: boolean } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const y = Number(get('year'));
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return { day: `${get('year')}-${get('month')}-${get('day')}`, md: `${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24, leapless: !leap };
}

/**
 * B7 — giveaways (enter, draw with a fair RNG when time is up, reroll) and birthday
 * greetings (members who share their birthday get a post and an optional role for the day).
 */
@Injectable()
export class CommunityService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(CommunityService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly broadcast: SocketBroadcastService,
    private readonly messages: MessagesService,
    private readonly bot: BotService,
    private readonly onboarding: OnboardingService,
  ) {}

  onModuleInit(): void {
    if (process.env.COMMUNITY_JOBS_DISABLED === '1') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.endDueGiveaways(now);
      await this.runBirthdays(now);
    } catch (err) {
      this.log.warn(`topluluk işleri: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.ticking = false;
    }
  }

  private async postAsBot(guildId: string, channelId: string, content: string): Promise<void> {
    try {
      await this.bot.ensureBotInGuild(guildId);
      await this.messages.createMessage(channelId, DRACORD_BOT_USER_ID, content);
    } catch (err) {
      this.log.warn(`bot mesajı gönderilemedi (${channelId}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** owner, admins and members with Manage Messages may run giveaways */
  private canHost(guildId: string, userId: string): Promise<boolean> {
    return this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_MESSAGES).then(
      () => true,
      () => false,
    );
  }

  // ── giveaways ──

  private toDto(g: Giveaway, viewerId: string): GiveawayDto {
    return {
      id: g.id,
      guildId: g.guildId,
      channelId: g.channelId,
      hostId: g.hostId,
      prize: g.prize,
      description: g.description,
      winnersCount: g.winnersCount,
      endsAt: g.endsAt.toISOString(),
      endedAt: g.endedAt ? g.endedAt.toISOString() : null,
      entrantCount: g.entrantIds.length,
      entered: g.entrantIds.includes(viewerId),
      winnerIds: g.winnerIds,
      requiredRoleId: g.requiredRoleId,
    };
  }

  /** the room gets a viewer-neutral copy; each client re-reads `entered` from its own calls */
  private emit(g: Giveaway): void {
    this.broadcast.emitToGuild(g.guildId, SocketEvents.GIVEAWAY_UPDATE, this.toDto(g, ''));
  }

  async listGiveaways(guildId: string, userId: string): Promise<GiveawayDto[]> {
    await this.guilds.ensureMember(guildId, userId);
    const since = new Date(Date.now() - 7 * 86_400_000);
    const rows = await this.em.find(Giveaway, {
      where: [
        { guildId, endedAt: IsNull() },
        { guildId, endedAt: MoreThan(since) },
      ],
      order: { endsAt: 'ASC' },
      take: 50,
    });
    return rows.map((g) => this.toDto(g, userId));
  }

  async createGiveaway(guildId: string, userId: string, raw: unknown): Promise<GiveawayDto> {
    if (!(await this.canHost(guildId, userId))) throw new ForbiddenException('Çekiliş için “Mesajları yönet” izni gerekir');
    const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<CreateGiveawayInput>;
    const prize = typeof b.prize === 'string' ? b.prize.trim().slice(0, 120) : '';
    if (!prize) throw new BadRequestException('Ödül gerekli');
    const winners = Math.round(Number(b.winnersCount ?? 1));
    if (!Number.isFinite(winners) || winners < 1 || winners > MAX_WINNERS) throw new BadRequestException(`Kazanan sayısı 1–${MAX_WINNERS}`);
    const dur = Math.round(Number(b.durationMin));
    if (!Number.isFinite(dur) || dur < 1 || dur > 30 * 24 * 60) throw new BadRequestException('Süre 1 dakika ile 30 gün arası olmalı');
    const ch = await this.em.findOne(Channel, { where: { id: String(b.channelId ?? ''), guildId }, select: { id: true, type: true, name: true } });
    if (!ch || ch.type !== ChannelType.TEXT) throw new BadRequestException('Bir metin kanalı seç');
    let requiredRoleId: string | null = null;
    if (b.requiredRoleId) {
      const ok = await this.em.query(`SELECT 1 FROM roles WHERE id = $1 AND "guildId" = $2`, [String(b.requiredRoleId), guildId]);
      if (!ok.length) throw new BadRequestException('Rol bu sunucuda yok');
      requiredRoleId = String(b.requiredRoleId);
    }
    if ((await this.em.count(Giveaway, { where: { guildId, endedAt: IsNull() } })) >= MAX_OPEN_PER_GUILD) {
      throw new BadRequestException('Bu sunucuda çok fazla açık çekiliş var');
    }
    const description = typeof b.description === 'string' ? b.description.trim().slice(0, 300) || null : null;
    const g = await this.em.save(
      Giveaway,
      this.em.create(Giveaway, {
        guildId,
        channelId: ch.id,
        hostId: userId,
        prize,
        description,
        winnersCount: winners,
        requiredRoleId,
        entrantIds: [],
        winnerIds: [],
        endsAt: new Date(Date.now() + dur * 60_000),
        endedAt: null,
      }),
    );
    const ends = g.endsAt.toLocaleString('tr-TR', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
    await this.postAsBot(
      guildId,
      ch.id,
      `🎉 **ÇEKİLİŞ: ${prize}**\n${description ? `${description}\n` : ''}${winners} kazanan · bitiş: ${ends}\nKatılmak için sunucu menüsünden **Çekilişler**'i aç.`,
    );
    this.emit(g);
    return this.toDto(g, userId);
  }

  async toggleEntry(id: string, userId: string): Promise<GiveawayDto> {
    const saved = await this.em.transaction(async (tx) => {
      const g = await tx.findOne(Giveaway, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!g) throw new NotFoundException('Çekiliş bulunamadı');
      await this.guilds.ensureMember(g.guildId, userId);
      if (g.endedAt || g.endsAt.getTime() <= Date.now()) throw new BadRequestException('Çekiliş bitti');
      if (g.entrantIds.includes(userId)) {
        g.entrantIds = g.entrantIds.filter((x) => x !== userId);
      } else {
        if (g.requiredRoleId) {
          const m = await tx.findOne(GuildMember, { where: { guildId: g.guildId, userId }, select: { id: true } });
          const has = m ? await tx.count(GuildMemberRole, { where: { guildMemberId: m.id, roleId: g.requiredRoleId } }) : 0;
          if (!has) throw new ForbiddenException('Bu çekilişe katılmak için gereken role sahip değilsin');
        }
        g.entrantIds = [...g.entrantIds, userId];
      }
      return tx.save(Giveaway, g);
    });
    this.emit(saved);
    return this.toDto(saved, userId);
  }

  private async announce(g: Giveaway, rerolled = false): Promise<void> {
    if (g.winnerIds.length === 0) {
      await this.postAsBot(g.guildId, g.channelId, `🎉 **${g.prize}** çekilişi bitti — katılan olmadı.`);
      return;
    }
    const users = await this.em.find(User, { where: { id: In(g.winnerIds) }, select: { id: true, username: true } });
    const names = g.winnerIds.map((id) => `@${users.find((u) => u.id === id)?.username ?? 'üye'}`).join(', ');
    await this.postAsBot(g.guildId, g.channelId, `🎉 **${g.prize}** ${rerolled ? 'yeniden çekildi' : 'çekilişi bitti'}! Kazanan: ${names} — tebrikler!`);
  }

  /** claim with a conditional update so two API instances never draw the same giveaway */
  private async finish(g: Giveaway): Promise<Giveaway | null> {
    const winners = drawWinners(g.entrantIds, g.winnersCount);
    const res = await this.em
      .createQueryBuilder()
      .update(Giveaway)
      .set({ endedAt: new Date(), winnerIds: winners })
      .where('id = :id AND "endedAt" IS NULL', { id: g.id })
      .execute();
    if (!res.affected) return null;
    const done = await this.em.findOneOrFail(Giveaway, { where: { id: g.id } });
    await this.announce(done);
    this.emit(done);
    return done;
  }

  private async endDueGiveaways(now: Date): Promise<void> {
    const due = await this.em.find(Giveaway, { where: { endedAt: IsNull(), endsAt: LessThanOrEqual(now) }, take: 20 });
    for (const g of due) await this.finish(g);
  }

  async endNow(id: string, userId: string): Promise<GiveawayDto> {
    const g = await this.em.findOne(Giveaway, { where: { id } });
    if (!g) throw new NotFoundException('Çekiliş bulunamadı');
    if (g.hostId !== userId && !(await this.canHost(g.guildId, userId))) throw new ForbiddenException('Yalnız düzenleyen bitirebilir');
    if (g.endedAt) throw new BadRequestException('Çekiliş zaten bitti');
    const done = (await this.finish(g)) ?? (await this.em.findOneOrFail(Giveaway, { where: { id } }));
    return this.toDto(done, userId);
  }

  /** draw again among entrants who have not won yet */
  async reroll(id: string, userId: string): Promise<GiveawayDto> {
    const g = await this.em.findOne(Giveaway, { where: { id } });
    if (!g) throw new NotFoundException('Çekiliş bulunamadı');
    if (g.hostId !== userId && !(await this.canHost(g.guildId, userId))) throw new ForbiddenException('Yalnız düzenleyen yeniden çekebilir');
    if (!g.endedAt) throw new BadRequestException('Önce çekiliş bitmeli');
    const pool = g.entrantIds.filter((x) => !g.winnerIds.includes(x));
    if (pool.length === 0) throw new BadRequestException('Yeniden çekmek için kazanmamış katılımcı yok');
    g.winnerIds = drawWinners(pool, g.winnersCount);
    await this.em.save(Giveaway, g);
    await this.announce(g, true);
    this.emit(g);
    return this.toDto(g, userId);
  }

  // ── birthdays ──

  async getMyBirthday(userId: string): Promise<MyBirthdayDto> {
    const u = await this.em.findOne(User, { where: { id: userId }, select: { id: true, birthday: true, shareBirthday: true } });
    return { birthday: u?.birthday ?? null, share: !!u?.shareBirthday };
  }

  async setMyBirthday(userId: string, raw: unknown): Promise<MyBirthdayDto> {
    const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<MyBirthdayDto>;
    const birthday = b.birthday === null || b.birthday === '' ? null : normalizeBirthday(b.birthday);
    if (b.birthday && !birthday) throw new BadRequestException('Doğum günü AA-GG biçiminde olmalı (ör. 04-23)');
    await this.em.update(User, { id: userId }, { birthday, shareBirthday: !!b.share && !!birthday });
    return { birthday, share: !!b.share && !!birthday };
  }

  async getBirthdayConfig(guildId: string, userId: string): Promise<GuildBirthdayConfig> {
    await this.guilds.ensureMember(guildId, userId);
    const r = await this.em.findOne(GuildBirthdaySettings, { where: { guildId } });
    return { enabled: !!r?.enabled, channelId: r?.channelId ?? null, roleId: r?.roleId ?? null };
  }

  async setBirthdayConfig(guildId: string, userId: string, raw: unknown): Promise<GuildBirthdayConfig> {
    await this.guilds.requirePermission(guildId, userId, GuildPermissions.MANAGE_GUILD);
    const b = (raw && typeof raw === 'object' ? raw : {}) as Partial<GuildBirthdayConfig>;
    const channelId = typeof b.channelId === 'string' && b.channelId ? b.channelId : null;
    const roleId = typeof b.roleId === 'string' && b.roleId ? b.roleId : null;
    if (channelId) {
      const ch = await this.em.findOne(Channel, { where: { id: channelId, guildId }, select: { id: true, type: true } });
      if (!ch || ch.type !== ChannelType.TEXT) throw new BadRequestException('Bir metin kanalı seç');
    }
    if (roleId) await this.onboarding.assertSelfAssignable(guildId, [roleId]);
    if (b.enabled && !channelId) throw new BadRequestException('Açmak için bir kanal seç');
    const cur = await this.em.findOne(GuildBirthdaySettings, { where: { guildId } });
    await this.em.save(
      GuildBirthdaySettings,
      this.em.create(GuildBirthdaySettings, { ...(cur ?? { lastRunDay: null, roleHolderIds: [] }), guildId, enabled: !!b.enabled, channelId, roleId }),
    );
    return { enabled: !!b.enabled, channelId, roleId };
  }

  /** once a day after 09:00 Istanbul time, per server */
  private async runBirthdays(now: Date): Promise<void> {
    const t = istanbulNow(now);
    if (t.hour < BIRTHDAY_HOUR) return;
    const due = await this.em.find(GuildBirthdaySettings, {
      where: [
        { enabled: true, lastRunDay: IsNull() },
        { enabled: true, lastRunDay: Not(t.day) },
      ],
      take: 50,
    });
    // 29 Feb birthdays are celebrated on 28 Feb in common years
    const mds = t.md === '02-28' && t.leapless ? ['02-28', '02-29'] : [t.md];
    for (const s of due) {
      const claimed = await this.em
        .createQueryBuilder()
        .update(GuildBirthdaySettings)
        .set({ lastRunDay: t.day })
        .where('"guildId" = :g AND ("lastRunDay" IS NULL OR "lastRunDay" <> :d)', { g: s.guildId, d: t.day })
        .execute();
      if (!claimed.affected) continue;
      try {
        await this.celebrate(s, mds);
      } catch (err) {
        this.log.warn(`doğum günü (${s.guildId}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private async celebrate(s: GuildBirthdaySettings, mds: string[]): Promise<void> {
    const rows: Array<{ userId: string; memberId: string; username: string }> = await this.em.query(
      `SELECT gm."userId" AS "userId", gm.id AS "memberId", u.username
         FROM guild_members gm JOIN users u ON u.id = gm."userId"
        WHERE gm."guildId" = $1 AND u."shareBirthday" = true AND u.birthday = ANY($2) AND u."isBot" = false
        LIMIT 200`,
      [s.guildId, mds],
    );
    // yesterday's birthday role comes off
    if (s.roleId && s.roleHolderIds.length) {
      const keep = new Set(rows.map((r) => r.memberId));
      const drop = s.roleHolderIds.filter((m) => !keep.has(m));
      if (drop.length) await this.em.delete(GuildMemberRole, { roleId: s.roleId, guildMemberId: In(drop) });
    }
    let holders: string[] = [];
    if (s.roleId && rows.length) {
      try {
        await this.onboarding.assertSelfAssignable(s.guildId, [s.roleId]);
        await this.em
          .createQueryBuilder()
          .insert()
          .into(GuildMemberRole)
          .values(rows.map((r) => ({ guildMemberId: r.memberId, roleId: s.roleId! })))
          .orIgnore()
          .execute();
        holders = rows.map((r) => r.memberId);
      } catch {
        /* the role is no longer safe to hand out */
      }
    }
    await this.em.update(GuildBirthdaySettings, { guildId: s.guildId }, { roleHolderIds: holders });
    if (rows.length && s.channelId) {
      const names = rows.map((r) => `@${r.username}`).join(', ');
      await this.postAsBot(s.guildId, s.channelId, `🎂 Bugün ${names} doğum günü! İyi ki doğdun${rows.length > 1 ? 'uz' : ''} 🎉`);
    }
  }
}
