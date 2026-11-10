import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Passkey (E1). Idempotent; schema-sync de oluşturur. */
export class UserPasskeys1762820000000 implements MigrationInterface {
  name = 'UserPasskeys1762820000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS user_passkeys (
        id varchar(512) PRIMARY KEY,
        "userId" varchar NOT NULL,
        "publicKey" text NOT NULL,
        counter bigint NOT NULL DEFAULT 0,
        transports jsonb NULL,
        name varchar(64) NOT NULL,
        "deviceType" varchar(16) NULL,
        "backedUp" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "lastUsedAt" timestamptz NULL
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_user_passkeys_user" ON user_passkeys ("userId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS user_passkeys`);
  }
}
