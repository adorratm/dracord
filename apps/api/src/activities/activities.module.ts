import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ChannelsModule } from '@/channels/channels.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { VoicePresenceModule } from '@/voice/voice-presence.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [AuthModule, ChannelsModule, VoicePresenceModule, SocketBroadcastModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
