import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PlatformAuditLog } from '@/database/entities/platform-audit-log.entity';

@Injectable()
export class PlatformAuditService {
  private readonly log = new Logger(PlatformAuditService.name);

  constructor(private readonly em: EntityManager) {}

  async record(opts: {
    action: string;
    applicationId?: string | null;
    actorUserId?: string | null;
    targetId?: string | null;
    meta?: Record<string, unknown> | null;
  }) {
    try {
      const row = this.em.create(PlatformAuditLog, {
        action: opts.action.slice(0, 128),
        applicationId: opts.applicationId ?? null,
        actorUserId: opts.actorUserId ?? null,
        targetId: opts.targetId ?? null,
        meta: opts.meta ?? null,
      });
      await this.em.save(PlatformAuditLog, row);
      return row;
    } catch (err) {
      this.log.warn(
        `platform audit fail: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async list(opts?: { applicationId?: string; limit?: number }) {
    const take = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
    if (opts?.applicationId) {
      return this.em.find(PlatformAuditLog, {
        where: { applicationId: opts.applicationId },
        order: { createdAt: 'DESC' },
        take,
      });
    }
    return this.em.find(PlatformAuditLog, {
      order: { createdAt: 'DESC' },
      take,
    });
  }
}
