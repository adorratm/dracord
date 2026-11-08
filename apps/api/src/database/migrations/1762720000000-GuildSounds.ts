import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Soundboard (A2). Idempotent; schema-sync de oluşturur. */
export class GuildSounds1762720000000 implements MigrationInterface {
  name = 'GuildSounds1762720000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_sounds (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        name varchar(32) NOT NULL,
        emoji varchar NULL,
        url varchar NOT NULL,
        "contentType" varchar NOT NULL DEFAULT 'audio/mpeg',
        "durationSec" double precision NOT NULL DEFAULT 0,
        volume double precision NOT NULL DEFAULT 1,
        "createdById" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_guild_sounds_guild" ON guild_sounds ("guildId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS guild_sounds`);
  }
}
