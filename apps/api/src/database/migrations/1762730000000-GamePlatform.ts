import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Oyun platformu (C1). Idempotent; schema-sync de oluşturur. */
export class GamePlatform1762730000000 implements MigrationInterface {
  name = 'GamePlatform1762730000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS game_apps (
        id varchar PRIMARY KEY,
        "ownerUserId" varchar NOT NULL,
        name varchar(40) NOT NULL,
        slug varchar(48) NOT NULL,
        "shortDescription" varchar(120) NOT NULL DEFAULT '',
        description text NOT NULL DEFAULT '',
        "iconUrl" varchar NULL,
        "coverUrl" varchar NULL,
        "entryUrl" varchar NOT NULL,
        "minPlayers" int NOT NULL DEFAULT 1,
        "maxPlayers" int NOT NULL DEFAULT 8,
        orientation varchar NOT NULL DEFAULT 'any',
        platforms jsonb NOT NULL DEFAULT '["web","desktop"]',
        status varchar NOT NULL DEFAULT 'draft',
        "reviewNote" text NULL,
        "reviewedById" varchar NULL,
        "reviewedAt" timestamptz NULL,
        "submittedAt" timestamptz NULL,
        "testerUserIds" jsonb NOT NULL DEFAULT '[]',
        "secretHash" varchar NULL,
        "secretLast4" varchar(8) NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_game_apps_slug" ON game_apps (slug)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_game_apps_status" ON game_apps (status)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_game_apps_owner" ON game_apps ("ownerUserId")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id varchar PRIMARY KEY,
        "gameId" varchar NOT NULL,
        "guildId" varchar NOT NULL,
        "channelId" varchar NOT NULL,
        "hostUserId" varchar NOT NULL,
        "participantIds" jsonb NOT NULL DEFAULT '[]',
        status varchar NOT NULL DEFAULT 'active',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "endedAt" timestamptz NULL
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_sessions_channel" ON game_sessions ("guildId", "channelId", status)`,
    );
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_game_sessions_game" ON game_sessions ("gameId", status)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS game_sessions`);
    await q.query(`DROP TABLE IF EXISTS game_apps`);
  }
}
