import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { GuildsService } from './guilds.service';

@Controller('guilds')
@UseGuards(JwtAuthGuard)
export class GuildsController {
  constructor(private readonly guildsService: GuildsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayloadUser) {
    return this.guildsService.listForUser(user.sub);
  }

  @Get('discover')
  discover(@Query('q') q?: string) {
    return this.guildsService.discover(q);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { name: string; iconUrl?: string | null; discoverable?: boolean },
  ) {
    return this.guildsService.createGuild(user.sub, body);
  }

  @Get(':guildId')
  getOne(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.guildsService.getGuild(guildId, user.sub);
  }

  @Get(':guildId/members')
  members(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.guildsService.listMembers(guildId, user.sub);
  }

  @Get(':guildId/permissions')
  myPermissions(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.guildsService.listMyPermissions(guildId, user.sub);
  }

  @Patch(':guildId')
  update(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      name?: string;
      iconUrl?: string | null;
      bannerUrl?: string | null;
      discoverable?: boolean;
      afkChannelId?: string | null;
      afkTimeoutMinutes?: number;
    },
  ) {
    return this.guildsService.updateGuild(guildId, user.sub, body);
  }

  @Delete(':guildId')
  async remove(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    await this.guildsService.deleteGuild(guildId, user.sub);
    return { ok: true };
  }

  @Post(':guildId/invites')
  createInvite(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { maxUses?: number | null; expiresInHours?: number | null },
  ) {
    return this.guildsService.createInvite(guildId, user.sub, body);
  }

  @Post(':guildId/join')
  joinDiscoverable(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.guildsService.joinDiscoverable(guildId, user.sub);
  }

  @Post(':guildId/leave')
  leave(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.guildsService.leaveGuild(guildId, user.sub);
  }

  @Post(':guildId/members/:userId/kick')
  kick(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.guildsService.kickMember(guildId, user.sub, userId);
  }

  @Post(':guildId/members/:userId/ban')
  ban(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { reason?: string },
  ) {
    return this.guildsService.banMember(guildId, user.sub, userId, body?.reason);
  }

  @Delete(':guildId/bans/:userId')
  unban(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.guildsService.unbanMember(guildId, user.sub, userId);
  }

  @Get(':guildId/bans')
  listBans(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.guildsService.listBans(guildId, user.sub);
  }

  @Post(':guildId/members/:userId/timeout')
  timeout(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { minutes?: number },
  ) {
    return this.guildsService.timeoutMember(
      guildId,
      user.sub,
      userId,
      body?.minutes ?? 10,
    );
  }

  @Get(':guildId/audit-logs')
  auditLogs(@Param('guildId') guildId: string, @CurrentUser() user: JwtPayloadUser) {
    return this.guildsService.listAuditLogs(guildId, user.sub);
  }

  @Get(':guildId/categories')
  listCategories(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.guildsService.listCategories(guildId, user.sub);
  }

  @Post(':guildId/categories')
  createCategory(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { name: string },
  ) {
    return this.guildsService.createCategory(guildId, user.sub, body?.name ?? '');
  }

  @Patch(':guildId/categories/:categoryId')
  updateCategory(
    @Param('guildId') guildId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body() body: { name?: string; position?: number },
  ) {
    return this.guildsService.updateCategory(guildId, categoryId, user.sub, body ?? {});
  }

  @Delete(':guildId/categories/:categoryId')
  async deleteCategory(
    @Param('guildId') guildId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    await this.guildsService.deleteCategory(guildId, categoryId, user.sub);
    return { ok: true };
  }

  @Get(':guildId/slash-commands')
  listSlashCommands(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    return this.guildsService.listSlashCommands(guildId, user.sub);
  }

  @Post(':guildId/slash-commands')
  registerSlashCommand(
    @Param('guildId') guildId: string,
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      name: string;
      description: string;
      usage?: string;
      aliases?: string[];
      botName?: string;
      responseTemplate?: string;
    },
  ) {
    return this.guildsService.registerSlashCommand(guildId, user.sub, body ?? {});
  }

  @Delete(':guildId/slash-commands/:commandId')
  async deleteSlashCommand(
    @Param('guildId') guildId: string,
    @Param('commandId') commandId: string,
    @CurrentUser() user: JwtPayloadUser,
  ) {
    await this.guildsService.deleteSlashCommand(guildId, commandId, user.sub);
    return { ok: true };
  }
}

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly guildsService: GuildsService) {}

  @Post(':code/join')
  join(@Param('code') code: string, @CurrentUser() user: JwtPayloadUser) {
    return this.guildsService.joinByInvite(code, user.sub);
  }
}
