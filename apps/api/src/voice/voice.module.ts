import { Module, forwardRef } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { ChatGatewayModule } from '@/gateway/chat-gateway.module';
import { VoicePresenceModule } from './voice-presence.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [ChannelsModule, VoicePresenceModule, forwardRef(() => ChatGatewayModule)],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
