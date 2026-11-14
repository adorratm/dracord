import type { MigrationInterface, QueryRunner } from 'typeorm';

/** GAME kanalı → geliştirici portalındaki oyun (gameKind 'app'). Idempotent; schema-sync de ekler. */
export class ChannelGameApp1762840000000 implements MigrationInterface {
  name = 'ChannelGameApp1762840000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE channels ADD COLUMN IF NOT EXISTS "gameAppId" varchar NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE channels DROP COLUMN IF EXISTS "gameAppId"`);
  }
}
