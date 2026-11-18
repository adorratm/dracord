import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';

type AuthedReq = { user: { sub: string } };

/** B5 — /guilds/:guildId/onboarding + /guilds/:guildId/reaction-roles */
@Controller('guilds/:guildId')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('onboarding')
  get(@Param('guildId') guildId: string, @Req() req: AuthedReq) {
    return this.onboarding.get(guildId, req.user.sub);
  }

  @Put('onboarding')
  update(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.onboarding.update(guildId, req.user.sub, body);
  }

  @Post('onboarding/complete')
  complete(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.onboarding.complete(guildId, req.user.sub, body);
  }

  @Get('reaction-roles')
  listReactionRoles(@Param('guildId') guildId: string, @Req() req: AuthedReq) {
    return this.onboarding.listReactionRoles(guildId, req.user.sub);
  }

  @Post('reaction-roles')
  addReactionRole(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.onboarding.addReactionRole(guildId, req.user.sub, body);
  }

  @Delete('reaction-roles/:id')
  removeReactionRole(@Param('guildId') guildId: string, @Param('id') id: string, @Req() req: AuthedReq) {
    return this.onboarding.removeReactionRole(guildId, req.user.sub, id);
  }
}
