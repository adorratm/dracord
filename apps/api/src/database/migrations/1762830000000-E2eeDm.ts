import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Uçtan uca şifreli DM (E3). Idempotent; schema-sync de oluşturur. */
export class E2eeDm1762830000000 implements MigrationInterface {
  name = 'E2eeDm1762830000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS e2ee_devices (
        id varchar PRIMARY KEY,
        "userId" varchar NOT NULL,
        "publicKey" varchar(64) NOT NULL,
        name varchar(64) NOT NULL,
        platform varchar(16) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "lastSeenAt" timestamptz NULL
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_e2ee_devices_user" ON e2ee_devices ("userId")`);
    await q.query(`ALTER TABLE dm_channels ADD COLUMN IF NOT EXISTS "e2eeEnabled" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE dm_channels ADD COLUMN IF NOT EXISTS "e2eeEnabledById" varchar NULL`);
    await q.query(`ALTER TABLE dm_channels ADD COLUMN IF NOT EXISTS "e2eeEnabledAt" timestamptz NULL`);
    await q.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS e2ee jsonb NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE messages DROP COLUMN IF EXISTS e2ee`);
    await q.query(`ALTER TABLE dm_channels DROP COLUMN IF EXISTS "e2eeEnabledAt"`);
    await q.query(`ALTER TABLE dm_channels DROP COLUMN IF EXISTS "e2eeEnabledById"`);
    await q.query(`ALTER TABLE dm_channels DROP COLUMN IF EXISTS "e2eeEnabled"`);
    await q.query(`DROP TABLE IF EXISTS e2ee_devices`);
  }
}
