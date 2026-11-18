import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { MediaGalleryKind } from '@dracord/types';
import { MediaGalleryService } from './media-gallery.service';
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

/** G1 — /channels/:channelId/media?kind=image|video|file&before= */
@Controller('channels/:channelId/media')
@UseGuards(JwtAuthGuard)
export class MediaGalleryController {
  constructor(private readonly gallery: MediaGalleryService) {}

  @Get()
  list(
    @Param('channelId') channelId: string,
    @Req() req: { user: { sub: string } },
    @Query('kind') kind?: string,
    @Query('before') before?: string,
  ) {
    const k: MediaGalleryKind = kind === 'video' || kind === 'file' ? kind : 'image';
    return this.gallery.list(channelId, req.user.sub, k, before);
  }
}
