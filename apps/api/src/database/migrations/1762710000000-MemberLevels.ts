import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Seviye / XP (B1). Idempotent; schema-sync de oluşturur. */
export class MemberLevels1762710000000 implements MigrationInterface {
  name = 'MemberLevels1762710000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS member_levels (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        xp int NOT NULL DEFAULT 0,
        level int NOT NULL DEFAULT 0,
        "messageCount" int NOT NULL DEFAULT 0,
        "voiceMinutes" int NOT NULL DEFAULT 0,
        "lastMessageXpAt" timestamptz NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_member_levels_guild_user" ON member_levels ("guildId", "userId")`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_member_levels_guild_xp" ON member_levels ("guildId", xp)`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_level_configs (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        announce varchar NOT NULL DEFAULT 'notification',
        "messageXpMin" int NOT NULL DEFAULT 15,
        "messageXpMax" int NOT NULL DEFAULT 25,
        "voiceXpPerMinute" int NOT NULL DEFAULT 4,
        "roleRewards" text NULL,
        "noXpChannelIds" text NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_guild_level_configs_guild" ON guild_level_configs ("guildId")`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS guild_level_configs`);
    await q.query(`DROP TABLE IF EXISTS member_levels`);
  }
}
