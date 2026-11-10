import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { InitPlatformExtras1730000000000 } from './migrations/1730000000000-InitPlatformExtras';
import { ScheduledMessages1762700000000 } from './migrations/1762700000000-ScheduledMessages';
import { MemberLevels1762710000000 } from './migrations/1762710000000-MemberLevels';
import { GuildSounds1762720000000 } from './migrations/1762720000000-GuildSounds';
import { GamePlatform1762730000000 } from './migrations/1762730000000-GamePlatform';
import { GuildStats1762740000000 } from './migrations/1762740000000-GuildStats';
import { GuildVanity1762750000000 } from './migrations/1762750000000-GuildVanity';
import { GuildBadges1762760000000 } from './migrations/1762760000000-GuildBadges';
import { Tournaments1762770000000 } from './migrations/1762770000000-Tournaments';
import { WeeklyChallenges1762780000000 } from './migrations/1762780000000-WeeklyChallenges';
import { GuildAutomod1762790000000 } from './migrations/1762790000000-GuildAutomod';
import { GuildFaq1762800000000 } from './migrations/1762800000000-GuildFaq';
import { SessionDevices1762810000000 } from './migrations/1762810000000-SessionDevices';
import { UserPasskeys1762820000000 } from './migrations/1762820000000-UserPasskeys';

loadEnv();

/**
 * CLI DataSource — migration runner.
 * DATABASE_URL gerekir.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [],
  migrations: [InitPlatformExtras1730000000000, ScheduledMessages1762700000000, MemberLevels1762710000000, GuildSounds1762720000000, GamePlatform1762730000000, GuildStats1762740000000, GuildVanity1762750000000, GuildBadges1762760000000, Tournaments1762770000000, WeeklyChallenges1762780000000, GuildAutomod1762790000000, GuildFaq1762800000000, SessionDevices1762810000000, UserPasskeys1762820000000],
  synchronize: false,
});
