import { Global, Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { BotsController } from './bots.controller';

@Global()
@Module({
  controllers: [BotsController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
