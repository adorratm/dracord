import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { EntityManager } from 'typeorm';
import { PlatformApplication } from '@/database/entities/platform-application.entity';
import { isPlatformApiEnabled } from './platform-enabled';
import { PlatformRateLimitService } from './platform-rate-limit.service';

export type BotAuthContext = {
  applicationId: string;
  botUserId: string;
  ownerUserId: string;
  scopes: string[];
};

@Injectable()
export class BotAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly em: EntityManager,
    private readonly rateLimit: PlatformRateLimitService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!isPlatformApiEnabled(this.config)) {
      throw new ServiceUnavailableException(
        'Platform API kapalı (PLATFORM_API=true ile aç)',
      );
    }
    const req = ctx.switchToHttp().getRequest<{
      headers: { authorization?: string };
      bot?: BotAuthContext;
    }>();
    const raw = req.headers.authorization ?? '';
    const m = /^Bot\s+(\S+)/i.exec(raw);
    if (!m?.[1]) {
      throw new UnauthorizedException('Authorization: Bot <token> gerekli');
    }
    const token = m[1];
    const hash = createHash('sha256').update(token).digest('hex');
    const app = await this.em.findOne(PlatformApplication, {
      where: { botTokenHash: hash },
    });
    if (!app?.botUserId) {
      throw new UnauthorizedException('Geçersiz bot token');
    }
    const rl = await this.rateLimit.consume(`bot:${app.id}`);
    if (!rl.ok) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit — ${rl.retryAfterSec}s sonra tekrar dene`,
          retryAfter: rl.retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    req.bot = {
      applicationId: app.id,
      botUserId: app.botUserId,
      ownerUserId: app.ownerUserId,
      scopes: app.scopes ?? [],
    };
    return true;
  }
}
