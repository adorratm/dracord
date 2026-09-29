import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MessagesModule } from '../messages/messages.module';
import { PresenceModule } from '../presence/presence.module';
import { VoicePresenceModule } from '../voice/voice-presence.module';
import { ChatGateway } from './chat.gateway';
import { WsJwtGuard } from './ws-jwt.guard';

@Module({
  imports: [
    JwtModule.register({}),
    MessagesModule,
    PresenceModule,
    VoicePresenceModule,
  ],
  providers: [ChatGateway, WsJwtGuard],
})
export class ChatGatewayModule {}
