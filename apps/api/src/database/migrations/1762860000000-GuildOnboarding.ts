import type { MigrationInterface, QueryRunner } from 'typeorm';

/** B5 — katılış ekranı + tepki rolleri. Idempotent; schema-sync de oluşturur. */
export class GuildOnboarding1762860000000 implements MigrationInterface {
  name = 'GuildOnboarding1762860000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_onboarding (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        enabled boolean NOT NULL DEFAULT false,
        rules jsonb NOT NULL DEFAULT '[]',
        questions jsonb NOT NULL DEFAULT '[]',
        "defaultChannelIds" jsonb NOT NULL DEFAULT '[]',
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_guild_onboarding_guild" ON guild_onboarding ("guildId")`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS guild_onboarding_completions (
        "guildId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        "completedAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("guildId", "userId")
      )
    `);
    await q.query(`
      CREATE TABLE IF NOT EXISTS reaction_roles (
        id varchar PRIMARY KEY,
        "guildId" varchar NOT NULL,
        "channelId" varchar NOT NULL,
        "messageId" varchar NOT NULL,
        emoji varchar NOT NULL,
        "roleId" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_reaction_roles_message_emoji" UNIQUE ("messageId", emoji)
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_reaction_roles_guild" ON reaction_roles ("guildId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS reaction_roles`);
    await q.query(`DROP TABLE IF EXISTS guild_onboarding_completions`);
    await q.query(`DROP TABLE IF EXISTS guild_onboarding`);
  }
}
