import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  desktopGameImageUrl,
  desktopGameUrl,
  type UserActivity,
  type UserActivitySource,
} from '@dracord/types';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { UpdatePresenceDto } from '@/presence/dto/update-presence.dto';
import { PresenceService } from './presence.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PresenceController {
  constructor(private readonly presenceService: PresenceService) {}

  @Get('presence/me')
  me(@CurrentUser() user: JwtPayloadUser) {
    return this.presenceService.getStatus(user.sub);
  }

  @Patch('presence/me')
  update(@CurrentUser() user: JwtPayloadUser, @Body() dto: UpdatePresenceDto) {
    return this.presenceService.updateStatus(user.sub, dto.status, {
      customStatus: dto.customStatus,
      manual: true,
    });
  }

  /** Manuel / masaüstü aktivite (TTL’li) */
  @Put('users/me/activity')
  putActivity(
    @CurrentUser() user: JwtPayloadUser,
    @Body()
    body: {
      type?: UserActivity['type'];
      name?: string;
      details?: string | null;
      source?: UserActivity['source'];
      imageUrl?: string | null;
      url?: string | null;
      desktopAppId?: string | null;
      expiresInSec?: number;
      clear?: boolean;
    },
  ) {
    if (body.clear || !body.name) {
      return this.presenceService.putManualActivity(user.sub, null);
    }
    const expiresIn = Math.min(Math.max(body.expiresInSec ?? 90, 30), 600);
    const desktopAppId = body.desktopAppId ?? null;
    const isDesktop = body.source === 'desktop';
    const activity: UserActivity = {
      type: body.type ?? 'playing',
      name: String(body.name).slice(0, 128),
      details: body.details?.slice(0, 256) ?? null,
      source: isDesktop ? 'desktop' : 'manual',
      imageUrl:
        body.imageUrl?.trim() ||
        (isDesktop ? desktopGameImageUrl(desktopAppId) : null) ||
        null,
      url:
        body.url?.trim() ||
        (isDesktop ? desktopGameUrl(desktopAppId) : null) ||
        null,
      desktopAppId,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
    return this.presenceService.putManualActivity(user.sub, activity);
  }

  @Delete('users/me/activity')
  async clearActivity(
    @CurrentUser() user: JwtPayloadUser,
    @Query('source') source?: string,
  ) {
    const src = source as UserActivitySource | undefined;
    if (
      src === 'desktop' ||
      src === 'spotify' ||
      src === 'dracord' ||
      src === 'manual'
    ) {
      await this.presenceService.clearActivitySource(user.sub, src);
      return this.presenceService.getStatus(user.sub);
    }
    return this.presenceService.putManualActivity(user.sub, null);
  }
}
