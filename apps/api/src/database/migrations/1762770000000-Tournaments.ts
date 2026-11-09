import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Turnuva modu (C2). Idempotent; schema-sync de oluşturur. */
export class Tournaments1762770000000 implements MigrationInterface {
  name = 'Tournaments1762770000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        name varchar NOT NULL,
        description text NULL,
        game varchar NOT NULL,
        "externalGameName" varchar NULL,
        status varchar NOT NULL DEFAULT 'registration',
        "maxPlayers" int NOT NULL DEFAULT 16,
        "creatorId" varchar NOT NULL,
        "participantIds" jsonb NOT NULL DEFAULT '[]',
        matches jsonb NOT NULL DEFAULT '[]',
        rounds int NOT NULL DEFAULT 0,
        "winnerId" varchar NULL,
        "startsAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "startedAt" timestamptz NULL,
        "finishedAt" timestamptz NULL
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_tournaments_guild_status" ON tournaments ("guildId", status)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS tournaments`);
  }
}
