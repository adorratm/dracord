import type { MigrationInterface, QueryRunner } from 'typeorm';

/** E5 — 14 günlük bekleme ile hesap silme. Idempotent; bootstrap da ekler. */
export class AccountDeletion1762850000000 implements MigrationInterface {
  name = 'AccountDeletion1762850000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "deletionScheduledAt" timestamptz NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS "deletionScheduledAt"`);
  }
}
