import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Oturum / cihaz yönetimi (E2). Idempotent; schema-sync de oluşturur. */
export class SessionDevices1762810000000 implements MigrationInterface {
  name = 'SessionDevices1762810000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "userAgent" varchar(300) NULL`);
    await q.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip varchar(64) NULL`);
    await q.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS platform varchar(16) NULL`);
    await q.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "lastUsedAt" timestamptz NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS "lastUsedAt"`);
    await q.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS platform`);
    await q.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS ip`);
    await q.query(`ALTER TABLE sessions DROP COLUMN IF EXISTS "userAgent"`);
  }
}
