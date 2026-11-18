import { Module } from '@nestjs/common';
import { SocketBroadcastModule } from '@/gateway/socket-broadcast.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { LfgController } from './lfg.controller';
import { LfgService } from './lfg.service';

@Module({
  imports: [GuildsModule, SocketBroadcastModule],
  controllers: [LfgController],
  providers: [LfgService],
})
export class LfgModule {}
