import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { InitPlatformExtras1730000000000 } from './migrations/1730000000000-InitPlatformExtras';

loadEnv();

/**
 * CLI DataSource — migration runner.
 * DATABASE_URL gerekir.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [],
  migrations: [InitPlatformExtras1730000000000],
  synchronize: false,
});
