import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from '@/admin/admin.module';
import { AuthModule } from '@/auth/auth.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SocketBroadcastModule,
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
    ChatGatewayModule,
    MediaModule,
    HealthModule,
    SearchModule,
    DmModule,
    NotificationsModule,
  ],
})
export class AppModule {}
