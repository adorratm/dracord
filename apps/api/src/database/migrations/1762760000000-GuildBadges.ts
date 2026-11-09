import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Sunucu rozeti + profil vitrini (B4). Idempotent; schema-sync de oluşturur. */
export class GuildBadges1762760000000 implements MigrationInterface {
  name = 'GuildBadges1762760000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE guilds ADD COLUMN IF NOT EXISTS "badgeTag" varchar(8) NULL`);
    await q.query(`ALTER TABLE guilds ADD COLUMN IF NOT EXISTS "badgeEmoji" varchar(16) NULL`);
    await q.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "featuredGuildId" varchar NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN IF EXISTS "featuredGuildId"`);
    await q.query(`ALTER TABLE guilds DROP COLUMN IF EXISTS "badgeEmoji"`);
    await q.query(`ALTER TABLE guilds DROP COLUMN IF EXISTS "badgeTag"`);
  }
}
