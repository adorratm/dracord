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
    await this.ensureChannelTypeValues(['FORUM', 'GAME', 'WATCH_PARTY']);
  }

  private async ensureChannelTypeValues(labels: string[]) {
    // PgBouncer (transaction pool) üzerinde ALTER TYPE sık break eder;
    // prod şema güncellemesi docker/schema-sync-once.sh ile direct Postgres’e yapılır.
    const dbUrl =
      this.dataSource.options && 'url' in this.dataSource.options
        ? String((this.dataSource.options as { url?: string }).url ?? '')
        : '';
    if (/pgbouncer/i.test(dbUrl)) {
      this.log.debug('PgBouncer — channel type enum DDL atlandı (schema-sync-once kullan)');
      return;
    }

    try {
      const exists = await this.dataSource.query<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'channels_type_enum'
        ) AS exists
      `);
      if (!exists[0]?.exists) return;

      for (const label of labels) {
        const has = await this.dataSource.query<{ exists: boolean }[]>(`
          SELECT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'channels_type_enum' AND e.enumlabel = $1
          ) AS exists
        `, [label]);
        if (has[0]?.exists) continue;
        await this.dataSource.query(
          `ALTER TYPE channels_type_enum ADD VALUE IF NOT EXISTS '${label}'`,
        );
        this.log.log(`channels_type_enum: ${label} eklendi`);
      }
    } catch (err) {
      this.log.warn(
        `Channel type enum kontrolü atlandı: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
