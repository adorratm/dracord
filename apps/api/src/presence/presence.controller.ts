import { Body, Controller, Delete, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { desktopGameImageUrl, type UserActivity } from '@dracord/types';
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
    const activity: UserActivity = {
      type: body.type ?? 'playing',
      name: String(body.name).slice(0, 128),
      details: body.details?.slice(0, 256) ?? null,
      source: body.source === 'desktop' ? 'desktop' : 'manual',
      imageUrl:
        body.imageUrl?.trim() ||
        (body.source === 'desktop' ? desktopGameImageUrl(desktopAppId) : null) ||
        null,
      url: body.url ?? null,
      desktopAppId,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
    return this.presenceService.putManualActivity(user.sub, activity);
  }

  @Delete('users/me/activity')
  clearActivity(@CurrentUser() user: JwtPayloadUser) {
    return this.presenceService.putManualActivity(user.sub, null);
  }
}
