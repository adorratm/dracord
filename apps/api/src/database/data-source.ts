import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { InitPlatformExtras1730000000000 } from './migrations/1730000000000-InitPlatformExtras';
import { ScheduledMessages1762700000000 } from './migrations/1762700000000-ScheduledMessages';
import { MemberLevels1762710000000 } from './migrations/1762710000000-MemberLevels';
import { GuildSounds1762720000000 } from './migrations/1762720000000-GuildSounds';
import { GamePlatform1762730000000 } from './migrations/1762730000000-GamePlatform';
import { GuildStats1762740000000 } from './migrations/1762740000000-GuildStats';

loadEnv();

/**
 * CLI DataSource — migration runner.
 * DATABASE_URL gerekir.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [],
  migrations: [InitPlatformExtras1730000000000, ScheduledMessages1762700000000, MemberLevels1762710000000, GuildSounds1762720000000, GamePlatform1762730000000, GuildStats1762740000000],
  synchronize: false,
});
