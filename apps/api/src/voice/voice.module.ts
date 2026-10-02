import { Module, forwardRef } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { DmModule } from '@/dm/dm.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { VoicePresenceModule } from './voice-presence.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [
    ChannelsModule,
    GuildsModule,
    VoicePresenceModule,
    forwardRef(() => DmModule),
  ],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
