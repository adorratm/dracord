import { Module } from '@nestjs/common';
import { GuildsModule } from '@/guilds/guilds.module';
import { GuildStatsController } from './guild-stats.controller';
import { GuildStatsService } from './guild-stats.service';

@Module({
  imports: [GuildsModule],
  controllers: [GuildStatsController],
  providers: [GuildStatsService],
  exports: [GuildStatsService],
})
export class GuildStatsModule {}
