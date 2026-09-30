import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { toPublicUser } from '@/common/user.mapper';
import { AuthService } from './auth.service';
import { AppleAuthDto } from '@/auth/dto/apple-auth.dto';
import { DevLoginDto } from '@/auth/dto/dev-login.dto';
import { RefreshTokenDto } from '@/auth/dto/refresh-token.dto';
import type { GoogleProfile } from '@/auth/strategies/google.strategy';
import { GoogleAuthGuard } from '@/auth/guards/google-auth.guard';
import { GoogleOAuthRedirectFilter } from '@/auth/filters/google-oauth-redirect.filter';
import { JwtRefreshAuthGuard } from '@/auth/guards/jwt-refresh-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { sub: string }) {
    const row = await this.authService.getUserById(user.sub);
    return toPublicUser(row);
  }

  @Post('dev-login')
  async devLogin(
    @Body() dto: DevLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.devLogin(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toPublicUser(result.user),
    };
  }

  @Post('apple')
  async apple(
    @Body() dto: AppleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.appleLogin(dto);
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toPublicUser(result.user),
    };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @UseFilters(GoogleOAuthRedirectFilter)
  googleAuth() {
    return { message: 'Redirecting to Google OAuth' };
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @UseFilters(GoogleOAuthRedirectFilter)
  async googleCallback(
    @Req() req: { user: GoogleProfile },
    @Res() res: Response,
  ) {
    const frontend =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    try {
      const result = await this.authService.googleCallback(req.user);
      this.setRefreshCookie(res, result.refreshToken);
      const redirectUrl = new URL('/auth/callback', frontend);
      redirectUrl.searchParams.set('accessToken', result.accessToken);
      redirectUrl.searchParams.set('refreshToken', result.refreshToken);
      res.redirect(redirectUrl.toString());
    } catch (err) {
      const url = new URL('/login', frontend);
      url.searchParams.set('error', 'google_oauth');
      url.searchParams.set(
        'reason',
        err instanceof Error ? err.message.slice(0, 160) : 'callback_failed',
      );
      res.redirect(url.toString());
    }
  }

  @Post('refresh')
  @UseGuards(JwtRefreshAuthGuard)
  async refresh(
    @Req() req: { user: { sub: string; sessionId: string }; body: RefreshTokenDto },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenFromBody = req.body.refreshToken;
    const tokenFromCookie = (req as unknown as { cookies?: { refreshToken?: string } })
      .cookies?.refreshToken;
    const combined = tokenFromBody ?? tokenFromCookie;
    if (!combined) {
      throw new UnauthorizedException('Refresh token required');
    }
    const { signed, raw } = this.authService.parseRefreshToken(combined);
    void signed;
    const tokens = await this.authService.refreshTokens(req.user.sub, req.user.sessionId, raw);
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
