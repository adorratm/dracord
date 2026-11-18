import type { MigrationInterface, QueryRunner } from 'typeorm';

/** B8 — yavaş mod + duyuru kanalı takibi. Idempotent; schema-sync de ekler. */
export class SlowModeAnnouncements1762880000000 implements MigrationInterface {
  name = 'SlowModeAnnouncements1762880000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS "slowModeSec" int NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS "isAnnouncement" boolean NOT NULL DEFAULT false`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS channel_follows (
        id varchar PRIMARY KEY,
        "sourceChannelId" varchar NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        "targetChannelId" varchar NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
        "targetGuildId" varchar NOT NULL,
        "createdById" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_channel_follows_pair" UNIQUE ("sourceChannelId", "targetChannelId")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_channel_follows_target_guild" ON channel_follows ("targetGuildId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS channel_follows`);
    await q.query(`ALTER TABLE channels DROP COLUMN IF EXISTS "isAnnouncement"`);
    await q.query(`ALTER TABLE channels DROP COLUMN IF EXISTS "slowModeSec"`);
  }
}
