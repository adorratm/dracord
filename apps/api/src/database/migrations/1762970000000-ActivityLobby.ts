import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Oyun odası lobisi: hazır olanlar + "herkes hazır olunca başla". Idempotent. */
export class ActivityLobby1762970000000 implements MigrationInterface {
  name = 'ActivityLobby1762970000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS "readyIds" jsonb NOT NULL DEFAULT '[]'`);
    await q.query(`ALTER TABLE activity_sessions ADD COLUMN IF NOT EXISTS "waitForReady" boolean NOT NULL DEFAULT false`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE activity_sessions DROP COLUMN IF EXISTS "waitForReady"`);
    await q.query(`ALTER TABLE activity_sessions DROP COLUMN IF EXISTS "readyIds"`);
  }
}
