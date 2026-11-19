import type { MigrationInterface, QueryRunner } from 'typeorm';

/** F2 — sunucu abonelikleri. Idempotent; schema-sync de oluşturur. */
export class GuildSubscriptions1762950000000 implements MigrationInterface {
  name = 'GuildSubscriptions1762950000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_subscription_tiers (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        name varchar NOT NULL,
        perks text NOT NULL DEFAULT '',
        "priceText" varchar NOT NULL DEFAULT '',
        "roleId" varchar NULL,
        "paymentUrl" varchar NULL,
        color varchar NULL,
        position int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_gst_guild" ON guild_subscription_tiers ("guildId")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_subscriptions (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "tierId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        source varchar NOT NULL DEFAULT 'manual',
        "grantedById" varchar NULL,
        "expiresAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_gs_member_tier" UNIQUE ("guildId", "userId", "tierId")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_gs_expires" ON guild_subscriptions ("expiresAt")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_subscription_codes (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "tierId" varchar NOT NULL,
        code varchar NOT NULL,
        days int NULL,
        "maxUses" int NOT NULL DEFAULT 1,
        uses int NOT NULL DEFAULT 0,
        "createdById" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_gsc_code" UNIQUE (code)
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_gsc_guild" ON guild_subscription_codes ("guildId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS guild_subscription_codes`);
    await q.query(`DROP TABLE IF EXISTS guild_subscriptions`);
    await q.query(`DROP TABLE IF EXISTS guild_subscription_tiers`);
  }
}
