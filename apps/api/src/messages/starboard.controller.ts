import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { StarboardConfigService } from './starboard-config.service';

/** B9 — /guilds/:guildId/starboard */
@Controller('guilds/:guildId/starboard')
@UseGuards(JwtAuthGuard)
export class StarboardController {
  constructor(private readonly cfg: StarboardConfigService) {}

  @Get()
  get(@Param('guildId') guildId: string, @Req() req: { user: { sub: string } }) {
    return this.cfg.get(guildId, req.user.sub);
  }

  @Put()
  update(@Param('guildId') guildId: string, @Req() req: { user: { sub: string } }, @Body() body: unknown) {
    return this.cfg.update(guildId, req.user.sub, body);
  }
}
