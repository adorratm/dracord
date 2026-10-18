import {
  Controller,
  Delete,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  CurrentUser,
  type JwtPayloadUser,
} from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { SpotifyService } from './spotify.service';

@Controller()
export class SpotifyController {
  constructor(
    private readonly spotify: SpotifyService,
    private readonly config: ConfigService,
  ) {}

  @Get('oauth/spotify/status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: JwtPayloadUser) {
    return this.spotify.connectionStatus(user.sub);
  }

  @Get('oauth/spotify/start')
  @UseGuards(JwtAuthGuard)
  start(@CurrentUser() user: JwtPayloadUser) {
    const url = this.spotify.getAuthorizeUrl(`u:${user.sub}`);
    return { url, configured: this.spotify.isConfigured() };
  }

  @Delete('oauth/spotify')
  @UseGuards(JwtAuthGuard)
  disconnect(@CurrentUser() user: JwtPayloadUser) {
    return this.spotify.disconnect(user.sub);
  }

  /** Spotify redirect — state = u:{userId} */
  @Get('oauth/spotify/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const web =
      this.config.get<string>('WEB_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:3000';
    if (error || !code || !state?.startsWith('u:')) {
      return res.redirect(`${web}/settings/connections?spotify=error`);
    }
    const userId = state.slice(2);
    try {
      await this.spotify.exchangeCode(code, userId);
      return res.redirect(`${web}/settings/connections?spotify=ok`);
    } catch {
      return res.redirect(`${web}/settings/connections?spotify=error`);
    }
  }
}
