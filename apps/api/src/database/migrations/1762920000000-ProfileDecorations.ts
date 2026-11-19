import type { MigrationInterface, QueryRunner } from 'typeorm';

/** F1 — profil süsleri. Idempotent; schema-sync de ekler. */
export class ProfileDecorations1762920000000 implements MigrationInterface {
  name = 'ProfileDecorations1762920000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "avatarDecoration" varchar(24) NULL`);
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "profileEffect" varchar(24) NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS "profileEffect"`);
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS "avatarDecoration"`);
  }
}
