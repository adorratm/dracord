import type { MigrationInterface, QueryRunner } from 'typeorm';

/** B7 — çekiliş + doğum günü. Idempotent; schema-sync de oluşturur. */
export class GiveawaysBirthdays1762900000000 implements MigrationInterface {
  name = 'GiveawaysBirthdays1762900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS giveaways (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "channelId" varchar NOT NULL,
        "hostId" varchar NOT NULL,
        prize varchar NOT NULL,
        description varchar NULL,
        "winnersCount" int NOT NULL DEFAULT 1,
        "requiredRoleId" varchar NULL,
        "entrantIds" jsonb NOT NULL DEFAULT '[]',
        "winnerIds" jsonb NOT NULL DEFAULT '[]',
        "endsAt" timestamptz NOT NULL,
        "endedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_giveaways_guild_ends" ON giveaways ("guildId", "endsAt")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_birthday_settings (
        "guildId" varchar PRIMARY KEY,
        enabled boolean NOT NULL DEFAULT false,
        "channelId" varchar NULL,
        "roleId" varchar NULL,
        "lastRunDay" varchar NULL,
        "roleHolderIds" jsonb NOT NULL DEFAULT '[]'
      )
    `);
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday varchar(5) NULL`);
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "shareBirthday" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS "shareBirthday"`);
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS birthday`);
    await q.query(`DROP TABLE IF EXISTS guild_birthday_settings`);
    await q.query(`DROP TABLE IF EXISTS giveaways`);
  }
}
