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
import { E2eeDm1762830000000 } from './migrations/1762830000000-E2eeDm';
import { ChannelGameApp1762840000000 } from './migrations/1762840000000-ChannelGameApp';
import { AccountDeletion1762850000000 } from './migrations/1762850000000-AccountDeletion';
import { GuildOnboarding1762860000000 } from './migrations/1762860000000-GuildOnboarding';
import { LfgListings1762870000000 } from './migrations/1762870000000-LfgListings';
import { SlowModeAnnouncements1762880000000 } from './migrations/1762880000000-SlowModeAnnouncements';
import { Starboard1762890000000 } from './migrations/1762890000000-Starboard';
import { GiveawaysBirthdays1762900000000 } from './migrations/1762900000000-GiveawaysBirthdays';
import { Tickets1762910000000 } from './migrations/1762910000000-Tickets';
import { ProfileDecorations1762920000000 } from './migrations/1762920000000-ProfileDecorations';
import { Whiteboard1762930000000 } from './migrations/1762930000000-Whiteboard';
import { TournamentFormats1762940000000 } from './migrations/1762940000000-TournamentFormats';
import { GuildSubscriptions1762950000000 } from './migrations/1762950000000-GuildSubscriptions';
import { ClientErrors1762960000000 } from './migrations/1762960000000-ClientErrors';
import { ActivityLobby1762970000000 } from './migrations/1762970000000-ActivityLobby';
import { GameResults1762980000000 } from './migrations/1762980000000-GameResults';
import { RecapIndex1762990000000 } from './migrations/1762990000000-RecapIndex';
import { GameResultStats1763000000000 } from './migrations/1763000000000-GameResultStats';

loadEnv();

/**
 * CLI DataSource — migration runner.
 * DATABASE_URL gerekir.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [],
  migrations: [InitPlatformExtras1730000000000, ScheduledMessages1762700000000, MemberLevels1762710000000, GuildSounds1762720000000, GamePlatform1762730000000, GuildStats1762740000000, GuildVanity1762750000000, GuildBadges1762760000000, Tournaments1762770000000, WeeklyChallenges1762780000000, GuildAutomod1762790000000, GuildFaq1762800000000, SessionDevices1762810000000, UserPasskeys1762820000000, E2eeDm1762830000000, ChannelGameApp1762840000000, AccountDeletion1762850000000, GuildOnboarding1762860000000, LfgListings1762870000000, SlowModeAnnouncements1762880000000, Starboard1762890000000, GiveawaysBirthdays1762900000000, Tickets1762910000000, ProfileDecorations1762920000000, Whiteboard1762930000000, TournamentFormats1762940000000, GuildSubscriptions1762950000000, ClientErrors1762960000000, ActivityLobby1762970000000, GameResults1762980000000, RecapIndex1762990000000, GameResultStats1763000000000],
  synchronize: false,
});
