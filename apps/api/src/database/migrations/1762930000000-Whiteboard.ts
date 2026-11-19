import type { MigrationInterface, QueryRunner } from 'typeorm';

/** G3 — beyaz tahta. Idempotent; schema-sync de oluşturur. */
export class Whiteboard1762930000000 implements MigrationInterface {
  name = 'Whiteboard1762930000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS whiteboard_strokes (
        id varchar PRIMARY KEY,
        "channelId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        tool varchar(12) NOT NULL,
        color varchar(9) NOT NULL,
        width real NOT NULL,
        points jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_whiteboard_channel_created" ON whiteboard_strokes ("channelId", "createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS whiteboard_strokes`);
  }
}
