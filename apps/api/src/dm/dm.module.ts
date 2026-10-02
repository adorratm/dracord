import { Module } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { SearchModule } from '@/search/search.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { DmCallService } from './dm-call.service';
import { DmController } from './dm.controller';
import { DmService } from './dm.service';

@Module({
  imports: [SearchModule, ChannelsModule, VoicePresenceModule],
  controllers: [DmController],
  providers: [DmService, DmCallService],
  exports: [DmService, DmCallService],
})
export class DmModule {}
