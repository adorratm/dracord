import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  type EntitySubscriberInterface,
  type InsertEvent,
  type RemoveEvent,
} from 'typeorm';
import {
  DRACORD_BOT_USER_ID,
  GUILD_STATS_RANGES,
  type GuildStatsDay,
  type GuildStatsDto,
  type GuildStatsRange,
} from '@dracord/types';
import { GuildPermissions } from '@/common/permissions';
import { GuildMember } from '@/database/entities/guild-member.entity';
import { GuildsService } from '@/guilds/guilds.service';

const TZ = 'Europe/Istanbul';
const CACHE_MS = 5 * 60_000;
const VOICE_MAX_MINUTES = 240;

/**
 * Sunucu istatistikleri (B2). Mesaj sayıları mevcut `messages` tablosundan (geçmiş dahil);
 * katılan/ayrılan ve ses dakikası `guild_stats_daily` sayaçlarından (bu sürümden itibaren).
 */
@Injectable()
export class GuildStatsService implements OnModuleInit, EntitySubscriberInterface<GuildMember> {
  private readonly log = new Logger(GuildStatsService.name);
  private readonly cache = new Map<string, { at: number; dto: GuildStatsDto }>();

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
  ) {}

  onModuleInit() {
    if (!this.ds.subscribers.includes(this)) this.ds.subscribers.push(this);
  }

  listenTo() {
    return GuildMember;
  }

  afterInsert(event: InsertEvent<GuildMember>) {
    const g = event.entity?.guildId;
    if (g && event.entity.userId !== DRACORD_BOT_USER_ID) void this.bump(g, 'joins', 1);
  }

  afterRemove(event: RemoveEvent<GuildMember>) {
    const g = event.entity?.guildId ?? event.databaseEntity?.guildId;
    const u = event.entity?.userId ?? event.databaseEntity?.userId;
    if (g && u !== DRACORD_BOT_USER_ID) void this.bump(g, 'leaves', 1);
  }

  /** Ses oturumu bitti (bot hariç) */
  async onVoiceSession(guildId: string, joinedAtIso: string | null | undefined) {
    if (!joinedAtIso) return;
    const minutes = Math.min(VOICE_MAX_MINUTES, Math.floor((Date.now() - new Date(joinedAtIso).getTime()) / 60_000));
    if (!Number.isFinite(minutes) || minutes < 1) return;
    await this.bump(guildId, 'voiceMinutes', minutes);
  }

  private async bump(guildId: string, col: 'joins' | 'leaves' | 'voiceMinutes', n: number) {
    try {
      await this.em.query(
        `INSERT INTO guild_stats_daily (id, "guildId", day, "${col}")
           VALUES (md5(random()::text || clock_timestamp()::text), $1, (now() AT TIME ZONE '${TZ}')::date, $2)
         ON CONFLICT ("guildId", day) DO UPDATE SET "${col}" = guild_stats_daily."${col}" + EXCLUDED."${col}"`,
        [guildId, n],
      );
    } catch (e) {
      this.log.debug(`stats bump failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async getStats(guildId: string, actorId: string, rawDays: number): Promise<GuildStatsDto> {
    await this.guilds.requirePermission(guildId, actorId, GuildPermissions.MANAGE_GUILD);
    const days = (GUILD_STATS_RANGES as readonly number[]).includes(rawDays) ? (rawDays as GuildStatsRange) : 30;
    const key = `${guildId}:${days}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.dto;

    // Dönem: bugün dahil son `days` gün (TZ takvimi)
    const since = `((now() AT TIME ZONE '${TZ}')::date - ${days - 1})`;
    const prevSince = `((now() AT TIME ZONE '${TZ}')::date - ${2 * days - 1})`;
    const localDay = `(m."createdAt" AT TIME ZONE '${TZ}')::date`;
    const base = `FROM messages m
        JOIN channels c ON c.id = m."channelId"
       WHERE c."guildId" = $1 AND m."deletedAt" IS NULL AND m."authorId" <> $2`;

    const [daily, prev, totalsActive, channels, members, hourly, counters, memberCount, since0] = await Promise.all([
      this.em.query(
        `SELECT to_char(${localDay}, 'YYYY-MM-DD') AS day, count(*)::int AS messages, count(DISTINCT m."authorId")::int AS active
           ${base} AND m."createdAt" >= (${since})::timestamp AT TIME ZONE '${TZ}'
          GROUP BY 1`,
        [guildId, DRACORD_BOT_USER_ID],
      ) as Promise<Array<{ day: string; messages: number; active: number }>>,
      this.em.query(
        `SELECT count(*)::int AS messages, count(DISTINCT m."authorId")::int AS active
           ${base} AND m."createdAt" >= (${prevSince})::timestamp AT TIME ZONE '${TZ}'
                   AND m."createdAt" < (${since})::timestamp AT TIME ZONE '${TZ}'`,
        [guildId, DRACORD_BOT_USER_ID],
      ) as Promise<Array<{ messages: number; active: number }>>,
      this.em.query(
        `SELECT count(DISTINCT m."authorId")::int AS active
           ${base} AND m."createdAt" >= (${since})::timestamp AT TIME ZONE '${TZ}'`,
        [guildId, DRACORD_BOT_USER_ID],
      ) as Promise<Array<{ active: number }>>,
      this.em.query(
        `SELECT c.id AS "channelId", c.name AS name, count(*)::int AS messages
           ${base} AND m."createdAt" >= (${since})::timestamp AT TIME ZONE '${TZ}'
          GROUP BY c.id, c.name ORDER BY messages DESC LIMIT 8`,
        [guildId, DRACORD_BOT_USER_ID],
      ) as Promise<Array<{ channelId: string; name: string; messages: number }>>,
      this.em.query(
        `SELECT u.id AS "userId", COALESCE(NULLIF(gm.nickname, ''), u."displayName", u.username) AS "displayName",
                u."avatarUrl" AS "avatarUrl", count(*)::int AS messages
           FROM messages m
           JOIN channels c ON c.id = m."channelId"
           JOIN users u ON u.id = m."authorId" AND u."isBot" = false
           LEFT JOIN guild_members gm ON gm."guildId" = c."guildId" AND gm."userId" = u.id
          WHERE c."guildId" = $1 AND m."deletedAt" IS NULL AND m."authorId" <> $2
            AND m."createdAt" >= (${since})::timestamp AT TIME ZONE '${TZ}'
          GROUP BY u.id, u."displayName", u.username, u."avatarUrl", gm.nickname
          ORDER BY messages DESC LIMIT 8`,
        [guildId, DRACORD_BOT_USER_ID],
      ) as Promise<Array<{ userId: string; displayName: string; avatarUrl: string | null; messages: number }>>,
      this.em.query(
        `SELECT extract(hour FROM m."createdAt" AT TIME ZONE '${TZ}')::int AS h, count(*)::int AS n
           ${base} AND m."createdAt" >= (${since})::timestamp AT TIME ZONE '${TZ}'
          GROUP BY 1`,
        [guildId, DRACORD_BOT_USER_ID],
      ) as Promise<Array<{ h: number; n: number }>>,
      this.em.query(
        `SELECT to_char(day, 'YYYY-MM-DD') AS day, joins, leaves, "voiceMinutes"
           FROM guild_stats_daily WHERE "guildId" = $1 AND day >= ${prevSince}`,
        [guildId],
      ) as Promise<Array<{ day: string; joins: number; leaves: number; voiceMinutes: number }>>,
      this.em.count(GuildMember, { where: { guildId } }),
      this.em.query(`SELECT to_char(min(day), 'YYYY-MM-DD') AS d FROM guild_stats_daily WHERE "guildId" = $1`, [
        guildId,
      ]) as Promise<Array<{ d: string | null }>>,
    ]);

    // Gün listesi (boş günler 0)
    const todayRows: Array<{ d: string }> = await this.em.query(
      `SELECT to_char(g::date, 'YYYY-MM-DD') AS d
         FROM generate_series(${since}, (now() AT TIME ZONE '${TZ}')::date, interval '1 day') g`,
    );
    const firstDay = todayRows[0]?.d ?? '';
    const msgBy = new Map(daily.map((r) => [r.day, r]));
    const ctrBy = new Map(counters.map((r) => [r.day, r]));
    const out: GuildStatsDay[] = todayRows.map(({ d }) => ({
      day: d,
      messages: msgBy.get(d)?.messages ?? 0,
      activeMembers: msgBy.get(d)?.active ?? 0,
      joins: ctrBy.get(d)?.joins ?? 0,
      leaves: ctrBy.get(d)?.leaves ?? 0,
      voiceMinutes: ctrBy.get(d)?.voiceMinutes ?? 0,
    }));
    const prevJoins = counters.filter((r) => r.day < firstDay).reduce((n, r) => n + r.joins, 0);
    const hours = new Array<number>(24).fill(0);
    for (const r of hourly) if (r.h >= 0 && r.h < 24) hours[r.h] = r.n;
    const sum = (k: keyof Omit<GuildStatsDay, 'day'>) => out.reduce((n, d) => n + d[k], 0);

    const dto: GuildStatsDto = {
      guildId,
      days,
      generatedAt: new Date().toISOString(),
      memberCount,
      totals: {
        messages: sum('messages'),
        activeMembers: totalsActive[0]?.active ?? 0,
        joins: sum('joins'),
        leaves: sum('leaves'),
        voiceMinutes: sum('voiceMinutes'),
      },
      previous: { messages: prev[0]?.messages ?? 0, activeMembers: prev[0]?.active ?? 0, joins: prevJoins },
      daily: out,
      topChannels: channels,
      topMembers: members,
      hourly: hours,
      trackingSince: since0[0]?.d ?? null,
    };
    this.cache.set(key, { at: Date.now(), dto });
    if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value!);
    return dto;
  }
}
