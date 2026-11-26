import { Module } from '@nestjs/common';
import { BotModule } from '@/bot/bot.module';
import { GuildsModule } from '@/guilds/guilds.module';
import { MessagesModule } from '@/messages/messages.module';
import { StreamAlertsController } from './stream-alerts.controller';
import { StreamAlertsService } from './stream-alerts.service';

@Module({
  imports: [GuildsModule, MessagesModule, BotModule],
  controllers: [StreamAlertsController],
  providers: [StreamAlertsService],
})
export class StreamAlertsModule {}
