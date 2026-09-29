import { Module } from '@nestjs/common';
import { GuildsModule } from '@/guilds/guilds.module';
import { SearchModule } from '@/search/search.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [GuildsModule, VoicePresenceModule, SearchModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
