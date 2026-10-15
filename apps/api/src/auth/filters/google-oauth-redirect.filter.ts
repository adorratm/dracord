import {
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { isAdminOAuthIntent, isDesktopOAuthIntent } from '@/auth/admin-emails';

/** After GoogleAuthGuard already redirected, swallow the follow-up 401. */
@Catch(UnauthorizedException)
export class GoogleOAuthRedirectFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService) {}

  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (req.url?.includes('/auth/google') && !res.headersSent) {
      const stateOrIntent = req.query?.state ?? req.query?.intent;
      const admin = isAdminOAuthIntent(stateOrIntent);
      const desktop = isDesktopOAuthIntent(stateOrIntent);
      const appBase = admin
        ? (this.config.get<string>('ADMIN_URL') ?? 'http://localhost:3001')
        : (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000');
      const url = new URL(desktop ? '/auth/desktop-done' : '/login', appBase);
      url.searchParams.set('error', admin ? 'admin_denied' : 'google_oauth');
      const msg =
        typeof exception.message === 'string' ? exception.message : 'failed';
      url.searchParams.set('reason', msg.slice(0, 160));
      res.redirect(url.toString());
      return;
    }

    if (res.headersSent) {
      return;
    }

    const status = exception.getStatus();
    res.status(status).json(exception.getResponse());
  }
}
