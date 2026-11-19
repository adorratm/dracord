import type { MigrationInterface, QueryRunner } from 'typeorm';

/** C6 — turnuva biçimi (tek eleme / lig / 4'lü masa). Idempotent; schema-sync de ekler. */
export class TournamentFormats1762940000000 implements MigrationInterface {
  name = 'TournamentFormats1762940000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS "format" varchar NOT NULL DEFAULT 'single'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE tournaments DROP COLUMN IF EXISTS "format"`);
  }
}
