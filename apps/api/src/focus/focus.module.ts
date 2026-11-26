import { Module } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { FocusController } from './focus.controller';
import { FocusService } from './focus.service';

@Module({
  imports: [ChannelsModule, SocketBroadcastModule],
  controllers: [FocusController],
  providers: [FocusService],
})
export class FocusModule {}
