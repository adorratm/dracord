import { Module } from '@nestjs/common';
import { ChannelsModule } from '@/channels/channels.module';
import { SearchModule } from '@/search/search.module';
import { DmController } from './dm.controller';
import { DmService } from './dm.service';

@Module({
  imports: [SearchModule, ChannelsModule],
  controllers: [DmController],
  providers: [DmService],
  exports: [DmService],
})
export class DmModule {}
