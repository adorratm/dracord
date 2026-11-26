import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Canlı yayın bildirimleri (D7). Idempotent. */
export class StreamAlerts1763040000000 implements MigrationInterface {
  name = 'StreamAlerts1763040000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS stream_alerts (
      id varchar PRIMARY KEY,
      "guildId" varchar NOT NULL,
      "channelId" varchar NOT NULL,
      platform varchar(12) NOT NULL,
      handle varchar(64) NOT NULL,
      "displayName" varchar(100) NOT NULL,
      message varchar(300) NULL,
      "isLive" boolean NOT NULL DEFAULT false,
      "lastItemId" varchar(64) NULL,
      "lastNotifiedAt" timestamptz NULL,
      "checkedAt" timestamptz NOT NULL DEFAULT '1970-01-01',
      "lastError" varchar(200) NULL,
      "createdBy" varchar NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_stream_alerts_guild" ON stream_alerts ("guildId")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_stream_alerts_checked" ON stream_alerts ("checkedAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS stream_alerts`);
  }
}
