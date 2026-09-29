import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import type { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    const token =
      (client.handshake.auth as { token?: string }).token ??
      (client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '');

    if (!token) {
      throw new WsException('Unauthorized');
    }

    try {
      const payload = this.jwt.verify<{ sub: string; email: string; username: string }>(
        token,
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') },
      );
      client.data.user = payload;
      return true;
    } catch {
      throw new WsException('Unauthorized');
    }
  }
}
