import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Sunucu istatistik sayaçları (B2). Idempotent; schema-sync de oluşturur. */
export class GuildStats1762740000000 implements MigrationInterface {
  name = 'GuildStats1762740000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_stats_daily (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        day date NOT NULL,
        joins int NOT NULL DEFAULT 0,
        leaves int NOT NULL DEFAULT 0,
        "voiceMinutes" int NOT NULL DEFAULT 0
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_guild_stats_daily_guild_day" ON guild_stats_daily ("guildId", day)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS guild_stats_daily`);
  }
}
