import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { GuildEventsController } from './guild-events.controller';
import { GuildEventsService } from './guild-events.service';

@Module({
  imports: [AuthModule],
  controllers: [GuildEventsController],
  providers: [GuildEventsService],
  exports: [GuildEventsService],
})
export class GuildEventsModule {}
