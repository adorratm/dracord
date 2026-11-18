import type { MigrationInterface, QueryRunner } from 'typeorm';

/** B9 — yıldız panosu. Idempotent; schema-sync de oluşturur. */
export class Starboard1762890000000 implements MigrationInterface {
  name = 'Starboard1762890000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_starboards (
        "guildId" varchar PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        "channelId" varchar NULL,
        emoji varchar NOT NULL DEFAULT '⭐',
        threshold int NOT NULL DEFAULT 3,
        "ignoredChannelIds" jsonb NOT NULL DEFAULT '[]',
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS starboard_entries (
        "messageId" varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "starChannelId" varchar NOT NULL,
        "starMessageId" varchar NOT NULL,
        count int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS starboard_entries`);
    await q.query(`DROP TABLE IF EXISTS guild_starboards`);
  }
}
