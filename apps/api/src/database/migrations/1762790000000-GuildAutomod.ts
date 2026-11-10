import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Sunucu otomatik moderasyon kuralları + günlük (D2). Idempotent; schema-sync de oluşturur. */
export class GuildAutomod1762790000000 implements MigrationInterface {
  name = 'GuildAutomod1762790000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_automod_configs (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        config jsonb NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_guild_automod_configs_guild" ON guild_automod_configs ("guildId")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_automod_events (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        "channelId" varchar NULL,
        reason varchar NOT NULL,
        detail varchar NULL,
        preview varchar(200) NOT NULL,
        action varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_guild_automod_events_guild_time" ON guild_automod_events ("guildId", "createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS guild_automod_events`);
    await q.query(`DROP TABLE IF EXISTS guild_automod_configs`);
  }
}
