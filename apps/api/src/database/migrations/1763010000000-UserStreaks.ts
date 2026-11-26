import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Günlük seriler (D2). Idempotent. */
export class UserStreaks1763010000000 implements MigrationInterface {
  name = 'UserStreaks1763010000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS user_streaks (
      "userId" varchar PRIMARY KEY,
      current int NOT NULL DEFAULT 0,
      best int NOT NULL DEFAULT 0,
      "lastDay" varchar(10) NULL,
      freezes int NOT NULL DEFAULT 0,
      "freezesUsed" int NOT NULL DEFAULT 0,
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS user_streaks`);
  }
}
