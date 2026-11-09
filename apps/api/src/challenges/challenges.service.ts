import { BadRequestException, Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { EntityManager } from 'typeorm';
import {
  challengeLabel,
  weeklyChallenges,
  type ChallengesDto,
  type SeasonEntryDto,
} from '@dracord/types';
import { GuildsService } from '@/guilds/guilds.service';
import { LevelsService } from '@/levels/levels.service';

const TZ = 'Europe/Istanbul';
const TOP = 20;

type Clock = { week: string; weekEnd: string; season: string; seasonStart: string; seasonEnd: string; lastSeasonStart: string };

/**
 * Haftalık görevler + aylık sezon (C3). Skor = kazanılan XP + görev ödülleri.
 * Sezon tablosu, pazartesisi o aya düşen haftaların toplamıdır.
 */
@Injectable()
export class ChallengesService {
  constructor(
    private readonly em: EntityManager,
    private readonly guilds: GuildsService,
    private readonly levels: LevelsService,
  ) {}

  private async clock(): Promise<Clock> {
    const rows: Array<Record<keyof Clock, string>> = await this.em.query(`
      WITH n AS (SELECT (now() AT TIME ZONE '${TZ}') AS t)
      SELECT to_char(date_trunc('week', t)::date, 'YYYY-MM-DD') AS week,
             to_char(((date_trunc('week', t) + interval '7 days') AT TIME ZONE '${TZ}') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "weekEnd",
             to_char(t, 'YYYY-MM') AS season,
             to_char(date_trunc('month', t)::date, 'YYYY-MM-DD') AS "seasonStart",
             to_char(((date_trunc('month', t) + interval '1 month') AT TIME ZONE '${TZ}') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "seasonEnd",
             to_char((date_trunc('month', t) - interval '1 month')::date, 'YYYY-MM-DD') AS "lastSeasonStart"
        FROM n`);
    return rows[0]!;
  }

  private async board(guildId: string, where: string, params: unknown[]): Promise<SeasonEntryDto[]> {
    const rows: Array<{ userId: string; displayName: string; avatarUrl: string | null; score: number }> = await this.em.query(
      `SELECT s."userId" AS "userId",
              COALESCE(NULLIF(gm.nickname, ''), u."displayName", u.username) AS "displayName",
              u."avatarUrl" AS "avatarUrl",
              sum(s.xp + s."bonusXp")::int AS score
         FROM member_weekly_stats s
         JOIN guild_members gm ON gm."guildId" = s."guildId" AND gm."userId" = s."userId"
         JOIN users u ON u.id = s."userId" AND u."isBot" = false
        WHERE s."guildId" = $1 AND ${where}
        GROUP BY s."userId", gm.nickname, u."displayName", u.username, u."avatarUrl"
       HAVING sum(s.xp + s."bonusXp") > 0
        ORDER BY score DESC, s."userId"
        LIMIT ${TOP}`,
      [guildId, ...params],
    );
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  private async rankOf(guildId: string, userId: string, where: string, params: unknown[]) {
    const rows: Array<{ score: number; rank: number | null }> = await this.em.query(
      `WITH t AS (
         SELECT s."userId", sum(s.xp + s."bonusXp")::int AS score
           FROM member_weekly_stats s
           JOIN guild_members gm ON gm."guildId" = s."guildId" AND gm."userId" = s."userId"
          WHERE s."guildId" = $1 AND ${where}
          GROUP BY s."userId")
       SELECT COALESCE((SELECT score FROM t WHERE "userId" = $2), 0) AS score,
              (SELECT count(*)::int + 1 FROM t WHERE score > COALESCE((SELECT score FROM t WHERE "userId" = $2), 0)) AS rank`,
      [guildId, userId, ...params],
    );
    const r = rows[0] ?? { score: 0, rank: null };
    return { score: Number(r.score) || 0, rank: Number(r.score) > 0 ? Number(r.rank) : null };
  }

  async get(guildId: string, userId: string): Promise<ChallengesDto> {
    await this.guilds.ensureMember(guildId, userId);
    const c = await this.clock();
    const cfg = await this.levels.getConfig(guildId);
    const defs = weeklyChallenges(guildId, c.week);
    const [mineRows, claims, weekly, seasonBoard, lastSeasonTop, wr, sr] = await Promise.all([
      this.em.query(
        `SELECT xp, messages, "voiceMinutes" FROM member_weekly_stats WHERE "guildId" = $1 AND "userId" = $2 AND week = $3::date`,
        [guildId, userId, c.week],
      ) as Promise<Array<{ xp: number; messages: number; voiceMinutes: number }>>,
      this.em.query(`SELECT "challengeId" FROM challenge_claims WHERE "guildId" = $1 AND "userId" = $2 AND "challengeId" LIKE $3`, [
        guildId,
        userId,
        `${c.week}:%`,
      ]) as Promise<Array<{ challengeId: string }>>,
      this.board(guildId, `s.week = $2::date`, [c.week]),
      this.board(guildId, `s.week >= $2::date AND s.week < ($2::date + interval '1 month')`, [c.seasonStart]),
      this.board(guildId, `s.week >= $2::date AND s.week < $3::date`, [c.lastSeasonStart, c.seasonStart]).then((b) => b.slice(0, 3)),
      this.rankOf(guildId, userId, `s.week = $3::date`, [c.week]),
      this.rankOf(guildId, userId, `s.week >= $3::date AND s.week < ($3::date + interval '1 month')`, [c.seasonStart]),
    ]);
    const mine = mineRows[0] ?? { xp: 0, messages: 0, voiceMinutes: 0 };
    const claimed = new Set(claims.map((x) => x.challengeId));
    return {
      guildId,
      week: c.week,
      weekEndsAt: c.weekEnd,
      season: c.season,
      seasonEndsAt: c.seasonEnd,
      enabled: cfg.enabled,
      challenges: defs.map((d) => {
        const progress =
          d.kind === 'messages' ? Number(mine.messages) : d.kind === 'voice' ? Number(mine.voiceMinutes) : Number(mine.xp);
        return {
          ...d,
          label: challengeLabel(d),
          progress: Math.min(progress, d.target),
          done: progress >= d.target,
          claimed: claimed.has(d.id),
        };
      }),
      weekly,
      seasonBoard,
      me: { weekScore: wr.score, weekRank: wr.rank, seasonScore: sr.score, seasonRank: sr.rank },
      lastSeasonTop,
    };
  }

  async claim(guildId: string, userId: string, challengeId: string): Promise<ChallengesDto> {
    const dto = await this.get(guildId, userId);
    if (!dto.enabled) throw new BadRequestException('Bu sunucuda seviye sistemi kapalı');
    const ch = dto.challenges.find((x) => x.id === challengeId);
    if (!ch) throw new BadRequestException('Bu görev bu haftaya ait değil');
    if (!ch.done) throw new BadRequestException('Görev henüz tamamlanmadı');
    if (ch.claimed) return dto;
    const inserted: unknown = await this.em.query(
      `INSERT INTO challenge_claims (id, "guildId", "userId", "challengeId", "rewardXp", "createdAt")
         VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT ("guildId", "userId", "challengeId") DO NOTHING
       RETURNING id`,
      [createId(), guildId, userId, ch.id, ch.rewardXp],
    );
    const ok = Array.isArray(inserted) && (Array.isArray(inserted[0]) ? inserted[0].length : inserted.length) > 0;
    if (ok) await this.levels.addBonusXp(guildId, userId, ch.rewardXp);
    return this.get(guildId, userId);
  }
}
