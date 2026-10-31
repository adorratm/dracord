import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Örnek / iskelet migration — prod’da synchronize kapalıyken çalıştır.
 * yarn workspace @dracord/api db:migrate
 */
export class InitPlatformExtras1730000000000 implements MigrationInterface {
  name = 'InitPlatformExtras1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS funnel_events (
        id varchar PRIMARY KEY,
        event varchar(64) NOT NULL,
        meta jsonb NULL,
        "userId" varchar NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_funnel_events_event" ON funnel_events (event)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_funnel_events_event_created" ON funnel_events (event, "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS content_hashes (
        id varchar PRIMARY KEY,
        "hashValue" varchar(128) NOT NULL,
        algorithm varchar NOT NULL DEFAULT 'sha256-prefix',
        category varchar NOT NULL,
        score float NOT NULL DEFAULT 0.95,
        note text NULL,
        active boolean NOT NULL DEFAULT true,
        "createdByUserId" varchar NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_content_hashes_hashValue" ON content_hashes ("hashValue")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS gift_codes (
        id varchar PRIMARY KEY,
        code varchar(32) NOT NULL UNIQUE,
        kind varchar NOT NULL,
        label varchar NOT NULL,
        "createdByUserId" varchar NOT NULL,
        "redeemedByUserId" varchar NULL,
        "redeemedAt" timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_audit_logs (
        id varchar PRIMARY KEY,
        "applicationId" varchar NULL,
        "actorUserId" varchar NULL,
        action varchar NOT NULL,
        "targetId" varchar NULL,
        meta jsonb NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE slash_commands
      ADD COLUMN IF NOT EXISTS options jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE slash_commands DROP COLUMN IF EXISTS options`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS platform_audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS gift_codes`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_hashes`);
    await queryRunner.query(`DROP TABLE IF EXISTS funnel_events`);
  }
}
