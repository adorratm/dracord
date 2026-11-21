import type { MigrationInterface, QueryRunner } from 'typeorm';

/** İstemci hata raporları. Idempotent; schema-sync de oluşturur. */
export class ClientErrors1762960000000 implements MigrationInterface {
  name = 'ClientErrors1762960000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS client_errors (
        id varchar PRIMARY KEY,
        fingerprint varchar NOT NULL,
        platform varchar NOT NULL,
        message text NOT NULL,
        stack text NOT NULL DEFAULT '',
        count int NOT NULL DEFAULT 1,
        "lastVersion" varchar NULL,
        "lastPath" varchar NULL,
        "lastAgent" varchar NULL,
        resolved boolean NOT NULL DEFAULT false,
        "firstSeen" timestamptz NOT NULL DEFAULT now(),
        "lastSeen" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_client_errors_fp" ON client_errors (fingerprint)`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_client_errors_seen" ON client_errors ("lastSeen")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS client_errors`);
  }
}
