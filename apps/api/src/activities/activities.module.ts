import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ChannelsModule } from '@/channels/channels.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [AuthModule, ChannelsModule, SocketBroadcastModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
