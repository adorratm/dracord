import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

/**
 * Google OAuth failures (redirect_uri_mismatch, missing email, etc.) must not
 * surface as opaque 500 HTML — send the user back to the frontend login page.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const res = context.switchToHttp().getResponse<Response>();
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err) {
      this.redirectToLogin(res, err);
      // Prevent Nest from overwriting the redirect with ForbiddenException.
      throw new UnauthorizedException(
        err instanceof Error ? err.message : 'Google auth failed',
      );
    }
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Google auth failed');
    }
    return user;
  }

  private redirectToLogin(res: Response, err: unknown) {
    if (res.headersSent) return;
    const frontend =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const url = new URL('/login', frontend);
    url.searchParams.set('error', 'google_oauth');
    const msg = err instanceof Error ? err.message : 'failed';
    url.searchParams.set('reason', msg.slice(0, 160));
    res.redirect(url.toString());
  }
}
