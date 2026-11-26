import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RecapService } from './recap.service';

@Controller('users/me/recap')
@UseGuards(JwtAuthGuard)
export class RecapController {
  constructor(private readonly recap: RecapService) {}

  /** ?year=2026 (varsayılan: bu yıl) */
  @Get()
  get(@CurrentUser() user: JwtPayloadUser, @Query('year') year?: string) {
    return this.recap.get(user.sub, Number(year) || new Date().getFullYear());
  }
}
