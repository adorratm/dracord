import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformAdminService as PlatformAdminAuth } from '@/auth/platform-admin.service';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly platformAdmin: PlatformAdminAuth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { sub?: string } }>();
    const userId = req.user?.sub;
    if (!userId) throw new UnauthorizedException();
    await this.platformAdmin.assertIsPlatformAdmin(userId);
    return true;
  }
}
