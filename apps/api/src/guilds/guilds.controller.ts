import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  discover() {
    return this.guildsService.discover();
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
