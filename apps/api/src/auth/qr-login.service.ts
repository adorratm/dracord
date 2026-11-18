import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import Redis from 'ioredis';
import { EntityManager } from 'typeorm';
import { User } from '@/database/entities/user.entity';

/**
 * E4 — sign in on a computer by scanning a QR code with the phone where you are already
 * signed in. The QR holds only the ticket id; the waiting computer proves itself with a
 * separate poll token that never leaves it, so a photo of the QR cannot steal the login.
 */
export type QrTicketStatus = 'pending' | 'scanned' | 'approved' | 'rejected';

interface QrTicket {
  status: QrTicketStatus;
  pollHash: string;
  createdAt: number;
  expiresAt: number;
  requester: { platform: string | null; device: string | null; ip: string | null };
  userId?: string;
}

const TICKET_TTL_MS = 2 * 60_000;
const APPROVE_WINDOW_MS = 60_000;
const CREATE_LIMIT_PER_MIN = 12;
const KEY = (id: string) => `qrlogin:${id}`;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** "Windows · Chrome" from a user agent — only what the phone needs to recognise the computer */
export function describeDevice(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua)
      ? 'macOS'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad/i.test(ua)
          ? 'iOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : null;
  const app = /Dracord|Electron/i.test(ua)
    ? 'Dracord masaüstü'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\//.test(ua)
        ? 'Opera'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
  return [os, app].filter(Boolean).join(' · ') || null;
}

@Injectable()
export class QrLoginService implements OnModuleDestroy {
  private readonly log = new Logger(QrLoginService.name);
  private redis: Redis | null = null;
  private readonly mem = new Map<string, QrTicket>();
  private readonly createdBy = new Map<string, number[]>();

  constructor(
    config: ConfigService,
    private readonly em: EntityManager,
  ) {
    const url = config.get<string>('REDIS_URL')?.trim();
    if (url) {
      this.redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      void this.redis.connect().catch((err: Error) => this.log.warn(`Redis (QR giriş) bağlanamadı: ${err.message}`));
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis?.quit();
    } catch {
      this.redis?.disconnect();
    }
  }

  private get useRedis(): boolean {
    return this.redis?.status === 'ready';
  }

  private async load(id: string): Promise<QrTicket | null> {
    if (!/^[a-f0-9]{32}$/.test(id)) return null;
    let t: QrTicket | null = null;
    if (this.useRedis) {
      const raw = await this.redis!.get(KEY(id));
      t = raw ? (JSON.parse(raw) as QrTicket) : null;
    } else {
      t = this.mem.get(id) ?? null;
    }
    if (t && t.expiresAt < Date.now()) {
      await this.drop(id);
      return null;
    }
    return t;
  }

  private async store(id: string, t: QrTicket): Promise<void> {
    const ttl = Math.max(1000, t.expiresAt - Date.now());
    if (this.useRedis) {
      await this.redis!.set(KEY(id), JSON.stringify(t), 'PX', ttl);
      return;
    }
    this.mem.set(id, t);
    if (this.mem.size > 5000) {
      const now = Date.now();
      for (const [k, v] of this.mem) if (v.expiresAt < now) this.mem.delete(k);
    }
  }

  private async drop(id: string): Promise<void> {
    if (this.useRedis) await this.redis!.del(KEY(id));
    this.mem.delete(id);
  }

  /** the computer asks for a ticket (public; rate limited per IP) */
  async create(req: { ip: string | null; userAgent: string | null; platform: string | null }): Promise<{
    ticketId: string;
    pollToken: string;
    expiresAt: string;
  }> {
    const ipKey = req.ip ?? 'unknown';
    const now = Date.now();
    const recent = (this.createdBy.get(ipKey) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= CREATE_LIMIT_PER_MIN) {
      throw new HttpException('Çok fazla QR isteği — biraz bekle', HttpStatus.TOO_MANY_REQUESTS);
    }
    this.createdBy.set(ipKey, [...recent, now]);
    if (this.createdBy.size > 20_000) this.createdBy.clear();
    const ticketId = randomBytes(16).toString('hex');
    const pollToken = randomBytes(32).toString('base64url');
    const platform = req.platform && /^[a-z-]{2,16}$/.test(req.platform) ? req.platform : null;
    await this.store(ticketId, {
      status: 'pending',
      pollHash: sha(pollToken),
      createdAt: now,
      expiresAt: now + TICKET_TTL_MS,
      requester: { platform, device: describeDevice(req.userAgent), ip: req.ip },
    });
    return { ticketId, pollToken, expiresAt: new Date(now + TICKET_TTL_MS).toISOString() };
  }

  /**
   * the computer waits: pending / scanned (with who scanned) / rejected / expired, or,
   * once approved, the user id to sign in — handed out exactly once.
   */
  async poll(
    ticketId: string,
    pollToken: string,
  ): Promise<
    | { status: 'pending' | 'rejected' | 'expired' }
    | { status: 'scanned'; user: { displayName: string; avatarUrl: string | null } }
    | { status: 'approved'; userId: string }
  > {
    const t = await this.load(ticketId);
    if (!t) return { status: 'expired' };
    const a = Buffer.from(sha(pollToken ?? ''));
    const b = Buffer.from(t.pollHash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException('Geçersiz QR oturumu');
    if (t.status === 'approved' && t.userId) {
      await this.drop(ticketId);
      return { status: 'approved', userId: t.userId };
    }
    if (t.status === 'rejected') {
      await this.drop(ticketId);
      return { status: 'rejected' };
    }
    if (t.status === 'scanned' && t.userId) {
      const u = await this.em.findOne(User, { where: { id: t.userId }, select: { id: true, displayName: true, avatarUrl: true } });
      return { status: 'scanned', user: { displayName: u?.displayName ?? '', avatarUrl: u?.avatarUrl ?? null } };
    }
    return { status: 'pending' };
  }

  /** the phone opened the QR: show which computer is asking (and tell the computer) */
  async scan(ticketId: string, userId: string): Promise<{
    device: string | null;
    platform: string | null;
    ip: string | null;
    createdAt: string;
    expiresAt: string;
  }> {
    const t = await this.load(ticketId);
    if (!t) throw new GoneException('QR kodunun süresi doldu — bilgisayarda yenisini aç');
    if (t.status === 'approved' || t.status === 'rejected') throw new GoneException('Bu QR kodu kullanıldı');
    if (t.userId && t.userId !== userId) throw new ForbiddenException('Bu QR kodu başka bir hesapla okutuldu');
    const next: QrTicket = {
      ...t,
      status: 'scanned',
      userId,
      expiresAt: Math.max(t.expiresAt, Date.now() + APPROVE_WINDOW_MS),
    };
    await this.store(ticketId, next);
    return {
      device: t.requester.device,
      platform: t.requester.platform,
      ip: t.requester.ip,
      createdAt: new Date(t.createdAt).toISOString(),
      expiresAt: new Date(next.expiresAt).toISOString(),
    };
  }

  async decide(ticketId: string, userId: string, approve: boolean): Promise<{ ok: true }> {
    const t = await this.load(ticketId);
    if (!t) throw new GoneException('QR kodunun süresi doldu');
    if (t.status !== 'scanned' || t.userId !== userId) {
      throw new BadRequestException('Önce QR kodunu bu hesapla okut');
    }
    const user = await this.em.findOne(User, { where: { id: userId }, select: { id: true, disabledAt: true } });
    if (!user) throw new NotFoundException('User not found');
    if (approve && user.disabledAt) throw new ForbiddenException('Hesap devre dışı');
    await this.store(ticketId, { ...t, status: approve ? 'approved' : 'rejected', expiresAt: Date.now() + APPROVE_WINDOW_MS });
    return { ok: true };
  }
}
