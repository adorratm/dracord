import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Sunucu tanıtım sayfası + özel URL (B3). Idempotent; schema-sync de oluşturur. */
export class GuildVanity1762750000000 implements MigrationInterface {
  name = 'GuildVanity1762750000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE guilds ADD COLUMN IF NOT EXISTS "vanityCode" varchar(32) NULL`);
    await q.query(`ALTER TABLE guilds ADD COLUMN IF NOT EXISTS "publicPage" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE guilds ADD COLUMN IF NOT EXISTS "publicDescription" text NULL`);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_guilds_vanity_code" ON guilds ("vanityCode") WHERE "vanityCode" IS NOT NULL`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_guilds_vanity_code"`);
    await q.query(`ALTER TABLE guilds DROP COLUMN IF EXISTS "publicDescription"`);
    await q.query(`ALTER TABLE guilds DROP COLUMN IF EXISTS "publicPage"`);
    await q.query(`ALTER TABLE guilds DROP COLUMN IF EXISTS "vanityCode"`);
  }
}
