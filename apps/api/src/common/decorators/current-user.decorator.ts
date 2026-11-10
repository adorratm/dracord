import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface JwtPayloadUser {
  sub: string;
  email: string;
  username: string;
  /** E2 — oturum kimliği (eski belirteçlerde yok) */
  sid?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayloadUser | undefined => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: JwtPayloadUser }>();
    return request.user;
  },
);
