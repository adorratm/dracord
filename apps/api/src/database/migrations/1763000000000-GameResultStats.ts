import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Harici oyun sonuçlarına istatistik (puan, leş, süre…). Idempotent. */
export class GameResultStats1763000000000 implements MigrationInterface {
  name = 'GameResultStats1763000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE game_results ADD COLUMN IF NOT EXISTS stats jsonb NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE game_results DROP COLUMN IF EXISTS stats`);
  }
}
