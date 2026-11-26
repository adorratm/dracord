import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { YearRecapDto, YearRecapPerson, YearRecapPlace } from '@dracord/types';

const TZ = 'Europe/Istanbul';
const CACHE_MS = 6 * 3_600_000;

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0) || 0;

/**
 * Yıl özeti (Dracord Wrapped): kullanıcının bir yıldaki mesajları, ses dakikası, en çok
 * yazıştığı arkadaşları, sunucuları, emojileri ve oyunları. Yalnız kendi verisi; sonuç
 * 6 saat bellekte tutulur (sorgular ağır).
 */
@Injectable()
export class RecapService {
  private readonly cache = new Map<string, { at: number; dto: YearRecapDto }>();

  constructor(private readonly em: EntityManager) {}

  async get(userId: string, year: number): Promise<YearRecapDto> {
    const now = new Date();
    const y = Number.isInteger(year) && year >= 2024 && year <= now.getFullYear() ? year : now.getFullYear();
    const key = `${userId}:${y}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.dto;
    const dto = await this.build(userId, y);
    if (this.cache.size > 2000) this.cache.clear();
    this.cache.set(key, { at: Date.now(), dto });
    return dto;
  }

  private async build(userId: string, year: number): Promise<YearRecapDto> {
    const from = `${year}-01-01`;
    const to = `${year + 1}-01-01`;
    const range = `m."createdAt" >= ($2::date AT TIME ZONE '${TZ}') AND m."createdAt" < ($3::date AT TIME ZONE '${TZ}')`;
    const args = [userId, from, to];
    const q = <T = Row>(sql: string, a: unknown[] = args) => this.em.query(sql, a) as Promise<T[]>;

    const [days, hours, guilds, channels, friends, emojis, voice, games, gameKinds, tourn] = await Promise.all([
      q(`SELECT to_char(m."createdAt" AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS d, count(*)::int AS c
           FROM messages m WHERE m."authorId" = $1 AND m."deletedAt" IS NULL AND ${range} GROUP BY 1 ORDER BY 1`),
      q(`SELECT extract(hour FROM m."createdAt" AT TIME ZONE '${TZ}')::int AS h, count(*)::int AS c
           FROM messages m WHERE m."authorId" = $1 AND m."deletedAt" IS NULL AND ${range} GROUP BY 1 ORDER BY 2 DESC LIMIT 1`),
      q(`SELECT g.id, g.name, g."iconUrl", count(*)::int AS c
           FROM messages m JOIN channels ch ON ch.id = m."channelId" JOIN guilds g ON g.id = ch."guildId"
          WHERE m."authorId" = $1 AND m."deletedAt" IS NULL AND ${range}
          GROUP BY g.id, g.name, g."iconUrl" ORDER BY c DESC LIMIT 3`),
      q(`SELECT ch.id, ch.name, g.name AS gname, count(*)::int AS c
           FROM messages m JOIN channels ch ON ch.id = m."channelId" JOIN guilds g ON g.id = ch."guildId"
          WHERE m."authorId" = $1 AND m."deletedAt" IS NULL AND ${range}
          GROUP BY ch.id, ch.name, g.name ORDER BY c DESC LIMIT 3`),
      q(`SELECT u.id, u.username, u."displayName", u."avatarUrl", count(*)::int AS c
           FROM messages m JOIN channels ch ON ch.id = m."channelId" AND ch."dmChannelId" IS NOT NULL
           JOIN dm_channel_members dm ON dm."dmChannelId" = ch."dmChannelId" AND dm."userId" <> $1
           JOIN users u ON u.id = dm."userId"
          WHERE m."authorId" = $1 AND m."deletedAt" IS NULL AND ${range}
          GROUP BY u.id, u.username, u."displayName", u."avatarUrl" ORDER BY c DESC LIMIT 3`),
      q(`SELECT r.emoji, count(*)::int AS c FROM reactions r
          WHERE r."userId" = $1 AND r."createdAt" >= ($2::date AT TIME ZONE '${TZ}') AND r."createdAt" < ($3::date AT TIME ZONE '${TZ}')
          GROUP BY r.emoji ORDER BY c DESC LIMIT 5`),
      q(`SELECT coalesce(sum("voiceMinutes"), 0)::int AS v FROM member_weekly_stats
          WHERE "userId" = $1 AND week >= $2::date AND week < $3::date`),
      q(`SELECT count(*)::int AS played, count(*) FILTER (WHERE won)::int AS won FROM game_results
          WHERE "userId" = $1 AND "createdAt" >= ($2::date AT TIME ZONE '${TZ}') AND "createdAt" < ($3::date AT TIME ZONE '${TZ}')`),
      q(`SELECT kind, count(*)::int AS c FROM game_results
          WHERE "userId" = $1 AND "createdAt" >= ($2::date AT TIME ZONE '${TZ}') AND "createdAt" < ($3::date AT TIME ZONE '${TZ}')
          GROUP BY kind ORDER BY c DESC LIMIT 1`),
      q(`SELECT count(*)::int AS c FROM tournaments
          WHERE "winnerId" = $1 AND "finishedAt" >= ($2::date AT TIME ZONE '${TZ}') AND "finishedAt" < ($3::date AT TIME ZONE '${TZ}')`).catch(
        () => [{ c: 0 }],
      ),
    ]);
    const reactTotal = await q(`SELECT count(*)::int AS c FROM reactions r
        WHERE r."userId" = $1 AND r."createdAt" >= ($2::date AT TIME ZONE '${TZ}') AND r."createdAt" < ($3::date AT TIME ZONE '${TZ}')`);

    const byMonth = new Array<number>(12).fill(0);
    let messages = 0;
    let busiest: { day: string; messages: number } | null = null;
    let longest = 0;
    let run = 0;
    let prev: number | null = null;
    for (const r of days) {
      const d = String(r.d);
      const c = n(r.c);
      messages += c;
      byMonth[Number(d.slice(5, 7)) - 1]! += c;
      if (!busiest || c > busiest.messages) busiest = { day: d, messages: c };
      const t = Date.parse(`${d}T00:00:00Z`) / 86_400_000;
      run = prev !== null && t - prev === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = t;
    }
    const voiceMinutes = n(voice[0]?.v);
    const busiestHour = hours[0] ? n(hours[0].h) : null;
    const g0 = games[0] ?? {};
    const dto: YearRecapDto = {
      year,
      generatedAt: new Date().toISOString(),
      messages,
      byMonth,
      activeDays: days.length,
      longestStreak: longest,
      voiceMinutes,
      reactionsGiven: n(reactTotal[0]?.c),
      firstMessageAt: days[0] ? String(days[0].d) : null,
      busiestDay: busiest,
      busiestHour,
      topGuilds: guilds.map((r): YearRecapPlace => ({ id: String(r.id), name: String(r.name), iconUrl: (r.iconUrl as string | null) ?? null, messages: n(r.c) })),
      topChannels: channels.map((r): YearRecapPlace => ({ id: String(r.id), name: String(r.name), guildName: String(r.gname), messages: n(r.c) })),
      topFriends: friends.map(
        (r): YearRecapPerson => ({
          id: String(r.id),
          username: String(r.username),
          displayName: String(r.displayName ?? r.username),
          avatarUrl: (r.avatarUrl as string | null) ?? null,
          messages: n(r.c),
        }),
      ),
      topEmojis: emojis.map((r) => ({ emoji: String(r.emoji), count: n(r.c) })),
      games: { played: n(g0.played), won: n(g0.won), topKind: gameKinds[0] ? String(gameKinds[0].kind) : null },
      tournamentsWon: n(tourn[0]?.c),
      persona: { id: '', title: '', desc: '', emoji: '' },
    };
    dto.persona = persona(dto);
    return dto;
  }
}

/** Yılın karakteri: verinin en belirgin yanından */
export function persona(r: Pick<YearRecapDto, 'messages' | 'voiceMinutes' | 'busiestHour' | 'games' | 'longestStreak' | 'topFriends' | 'reactionsGiven' | 'activeDays'>): YearRecapDto['persona'] {
  const night = r.busiestHour !== null && (r.busiestHour >= 23 || r.busiestHour < 5);
  if (r.games.played >= 30 && r.games.won / Math.max(1, r.games.played) >= 0.55)
    return { id: 'champion', emoji: '🏆', title: 'Masanın Ustası', desc: 'Oyun masasında yenilmesi en zor kişi sendin.' };
  if (r.voiceMinutes >= 3000 && r.voiceMinutes > r.messages)
    return { id: 'voice', emoji: '🎙️', title: 'Sesli Sohbetin Kalbi', desc: 'Yazmak yerine konuşmayı seçtin — kanallar seninle ısındı.' };
  if (night && r.messages >= 200) return { id: 'night', emoji: '🌙', title: 'Gece Kuşu', desc: 'Herkes uyurken sen sohbeti ayakta tuttun.' };
  if (r.longestStreak >= 30) return { id: 'streak', emoji: '🔥', title: 'Durdurulamaz', desc: 'Bir ay boyunca tek gün bile kaçırmadın.' };
  if (r.reactionsGiven >= 500 && r.reactionsGiven > r.messages)
    return { id: 'reactor', emoji: '💬', title: 'Tepki Makinesi', desc: 'Az yazdın ama hiçbir mesajı karşılıksız bırakmadın.' };
  if (r.topFriends.length >= 3 && r.topFriends[0]!.messages >= 500)
    return { id: 'friend', emoji: '🤝', title: 'Sadık Dost', desc: 'Birkaç kişiyle kurduğun bağ yılın en güzel hikâyesiydi.' };
  if (r.messages >= 2000) return { id: 'chatter', emoji: '⚡', title: 'Sohbet Motoru', desc: 'Sunucuların en hareketli parmakları seninkilerdi.' };
  if (r.activeDays <= 10) return { id: 'new', emoji: '🌱', title: 'Yeni Filiz', desc: 'Yolculuğun daha yeni başlıyor — gelecek yıl senin yılın.' };
  return { id: 'steady', emoji: '🧭', title: 'İstikrarlı Gezgin', desc: 'Her yerde biraz, her zaman oradaydın.' };
}
