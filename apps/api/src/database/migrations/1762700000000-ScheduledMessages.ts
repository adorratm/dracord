import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Zamanlanmış mesajlar (A5). Prod: schema-sync de oluşturur; bu migration idempotent. */
export class ScheduledMessages1762700000000 implements MigrationInterface {
  name = 'ScheduledMessages1762700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id varchar PRIMARY KEY,
        "userId" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "channelId" varchar NOT NULL,
        "guildId" varchar NULL,
        content text NOT NULL DEFAULT '',
        attachments text NULL,
        "replyToId" varchar NULL,
        "sendAt" timestamptz NOT NULL,
        status varchar NOT NULL DEFAULT 'pending',
        "sentMessageId" varchar NULL,
        error varchar NULL,
        attempts int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_messages_status_sendAt" ON scheduled_messages (status, "sendAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_messages_user_status" ON scheduled_messages ("userId", status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_scheduled_messages_channel_user" ON scheduled_messages ("channelId", "userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS scheduled_messages`);
  }
}
