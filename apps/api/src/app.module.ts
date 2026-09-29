import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { DatabaseModule } from './database/database.module';
import { ChatGatewayModule } from './gateway/chat-gateway.module';
import { GuildsModule } from './guilds/guilds.module';
import { MessagesModule } from './messages/messages.module';
import { PresenceModule } from './presence/presence.module';
import { QueuesModule } from './queues/queues.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { VoiceModule } from './voice/voice.module';
import { UploadsModule } from './uploads/uploads.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    QueuesModule,
    AuthModule,
    UsersModule,
    GuildsModule,
    ChannelsModule,
    MessagesModule,
    RolesModule,
    PresenceModule,
    VoiceModule,
    UploadsModule,
    AdminModule,
    ChatGatewayModule,
    MediaModule,
  ],
})
export class AppModule {}
