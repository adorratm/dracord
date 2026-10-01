import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Postgres enum'larına yeni değer ekler (TypeORM synchronize çoğu zaman
 * enum genişletmez). Mevcut değer varsa sessizce geçer.
 */
@Injectable()
export class DatabaseBootstrapService implements OnModuleInit {
  private readonly log = new Logger(DatabaseBootstrapService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit() {
    await this.ensureChannelTypeForum();
  }

  private async ensureChannelTypeForum() {
    try {
      const exists = await this.dataSource.query<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'channels_type_enum'
        ) AS exists
      `);
      if (!exists[0]?.exists) return;

      const hasForum = await this.dataSource.query<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'channels_type_enum' AND e.enumlabel = 'FORUM'
        ) AS exists
      `);
      if (hasForum[0]?.exists) return;

      await this.dataSource.query(
        `ALTER TYPE channels_type_enum ADD VALUE IF NOT EXISTS 'FORUM'`,
      );
      this.log.log('channels_type_enum: FORUM eklendi');
    } catch (err) {
      this.log.warn(
        `FORUM enum kontrolü atlandı: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
