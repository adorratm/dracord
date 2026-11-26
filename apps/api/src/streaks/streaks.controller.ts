import { Controller, Get, UseGuards } from '@nestjs/common';
import type { UserStreakDto } from '@dracord/types';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { StreaksService } from './streaks.service';

@Controller('users/me/streak')
@UseGuards(JwtAuthGuard)
export class StreaksController {
  constructor(private readonly streaks: StreaksService) {}

  @Get()
  get(@CurrentUser() user: JwtPayloadUser): Promise<UserStreakDto> {
    return this.streaks.get(user.sub);
  }
}
