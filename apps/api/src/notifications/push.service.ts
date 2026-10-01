import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import * as webpush from 'web-push';
import type { NotificationDto } from '@dracord/types';
import { PushSubscription } from '@/database/entities/push-subscription.entity';

@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);
  private readonly enabled: boolean;
  private readonly publicKey: string | null;

  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY')?.trim() || '';
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY')?.trim() || '';
    const subject =
      this.config.get<string>('VAPID_SUBJECT')?.trim() || 'mailto:admin@dracord.local';
    this.enabled = Boolean(publicKey && privateKey);
    this.publicKey = publicKey || null;
    if (this.enabled) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } else {
      this.log.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY yok — web push kapalı');
    }
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async upsertSubscription(
    userId: string,
    data: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string | null;
    },
  ): Promise<{ ok: true }> {
    const endpoint = data.endpoint?.trim();
    if (!endpoint || !data.keys?.p256dh || !data.keys?.auth) {
      return { ok: true };
    }
    let row = await this.em.findOne(PushSubscription, { where: { endpoint } });
    if (!row) {
      row = this.em.create(PushSubscription, {
        userId,
        endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent ?? null,
      });
    } else {
      row.userId = userId;
      row.p256dh = data.keys.p256dh;
      row.auth = data.keys.auth;
      row.userAgent = data.userAgent ?? row.userAgent;
    }
    await this.em.save(PushSubscription, row);
    return { ok: true };
  }

  async removeSubscription(userId: string, endpoint: string): Promise<{ ok: true }> {
    const row = await this.em.findOne(PushSubscription, {
      where: { userId, endpoint },
    });
    if (row) await this.em.remove(PushSubscription, row);
    return { ok: true };
  }

  async sendNotificationDtos(dtos: NotificationDto[]): Promise<void> {
    if (!this.enabled || !dtos.length) return;
    const byUser = new Map<string, NotificationDto[]>();
    for (const n of dtos) {
      const list = byUser.get(n.userId) ?? [];
      list.push(n);
      byUser.set(n.userId, list);
    }
    await Promise.all(
      [...byUser.entries()].map(([userId, notes]) => this.pushToUser(userId, notes)),
    );
  }

  private async pushToUser(userId: string, notes: NotificationDto[]): Promise<void> {
    const subs = await this.em.find(PushSubscription, { where: { userId } });
    if (!subs.length) return;
    const primary = notes[0];
    const payload = JSON.stringify({
      title: primary.title,
      body: primary.body,
      link: primary.link ?? '/notifications',
      tag: primary.id,
    });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          const status =
            err && typeof err === 'object' && 'statusCode' in err
              ? Number((err as { statusCode: number }).statusCode)
              : 0;
          if (status === 404 || status === 410) {
            await this.em.remove(PushSubscription, sub).catch(() => undefined);
          } else {
            this.log.warn(`Push failed for ${sub.id}: ${String(err)}`);
          }
        }
      }),
    );
  }
}
