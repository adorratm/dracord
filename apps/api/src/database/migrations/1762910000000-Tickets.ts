import type { MigrationInterface, QueryRunner } from 'typeorm';

/** B6 — destek talepleri. Idempotent; schema-sync de oluşturur. */
export class Tickets1762910000000 implements MigrationInterface {
  name = 'Tickets1762910000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_ticket_settings (
        "guildId" varchar PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        "categoryId" varchar NULL,
        "staffRoleIds" jsonb NOT NULL DEFAULT '[]',
        "logChannelId" varchar NULL,
        greeting varchar NOT NULL DEFAULT '',
        counter int NOT NULL DEFAULT 0
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "channelId" varchar NOT NULL,
        number int NOT NULL,
        "openerId" varchar NOT NULL,
        subject varchar NOT NULL,
        status varchar NOT NULL DEFAULT 'open',
        "closedById" varchar NULL,
        "closedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_tickets_guild_number" UNIQUE ("guildId", number)
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_tickets_guild_opener" ON tickets ("guildId", "openerId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS tickets`);
    await q.query(`DROP TABLE IF EXISTS guild_ticket_settings`);
  }
}
