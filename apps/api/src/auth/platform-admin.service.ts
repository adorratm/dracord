import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { isAdminEmail } from '@/auth/admin-emails';
import { User } from '@/database/entities/user.entity';

/** Platform admin (ADMIN_EMAILS) — tüm sunucularda God-mode. */
@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
  ) {}

  async isPlatformAdmin(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    const user = await this.em.findOne(User, {
      where: { id: userId },
      select: { id: true, email: true },
    });
    return isAdminEmail(this.config, user?.email);
  }

  async assertIsPlatformAdmin(userId: string): Promise<void> {
    if (!(await this.isPlatformAdmin(userId))) {
      throw new UnauthorizedException('Platform admin yetkisi gerekli');
    }
  }

  /** Kick/ban/timeout/rol hedefi platform admin olamaz. */
  async assertNotPlatformAdminTarget(userId: string): Promise<void> {
    if (await this.isPlatformAdmin(userId)) {
      throw new BadRequestException(
        'Platform admin atılamaz, yasaklanamaz, timeout verilemez veya rolleri değiştirilemez',
      );
    }
  }
}
