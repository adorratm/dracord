import { Module } from '@nestjs/common';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { LevelsController } from './levels.controller';
import { LevelsService } from './levels.service';

@Module({
  imports: [GuildsModule, NotificationsModule, SocketBroadcastModule],
  controllers: [LevelsController],
  providers: [LevelsService],
  exports: [LevelsService],
})
export class LevelsModule {}
