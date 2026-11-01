import { Module } from '@nestjs/common';
import { RemoteControlService } from './remote-control.service';
import { VoicePresenceService } from './voice-presence.service';

@Module({
  providers: [VoicePresenceService, RemoteControlService],
  exports: [VoicePresenceService, RemoteControlService],
})
export class VoicePresenceModule {}
