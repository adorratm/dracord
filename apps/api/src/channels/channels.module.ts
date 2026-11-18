import { ChannelFollowsController } from './channel-follows.controller';
import { ChannelFollowsService } from './channel-follows.service';
import { Module } from '@nestjs/common';
import { GuildsModule } from '@/guilds/guilds.module';
import { SearchModule } from '@/search/search.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [GuildsModule, VoicePresenceModule, SearchModule],
  controllers: [ChannelsController, ChannelFollowsController],
  providers: [ChannelsService, ChannelFollowsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
