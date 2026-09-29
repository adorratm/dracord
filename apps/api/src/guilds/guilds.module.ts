import { Module } from '@nestjs/common';
import { GuildsController, InvitesController } from './guilds.controller';
import { GuildsService } from './guilds.service';

@Module({
  controllers: [GuildsController, InvitesController],
  providers: [GuildsService],
  exports: [GuildsService],
})
export class GuildsModule {}
