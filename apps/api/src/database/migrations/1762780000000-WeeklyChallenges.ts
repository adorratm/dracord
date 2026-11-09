import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Haftalık görevler + sezon (C3). Idempotent; schema-sync de oluşturur. */
export class WeeklyChallenges1762780000000 implements MigrationInterface {
  name = 'WeeklyChallenges1762780000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS member_weekly_stats (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        week date NOT NULL,
        xp int NOT NULL DEFAULT 0,
        "bonusXp" int NOT NULL DEFAULT 0,
        messages int NOT NULL DEFAULT 0,
        "voiceMinutes" int NOT NULL DEFAULT 0
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_member_weekly_stats_guild_user_week" ON member_weekly_stats ("guildId", "userId", week)`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_member_weekly_stats_guild_week" ON member_weekly_stats ("guildId", week)`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS challenge_claims (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        "challengeId" varchar NOT NULL,
        "rewardXp" int NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_challenge_claims_unique" ON challenge_claims ("guildId", "userId", "challengeId")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS challenge_claims`);
    await q.query(`DROP TABLE IF EXISTS member_weekly_stats`);
  }
}
