import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

/** F2 — sunucu abonelikleri */
@Controller('guilds/:guildId/subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly s: SubscriptionsService) {}

  @Get()
  overview(@Param('guildId') guildId: string, @CurrentUser() u: JwtPayloadUser) {
    return this.s.overview(guildId, u.sub);
  }

  @Post('tiers')
  createTier(@Param('guildId') guildId: string, @CurrentUser() u: JwtPayloadUser, @Body() body: Record<string, unknown>) {
    return this.s.createTier(guildId, u.sub, body ?? {});
  }

  @Patch('tiers/:tierId')
  updateTier(@Param('guildId') guildId: string, @Param('tierId') tierId: string, @CurrentUser() u: JwtPayloadUser, @Body() body: Record<string, unknown>) {
    return this.s.updateTier(guildId, tierId, u.sub, body ?? {});
  }

  @Delete('tiers/:tierId')
  deleteTier(@Param('guildId') guildId: string, @Param('tierId') tierId: string, @CurrentUser() u: JwtPayloadUser) {
    return this.s.deleteTier(guildId, tierId, u.sub);
  }

  @Get('members')
  members(@Param('guildId') guildId: string, @CurrentUser() u: JwtPayloadUser) {
    return this.s.listSubscribers(guildId, u.sub);
  }

  @Post('members')
  grant(@Param('guildId') guildId: string, @CurrentUser() u: JwtPayloadUser, @Body() body: Record<string, unknown>) {
    return this.s.grant(guildId, u.sub, body ?? {});
  }

  @Delete('members/:subId')
  revoke(@Param('guildId') guildId: string, @Param('subId') subId: string, @CurrentUser() u: JwtPayloadUser) {
    return this.s.revoke(guildId, u.sub, subId);
  }

  @Get('codes')
  codes(@Param('guildId') guildId: string, @CurrentUser() u: JwtPayloadUser) {
    return this.s.listCodes(guildId, u.sub);
  }

  @Post('codes')
  createCodes(@Param('guildId') guildId: string, @CurrentUser() u: JwtPayloadUser, @Body() body: Record<string, unknown>) {
    return this.s.createCodes(guildId, u.sub, body ?? {});
  }

  @Delete('codes/:codeId')
  deleteCode(@Param('guildId') guildId: string, @Param('codeId') codeId: string, @CurrentUser() u: JwtPayloadUser) {
    return this.s.deleteCode(guildId, u.sub, codeId);
  }

  @Post('redeem')
  redeem(@Param('guildId') guildId: string, @CurrentUser() u: JwtPayloadUser, @Body() body: { code?: string }) {
    return this.s.redeem(guildId, u.sub, body?.code);
  }
}
