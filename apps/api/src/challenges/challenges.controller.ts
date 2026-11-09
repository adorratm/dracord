import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ChallengesService } from './challenges.service';

@Controller('guilds/:guildId/challenges')
@UseGuards(JwtAuthGuard)
export class ChallengesController {
  constructor(private readonly c: ChallengesService) {}

  @Get()
  get(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.c.get(guildId, user.sub);
  }

  @Post(':challengeId/claim')
  claim(@Param('guildId') guildId: string, @Param('challengeId') challengeId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.c.claim(guildId, user.sub, decodeURIComponent(challengeId));
  }
}
