import { Module } from '@nestjs/common';
import { SearchModule } from '@/search/search.module';
import { GuildsController, InvitesController } from './guilds.controller';
import { GuildsService } from './guilds.service';

@Module({
  imports: [SearchModule],
  controllers: [GuildsController, InvitesController],
  providers: [GuildsService],
  exports: [GuildsService],
})
export class GuildsModule {}
