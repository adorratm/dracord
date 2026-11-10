import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Draco SSS (D4). Idempotent; schema-sync de oluşturur. */
export class GuildFaq1762800000000 implements MigrationInterface {
  name = 'GuildFaq1762800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_faqs (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        entries jsonb NOT NULL DEFAULT '[]',
        "autoAnswer" boolean NOT NULL DEFAULT false,
        "autoChannelIds" jsonb NOT NULL DEFAULT '[]',
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_guild_faqs_guild" ON guild_faqs ("guildId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS guild_faqs`);
  }
}
