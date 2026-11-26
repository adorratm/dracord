import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Yıl özeti: yazar + tarih aralığı sorguları için dizin. Idempotent. */
export class RecapIndex1762990000000 implements MigrationInterface {
  name = 'RecapIndex1762990000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_messages_author_created" ON messages ("authorId", "createdAt")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_reactions_user_created" ON reactions ("userId", "createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_messages_author_created"`);
    await q.query(`DROP INDEX IF EXISTS "IDX_reactions_user_created"`);
  }
}
