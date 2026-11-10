import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Session } from '@/database/entities/session.entity';

/**
 * E2 — erişim belirtecindeki `sid` hâlâ geçerli mi (oturum kapatıldıysa istek reddedilir).
 * 30 sn olumlu önbellek; kapatma bu örnekte anında, diğer örneklerde ≤30 sn.
 * Kullanım bilgisi (son kullanım, cihaz) dakikada en fazla bir kez yazılır.
 */
@Injectable()
export class SessionStatusService {
  private readonly log = new Logger(SessionStatusService.name);
  private readonly ok = new Map<string, number>();
  private readonly revoked = new Set<string>();
  private readonly touched = new Map<string, number>();

  constructor(private readonly em: EntityManager) {}

  async isActive(sid: string, userId: string): Promise<boolean> {
    if (this.revoked.has(sid)) return false;
    const at = this.ok.get(sid);
    if (at && Date.now() - at < 30_000) return true;
    const row = await this.em.findOne(Session, { where: { id: sid, userId }, select: { id: true, expiresAt: true } });
    if (!row || row.expiresAt < new Date()) {
      this.ok.delete(sid);
      return false;
    }
    this.ok.set(sid, Date.now());
    if (this.ok.size > 50_000) this.ok.clear();
    return true;
  }

  invalidate(sid: string) {
    this.ok.delete(sid);
    this.revoked.add(sid);
    if (this.revoked.size > 50_000) this.revoked.clear();
  }

  /** Son kullanım + cihaz bilgisi (fire-and-forget, dakikada bir) */
  touch(sid: string, meta: { userAgent?: string | null; ip?: string | null; platform?: string | null }) {
    const last = this.touched.get(sid) ?? 0;
    if (Date.now() - last < 60_000) return;
    this.touched.set(sid, Date.now());
    if (this.touched.size > 50_000) this.touched.clear();
    const patch: { lastUsedAt: Date; userAgent?: string; ip?: string; platform?: string } = { lastUsedAt: new Date() };
    if (meta.userAgent) patch.userAgent = meta.userAgent.slice(0, 300);
    if (meta.ip) patch.ip = meta.ip.slice(0, 64);
    if (meta.platform && /^(web|desktop|mobile)$/.test(meta.platform)) patch.platform = meta.platform;
    void this.em.update(Session, { id: sid }, patch).catch((e) => this.log.debug(`touch failed: ${e instanceof Error ? e.message : e}`));
  }
}
