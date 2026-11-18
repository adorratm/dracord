import type { MigrationInterface, QueryRunner } from 'typeorm';

/** C5 — takım arama ilanları. Idempotent; schema-sync de oluşturur. */
export class LfgListings1762870000000 implements MigrationInterface {
  name = 'LfgListings1762870000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS lfg_listings (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "authorId" varchar NOT NULL,
        game varchar NOT NULL,
        slots int NOT NULL,
        "memberIds" jsonb NOT NULL DEFAULT '[]',
        rank varchar NULL,
        note varchar NULL,
        voice boolean NOT NULL DEFAULT false,
        "voiceChannelId" varchar NULL,
        "expiresAt" timestamptz NOT NULL,
        "closedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_lfg_guild_expires" ON lfg_listings ("guildId", "expiresAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS lfg_listings`);
  }
}
