import { Module } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { KanbanController } from './kanban.controller';
import { KanbanService } from './kanban.service';

@Module({
  imports: [ChannelsModule, GuildsModule, SocketBroadcastModule],
  controllers: [KanbanController],
  providers: [KanbanService],
})
export class KanbanModule {}
