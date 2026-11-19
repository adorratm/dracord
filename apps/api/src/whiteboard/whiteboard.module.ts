import { Module } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { WhiteboardController } from './whiteboard.controller';
import { WhiteboardService } from './whiteboard.service';

@Module({
  imports: [ChannelsModule, GuildsModule, SocketBroadcastModule],
  controllers: [WhiteboardController],
  providers: [WhiteboardService],
})
export class WhiteboardModule {}
