import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
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
import {
  isAdminEmail,
  isAdminOAuthIntent,
  isDesktopOAuthIntent,
} from '@/auth/admin-emails';

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
    return {
      ...toPublicUser(row, { viewerId: user.sub }),
      isPlatformAdmin: isAdminEmail(this.config, row.email),
    };
  }

  /** Admin paneli oturum doğrulama — yalnızca ADMIN_EMAILS allowlist */
  @Get('admin/me')
  @UseGuards(JwtAuthGuard)
  async adminMe(@CurrentUser() user: { sub: string }) {
    const row = await this.authService.assertAdminUser(user.sub);
    return {
      ...toPublicUser(row, { viewerId: user.sub }),
      isPlatformAdmin: true,
    };
  }

  @Post('dev-login')
  async devLogin(
    @Body() dto: DevLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.devLogin(dto);
    if ('requires2fa' in result && result.requires2fa) {
      return {
        requires2fa: true,
        challengeToken: result.challengeToken,
      };
    }
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toPublicUser(result.user, { viewerId: result.user.id }),
    };
  }

  @Post('apple')
  async apple(
    @Body() dto: AppleAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.appleLogin(dto);
    if ('requires2fa' in result && result.requires2fa) {
      return {
        requires2fa: true,
        challengeToken: result.challengeToken,
      };
    }
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toPublicUser(result.user, { viewerId: result.user.id }),
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
    @Req() req: Request & { user: GoogleProfile },
    @Res() res: Response,
  ) {
    const adminIntent = isAdminOAuthIntent(req.query?.state);
    const desktopIntent = isDesktopOAuthIntent(req.query?.state);
    const appBase = adminIntent
      ? (this.config.get<string>('ADMIN_URL') ?? 'http://localhost:3001')
      : (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000');
    try {
      const result = await this.authService.googleCallback(req.user, {
        admin: adminIntent,
      });
      if (desktopIntent) {
        const deep = new URL('dracord://oauth');
        if ('requires2fa' in result && result.requires2fa) {
          deep.searchParams.set('challengeToken', result.challengeToken);
          res.redirect(deep.toString());
          return;
        }
        this.setRefreshCookie(res, result.refreshToken);
        deep.searchParams.set('accessToken', result.accessToken);
        deep.searchParams.set('refreshToken', result.refreshToken);
        res.redirect(deep.toString());
        return;
      }
      const redirectUrl = new URL('/auth/callback', appBase);
      if ('requires2fa' in result && result.requires2fa) {
        redirectUrl.searchParams.set('challengeToken', result.challengeToken);
        res.redirect(redirectUrl.toString());
        return;
      }
      this.setRefreshCookie(res, result.refreshToken);
      redirectUrl.searchParams.set('accessToken', result.accessToken);
      redirectUrl.searchParams.set('refreshToken', result.refreshToken);
      res.redirect(redirectUrl.toString());
    } catch (err) {
      if (desktopIntent) {
        const deep = new URL('dracord://oauth');
        deep.searchParams.set('error', adminIntent ? 'admin_denied' : 'google_oauth');
        deep.searchParams.set(
          'reason',
          err instanceof Error ? err.message.slice(0, 160) : 'callback_failed',
        );
        res.redirect(deep.toString());
        return;
      }
      const url = new URL('/login', appBase);
      url.searchParams.set('error', adminIntent ? 'admin_denied' : 'google_oauth');
      url.searchParams.set(
        'reason',
        err instanceof Error ? err.message.slice(0, 160) : 'callback_failed',
      );
      res.redirect(url.toString());
    }
  }

  @Post('2fa/verify')
  async verify2fa(
    @Body() body: { challengeToken: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verify2faChallenge(
      body?.challengeToken ?? '',
      body?.code ?? '',
    );
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: toPublicUser(result.user, { viewerId: result.user.id }),
    };
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  twoFactorStatus(@CurrentUser() user: { sub: string }) {
    return this.authService.get2faStatus(user.sub);
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  begin2fa(@CurrentUser() user: { sub: string }) {
    return this.authService.begin2faSetup(user.sub);
  }

  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard)
  confirm2fa(
    @CurrentUser() user: { sub: string },
    @Body() body: { code: string },
  ) {
    return this.authService.confirm2faSetup(user.sub, body?.code ?? '');
  }

  @Post('2fa/recovery/regenerate')
  @UseGuards(JwtAuthGuard)
  regenerateRecovery(
    @CurrentUser() user: { sub: string },
    @Body() body: { code: string },
  ) {
    return this.authService.regenerateRecoveryCodes(user.sub, body?.code ?? '');
  }

  @Delete('2fa')
  @UseGuards(JwtAuthGuard)
  disable2fa(
    @CurrentUser() user: { sub: string },
    @Body() body: { code?: string; password?: string },
  ) {
    return this.authService.disable2fa(user.sub, {
      code: body?.code,
      password: body?.password,
    });
  }

  @Delete('2fa/setup')
  @UseGuards(JwtAuthGuard)
  cancel2faSetup(@CurrentUser() user: { sub: string }) {
    return this.authService.cancel2faSetup(user.sub);
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
