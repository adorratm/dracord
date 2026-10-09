import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChannelsModule } from '@/channels/channels.module';
import { MessagesModule } from '@/messages/messages.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { PresenceModule } from '@/presence/presence.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { ChatGateway } from './chat.gateway';
import { SocketBroadcastModule } from './socket-broadcast.module';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  imports: [
    JwtModule.register({}),
    ChannelsModule,
    MessagesModule,
    PresenceModule,
    VoicePresenceModule,
    NotificationsModule,
    SocketBroadcastModule,
  ],
  providers: [ChatGateway, WsJwtGuard],
  exports: [ChatGateway],
})
export class ChatGatewayModule {}
