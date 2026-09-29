import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface RefreshPayload {
  sub: string;
  sessionId: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const body = req.body as { refreshToken?: string } | undefined;
          const cookie = req.cookies as { refreshToken?: string } | undefined;
          const combined = body?.refreshToken ?? cookie?.refreshToken ?? null;
          if (!combined) {
            return null;
          }
          const parts = combined.split('.');
          if (parts.length < 4) {
            return combined;
          }
          return parts.slice(0, -1).join('.');
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(_req: Request, payload: RefreshPayload): RefreshPayload {
    return payload;
  }
}
