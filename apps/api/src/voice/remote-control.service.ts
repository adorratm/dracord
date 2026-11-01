import { Injectable } from '@nestjs/common';
import type {
  RemoteControlStatePayload,
  RemoteControlStatus,
} from '@dracord/types';

type Session = {
  guildId: string;
  channelId: string;
  sharerId: string;
  status: RemoteControlStatus;
  controllerId: string | null;
  controllerName: string | null;
  sharerName: string | null;
  updatedAt: number;
};

/**
 * Ekran paylaşımı uzak kontrol — kanal+paylaşan başına tek controller.
 * Bellek içi (Redis adapter ile socket zaten fan-out; session tek instance’ta da yeterli MVP).
 */
@Injectable()
export class RemoteControlService {
  private readonly sessions = new Map<string, Session>();

  private key(channelId: string, sharerId: string) {
    return `${channelId}:${sharerId}`;
  }

  get(channelId: string, sharerId: string): Session | null {
    return this.sessions.get(this.key(channelId, sharerId)) ?? null;
  }

  toPayload(s: Session, reason?: string | null): RemoteControlStatePayload {
    return {
      guildId: s.guildId,
      channelId: s.channelId,
      sharerId: s.sharerId,
      status: s.status,
      controllerId: s.controllerId,
      controllerName: s.controllerName,
      sharerName: s.sharerName,
      reason: reason ?? null,
    };
  }

  request(input: {
    guildId: string;
    channelId: string;
    sharerId: string;
    controllerId: string;
    controllerName: string;
    sharerName?: string | null;
  }): { ok: true; session: Session } | { ok: false; error: string; session?: Session } {
    if (input.sharerId === input.controllerId) {
      return { ok: false, error: 'own_share' };
    }
    const k = this.key(input.channelId, input.sharerId);
    const existing = this.sessions.get(k);
    if (existing?.status === 'active') {
      return { ok: false, error: 'busy', session: existing };
    }
    if (
      existing?.status === 'pending' &&
      existing.controllerId &&
      existing.controllerId !== input.controllerId
    ) {
      return { ok: false, error: 'pending_other', session: existing };
    }
    const session: Session = {
      guildId: input.guildId,
      channelId: input.channelId,
      sharerId: input.sharerId,
      status: 'pending',
      controllerId: input.controllerId,
      controllerName: input.controllerName,
      sharerName: input.sharerName ?? existing?.sharerName ?? null,
      updatedAt: Date.now(),
    };
    this.sessions.set(k, session);
    return { ok: true, session };
  }

  respond(input: {
    channelId: string;
    sharerId: string;
    controllerId: string;
    accept: boolean;
    actorId: string;
  }): { ok: true; session: Session } | { ok: false; error: string; session?: Session } {
    const session = this.get(input.channelId, input.sharerId);
    if (!session || session.status !== 'pending') {
      return { ok: false, error: 'no_pending', session: session ?? undefined };
    }
    if (input.actorId !== input.sharerId) {
      return { ok: false, error: 'not_sharer', session };
    }
    if (session.controllerId !== input.controllerId) {
      return { ok: false, error: 'controller_mismatch', session };
    }
    if (!input.accept) {
      this.sessions.delete(this.key(input.channelId, input.sharerId));
      return {
        ok: true,
        session: { ...session, status: 'idle', controllerId: null, updatedAt: Date.now() },
      };
    }
    session.status = 'active';
    session.updatedAt = Date.now();
    this.sessions.set(this.key(input.channelId, input.sharerId), session);
    return { ok: true, session };
  }

  revoke(input: {
    channelId: string;
    sharerId: string;
    actorId: string;
  }): { ok: true; session: Session } | { ok: false; error: string; session?: Session } {
    const session = this.get(input.channelId, input.sharerId);
    if (!session || session.status === 'idle') {
      return { ok: false, error: 'no_session' };
    }
    const allowed =
      input.actorId === session.sharerId ||
      input.actorId === session.controllerId;
    if (!allowed) {
      return { ok: false, error: 'forbidden', session };
    }
    this.sessions.delete(this.key(input.channelId, input.sharerId));
    return {
      ok: true,
      session: {
        ...session,
        status: 'idle',
        controllerId: null,
        controllerName: null,
        updatedAt: Date.now(),
      },
    };
  }

  /** Paylaşım bitince / kullanıcı çıkınca temizle */
  clearForSharer(channelId: string, sharerId: string): Session | null {
    const s = this.get(channelId, sharerId);
    if (!s) return null;
    this.sessions.delete(this.key(channelId, sharerId));
    return {
      ...s,
      status: 'idle',
      controllerId: null,
      controllerName: null,
      updatedAt: Date.now(),
    };
  }

  clearControllerEverywhere(userId: string): Session[] {
    const cleared: Session[] = [];
    for (const [k, s] of [...this.sessions.entries()]) {
      if (s.controllerId === userId || s.sharerId === userId) {
        this.sessions.delete(k);
        cleared.push({
          ...s,
          status: 'idle',
          controllerId: null,
          controllerName: null,
          updatedAt: Date.now(),
        });
      }
    }
    return cleared;
  }

  canInject(input: {
    channelId: string;
    sharerId: string;
    controllerId: string;
  }): boolean {
    const s = this.get(input.channelId, input.sharerId);
    return Boolean(
      s &&
        s.status === 'active' &&
        s.controllerId === input.controllerId &&
        s.sharerId === input.sharerId,
    );
  }
}
