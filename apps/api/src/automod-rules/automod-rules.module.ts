import { Module } from '@nestjs/common';
import { GuildsModule } from '@/guilds/guilds.module';
import { AutomodRulesController } from './automod-rules.controller';
import { AutomodRulesService } from './automod-rules.service';

@Module({
  imports: [GuildsModule],
  controllers: [AutomodRulesController],
  providers: [AutomodRulesService],
  exports: [AutomodRulesService],
})
export class AutomodRulesModule {}
