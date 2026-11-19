import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CommunityService } from './community.service';
import { TicketsService } from './tickets.service';

type AuthedReq = { user: { sub: string } };

/** B7 — giveaways + birthdays */
@Controller()
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly tickets: TicketsService,
  ) {}

  // ── B6: destek talepleri ──
  @Get('guilds/:guildId/tickets/config')
  ticketConfig(@Param('guildId') guildId: string, @Req() req: AuthedReq) {
    return this.tickets.getConfig(guildId, req.user.sub);
  }

  @Put('guilds/:guildId/tickets/config')
  setTicketConfig(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.tickets.setConfig(guildId, req.user.sub, body);
  }

  @Get('guilds/:guildId/tickets')
  listTickets(@Param('guildId') guildId: string, @Req() req: AuthedReq) {
    return this.tickets.list(guildId, req.user.sub);
  }

  @Post('guilds/:guildId/tickets')
  openTicket(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.tickets.open(guildId, req.user.sub, body);
  }

  @Post('tickets/:id/close')
  closeTicket(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.tickets.close(id, req.user.sub);
  }

  @Post('tickets/:id/reopen')
  reopenTicket(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.tickets.reopen(id, req.user.sub);
  }

  @Get('guilds/:guildId/giveaways')
  list(@Param('guildId') guildId: string, @Req() req: AuthedReq) {
    return this.community.listGiveaways(guildId, req.user.sub);
  }

  @Post('guilds/:guildId/giveaways')
  create(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.community.createGiveaway(guildId, req.user.sub, body);
  }

  @Post('giveaways/:id/enter')
  enter(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.community.toggleEntry(id, req.user.sub);
  }

  @Post('giveaways/:id/end')
  end(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.community.endNow(id, req.user.sub);
  }

  @Post('giveaways/:id/reroll')
  reroll(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.community.reroll(id, req.user.sub);
  }

  @Get('users/me/birthday')
  myBirthday(@Req() req: AuthedReq) {
    return this.community.getMyBirthday(req.user.sub);
  }

  @Put('users/me/birthday')
  setMyBirthday(@Req() req: AuthedReq, @Body() body: unknown) {
    return this.community.setMyBirthday(req.user.sub, body);
  }

  @Get('guilds/:guildId/birthdays')
  birthdayConfig(@Param('guildId') guildId: string, @Req() req: AuthedReq) {
    return this.community.getBirthdayConfig(guildId, req.user.sub);
  }

  @Put('guilds/:guildId/birthdays')
  setBirthdayConfig(@Param('guildId') guildId: string, @Req() req: AuthedReq, @Body() body: unknown) {
    return this.community.setBirthdayConfig(guildId, req.user.sub, body);
  }
}
