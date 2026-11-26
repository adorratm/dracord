import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Kanal panoları (D5). Idempotent. */
export class Kanban1763020000000 implements MigrationInterface {
  name = 'Kanban1763020000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS kanban_columns (
      id varchar PRIMARY KEY,
      "channelId" varchar NOT NULL,
      name varchar(60) NOT NULL,
      position double precision NOT NULL DEFAULT 0,
      color varchar(9) NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kanban_columns_channel" ON kanban_columns ("channelId", position)`);
    await q.query(`CREATE TABLE IF NOT EXISTS kanban_cards (
      id varchar PRIMARY KEY,
      "channelId" varchar NOT NULL,
      "columnId" varchar NOT NULL,
      title varchar(200) NOT NULL,
      description text NULL,
      "assigneeIds" jsonb NOT NULL DEFAULT '[]',
      labels jsonb NOT NULL DEFAULT '[]',
      "dueAt" timestamptz NULL,
      position double precision NOT NULL DEFAULT 0,
      "createdBy" varchar NOT NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_kanban_cards_channel" ON kanban_cards ("channelId", "columnId", position)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS kanban_cards`);
    await q.query(`DROP TABLE IF EXISTS kanban_columns`);
  }
}
