import { Module } from '@nestjs/common';
import { VoicePresenceService } from './voice-presence.service';

@Module({
  providers: [VoicePresenceService],
  exports: [VoicePresenceService],
})
export class VoicePresenceModule {}
