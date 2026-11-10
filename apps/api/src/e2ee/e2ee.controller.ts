import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { E2eeService } from './e2ee.service';

@Controller('e2ee')
@UseGuards(JwtAuthGuard)
export class E2eeController {
  constructor(private readonly e2ee: E2eeService) {}

  @Get('devices')
  mine(@CurrentUser() user: JwtPayloadUser) {
    return this.e2ee.listMine(user.sub);
  }

  @Post('devices')
  register(@CurrentUser() user: JwtPayloadUser, @Body() body: { publicKey: string; name?: string; platform?: string }) {
    return this.e2ee.register(user.sub, body ?? {});
  }

  @Delete('devices/:id')
  remove(@CurrentUser() user: JwtPayloadUser, @Param('id') id: string) {
    return this.e2ee.remove(user.sub, id);
  }

  @Get('channels/:channelId')
  channel(@CurrentUser() user: JwtPayloadUser, @Param('channelId') channelId: string) {
    return this.e2ee.channelInfo(channelId, user.sub);
  }

  @Post('channels/:channelId')
  set(@CurrentUser() user: JwtPayloadUser, @Param('channelId') channelId: string, @Body() body: { enabled: boolean }) {
    return this.e2ee.setEnabled(channelId, user.sub, body?.enabled === true);
  }
}
