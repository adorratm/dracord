import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { AdminModule } from '@/admin/admin.module';
import { AuthModule } from '@/auth/auth.module';
import { PlatformAdminModule } from '@/platform-admin/platform-admin.module';
import { BotModule } from '@/bot/bot.module';
import { ChannelsModule } from '@/channels/channels.module';
import { DatabaseModule } from '@/database/database.module';
import { ChatGatewayModule } from '@/gateway/chat-gateway.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { MessagesModule } from '@/messages/messages.module';
import { MusicModule } from '@/music/music.module';
import { PresenceModule } from '@/presence/presence.module';
import { QueuesModule } from '@/queues/queues.module';
import { RolesModule } from '@/roles/roles.module';
import { UsersModule } from '@/users/users.module';
import { VoiceModule } from '@/voice/voice.module';
import { UploadsModule } from '@/uploads/uploads.module';
import { MediaModule } from '@/media/media.module';
import { HealthModule } from '@/health/health.module';
import { SearchModule } from '@/search/search.module';
import { DmModule } from '@/dm/dm.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { ActivitiesModule } from '@/activities/activities.module';
import { GuildEventsModule } from '@/guild-events/guild-events.module';
import { SpotifyModule } from '@/spotify/spotify.module';
import { PlatformModule } from '@/platform/platform.module';
import { BillingModule } from '@/billing/billing.module';
import { ModerationModule } from '@/moderation/moderation.module';
import { StickersModule } from '@/stickers/stickers.module';
import { MetricsModule } from '@/metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // yarn workspace cwd = apps/api; kök .env (KLIPY vb.) de yüklensin
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '../../.env'),
        join(__dirname, '../../../.env'),
      ],
    }),
    DatabaseModule,
    SocketBroadcastModule,
    ModerationModule,
    MetricsModule,
    QueuesModule,
    BotModule,
    AuthModule,
    UsersModule,
    GuildsModule,
    ChannelsModule,
    MessagesModule,
    MusicModule,
    RolesModule,
    PresenceModule,
    VoiceModule,
    UploadsModule,
    AdminModule,
    PlatformAdminModule,
    PlatformModule,
    BillingModule,
    ChatGatewayModule,
    MediaModule,
    HealthModule,
    SearchModule,
    DmModule,
    NotificationsModule,
    ActivitiesModule,
    GuildEventsModule,
    SpotifyModule,
    StickersModule,
  ],
})
export class AppModule {}
