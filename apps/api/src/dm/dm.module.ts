import { Module } from '@nestjs/common';
import { SearchModule } from '@/search/search.module';
import { DmController } from './dm.controller';
import { DmService } from './dm.service';

@Module({
  imports: [SearchModule],
  controllers: [DmController],
  providers: [DmService],
  exports: [DmService],
})
export class DmModule {}
