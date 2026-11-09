import { Module } from '@nestjs/common';
import { GuildsModule } from '@/guilds/guilds.module';
import { LevelsModule } from '@/levels/levels.module';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [GuildsModule, LevelsModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
})
export class ChallengesModule {}
