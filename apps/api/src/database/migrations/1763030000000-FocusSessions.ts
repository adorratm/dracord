import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Ortak odak zamanlayıcısı (D6). Idempotent. */
export class FocusSessions1763030000000 implements MigrationInterface {
  name = 'FocusSessions1763030000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS focus_sessions (
      "channelId" varchar PRIMARY KEY,
      "startedAt" timestamptz NULL,
      "focusMin" int NOT NULL DEFAULT 25,
      "breakMin" int NOT NULL DEFAULT 5,
      "longBreakMin" int NOT NULL DEFAULT 15,
      "longEvery" int NOT NULL DEFAULT 4,
      "startedBy" varchar NULL,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS focus_sessions`);
  }
}
