import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ShowcaseService } from './showcase.service';

@Controller('showcase')
@UseGuards(JwtAuthGuard)
export class ShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  @Get('options')
  options(@CurrentUser() user: JwtPayloadUser) {
    return this.showcase.options(user.sub);
  }

  @Put()
  set(@CurrentUser() user: JwtPayloadUser, @Body() body: { guildId?: string | null }) {
    return this.showcase.setFeatured(user.sub, body?.guildId ? String(body.guildId) : null);
  }

  @Get('users/:userId')
  get(@Param('userId') userId: string) {
    return this.showcase.get(userId);
  }
}
