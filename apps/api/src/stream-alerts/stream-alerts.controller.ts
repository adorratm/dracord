import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { StreamAlertsService } from './stream-alerts.service';

type AuthedReq = { user: { sub: string } };

/** D7 — /guilds/:guildId/stream-alerts */
@Controller('guilds/:guildId/stream-alerts')
@UseGuards(JwtAuthGuard)
export class StreamAlertsController {
  constructor(private readonly alerts: StreamAlertsService) {}

  @Get()
  list(@Param('guildId') guildId: string, @Req() req: AuthedReq) {
    return this.alerts.list(guildId, req.user.sub);
  }

  @Post()
  create(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: Record<string, unknown>) {
    return this.alerts.create(guildId, req.user.sub, body ?? {});
  }

  @Patch(':id')
  update(@Param('guildId') guildId: string, @Param('id') id: string, @Req() req: AuthedReq, @Body() body: Record<string, unknown>) {
    return this.alerts.update(guildId, req.user.sub, id, body ?? {});
  }

  @Delete(':id')
  remove(@Param('guildId') guildId: string, @Param('id') id: string, @Req() req: AuthedReq) {
    return this.alerts.remove(guildId, req.user.sub, id);
  }

  @Post(':id/test')
  test(@Param('guildId') guildId: string, @Param('id') id: string, @Req() req: AuthedReq) {
    return this.alerts.test(guildId, req.user.sub, id);
  }
}
