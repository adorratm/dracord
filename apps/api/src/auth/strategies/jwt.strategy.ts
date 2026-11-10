import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayloadUser } from '@/common/decorators/current-user.decorator';
import { SessionStatusService } from '../session-status.service';

interface AccessTokenPayload {
  sub: string;
  email: string;
  username: string;
  /** E2 — oturum kimliği; yoksa (eski belirteç) süresi dolana dek geçerli */
  sid?: string;
}

function clientIp(req: Request): string | null {
  const xf = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xf) ? xf[0] : xf)?.split(',')[0]?.trim();
  return first || req.ip || null;
}

/** Electron → desktop, RN (okhttp / CFNetwork / Expo) → mobile, diğerleri → web */
export function platformFromUa(ua: string | null): 'web' | 'desktop' | 'mobile' | null {
  if (!ua) return null;
  if (/Electron\//.test(ua)) return 'desktop';
  if (/okhttp|CFNetwork|Expo|Dracord\/\d/i.test(ua)) return 'mobile';
  return 'web';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly sessions: SessionStatusService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: AccessTokenPayload): Promise<JwtPayloadUser> {
    if (payload.sid) {
      if (!(await this.sessions.isActive(payload.sid, payload.sub))) {
        throw new UnauthorizedException('Oturum kapatıldı');
      }
      const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;
      this.sessions.touch(payload.sid, { userAgent: ua, ip: clientIp(req), platform: platformFromUa(ua) });
    }
    return {
      sub: payload.sub,
      email: payload.email,
      username: payload.username,
      sid: payload.sid,
    };
  }
}
