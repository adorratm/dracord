import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { DmService } from './dm.service';

@Controller('dm')
@UseGuards(JwtAuthGuard)
export class DmController {
  constructor(private readonly dm: DmService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser) {
    return this.dm.listForUser(user.sub);
  }

  @Post(':userId')
  open(@CurrentUser() user: JwtPayloadUser, @Param('userId') userId: string) {
    return this.dm.openOrCreate(user.sub, userId);
  }
}
