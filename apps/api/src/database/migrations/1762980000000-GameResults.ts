import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Profil oyun istatistikleri. Idempotent. */
export class GameResults1762980000000 implements MigrationInterface {
  name = 'GameResults1762980000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS game_results (
        id varchar PRIMARY KEY,
        "userId" varchar NOT NULL,
        kind varchar NOT NULL,
        "sessionId" varchar NOT NULL,
        "guildId" varchar NULL,
        won boolean NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_game_results_user_kind" ON game_results ("userId", kind)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_game_results_session_user" ON game_results ("sessionId", "userId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS game_results`);
  }
}
