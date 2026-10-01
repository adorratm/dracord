import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { isAdminOAuthIntent } from '@/auth/admin-emails';

/**
 * Google OAuth failures (redirect_uri_mismatch, missing email, etc.) must not
 * surface as opaque 500 HTML — send the user back to the correct app login page.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    // Callback already carries Google's state — don't overwrite.
    if (req.query?.code) {
      return {};
    }
    const intent = String(req.query?.intent ?? 'web').toLowerCase();
    if (intent === 'admin') return { state: 'admin' };
    if (intent === 'desktop') return { state: 'desktop' };
    return { state: 'web' };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const res = context.switchToHttp().getResponse<Response>();
    const req = context.switchToHttp().getRequest<Request>();
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (err) {
      this.redirectToLogin(res, req, err);
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

  private redirectToLogin(res: Response, req: Request, err: unknown) {
    if (res.headersSent) return;
    const admin = isAdminOAuthIntent(req.query?.state ?? req.query?.intent);
    const appBase = admin
      ? (this.config.get<string>('ADMIN_URL') ?? 'http://localhost:3001')
      : (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000');
    const url = new URL('/login', appBase);
    url.searchParams.set('error', admin ? 'admin_denied' : 'google_oauth');
    const msg = err instanceof Error ? err.message : 'failed';
    url.searchParams.set('reason', msg.slice(0, 160));
    res.redirect(url.toString());
  }
}
