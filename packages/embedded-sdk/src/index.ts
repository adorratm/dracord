import {
  EMBED_SOURCE,
  NATIVE_ORIGIN,
  PROTOCOL_VERSION,
  isHostMessage,
  type EmbedMessage,
  type EmbedParticipant,
  type EmbedSession,
  type HostMessage,
  type InitPayload,
} from './protocol';

export * from './protocol';

export const SDK_VERSION = '0.1.0';

/**
 * Varsayılan izinli Dracord origin'leri.
 * 'null' = desktop uygulaması (file://). Mesajlar ayrıca `event.source === window.parent` ile
 * doğrulanır. İstemci bağlamı yine de GÜVENİLMEZDİR: kimliği her zaman sunucuda token ile doğrula.
 */
export const DEFAULT_HOST_ORIGINS = [
  'https://dracord.com.tr',
  'https://www.dracord.com.tr',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'null',
];

export interface DracordEmbedOptions {
  /** Ek izinli host origin'leri (self-host Dracord vb.) */
  allowedHostOrigins?: string[];
  /** INIT bekleme süresi (ms) — varsayılan 15000 */
  timeoutMs?: number;
  /** Token süresi dolmadan önce otomatik yenile (ms) — varsayılan 60000 */
  refreshBeforeMs?: number;
}

type Listener<T> = (v: T) => void;

type RNWindow = Window & { ReactNativeWebView?: { postMessage(data: string): void } };

/**
 * Dracord oyun SDK'sı.
 *
 * ```ts
 * import { DracordEmbed } from '@dracord/embedded-sdk';
 * const dracord = new DracordEmbed();
 * const ctx = await dracord.ready();
 * // ctx.token'ı kendi sunucuna gönder → sunucu POST {apiBase}/v1/games/verify ile doğrular
 * ```
 */
export class DracordEmbed {
  private readonly opts: Required<DracordEmbedOptions>;
  private readonly allowed: Set<string>;
  private hostOrigin: string | null = null;
  private ctx: InitPayload | null = null;
  private readyPromise: Promise<InitPayload> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = {
    session: new Set<Listener<{ session: EmbedSession; participants: EmbedParticipant[] }>>(),
    token: new Set<Listener<{ token: string; expiresAt: string }>>(),
    visibility: new Set<Listener<boolean>>(),
    error: new Set<Listener<{ code: string; message: string }>>(),
  };
  private readonly onMessage = (ev: MessageEvent) => this.handle(ev);

  constructor(opts: DracordEmbedOptions = {}) {
    this.opts = {
      allowedHostOrigins: opts.allowedHostOrigins ?? [],
      timeoutMs: opts.timeoutMs ?? 15_000,
      refreshBeforeMs: opts.refreshBeforeMs ?? 60_000,
    };
    this.allowed = new Set([...DEFAULT_HOST_ORIGINS, ...this.opts.allowedHostOrigins]);
    if (typeof window !== 'undefined') window.addEventListener('message', this.onMessage);
  }

  /** Dracord içinde mi çalışıyor */
  static isEmbedded(): boolean {
    if (typeof window === 'undefined') return false;
    return window.parent !== window || Boolean((window as RNWindow).ReactNativeWebView);
  }

  /** Mevcut bağlam (ready sonrası) */
  get context(): InitPayload | null {
    return this.ctx;
  }

  /** Host'a READY gönder, INIT bekle */
  ready(): Promise<InitPayload> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise<InitPayload>((resolve, reject) => {
      if (!DracordEmbed.isEmbedded()) {
        reject(new Error('Dracord dışında çalışıyor (iframe/WebView değil)'));
        return;
      }
      const t = setTimeout(() => reject(new Error('Dracord yanıt vermedi (INIT zaman aşımı)')), this.opts.timeoutMs);
      this.pendingInit = (p) => {
        clearTimeout(t);
        resolve(p);
      };
      this.send({ source: EMBED_SOURCE, type: 'READY', payload: { protocol: PROTOCOL_VERSION, sdk: SDK_VERSION } });
    });
    return this.readyPromise;
  }

  private pendingInit: ((p: InitPayload) => void) | null = null;

  private send(msg: EmbedMessage) {
    if (typeof window === 'undefined') return;
    const rn = (window as RNWindow).ReactNativeWebView;
    if (rn) {
      rn.postMessage(JSON.stringify(msg));
      return;
    }
    // INIT'ten önce origin bilinmez: izinli listedeki her origin'e ayrı gönder (yalnız eşleşen alır)
    const targets = this.hostOrigin ? [this.hostOrigin] : [...this.allowed];
    for (const o of targets) {
      try {
        window.parent.postMessage(msg, o === 'null' ? '*' : o);
      } catch {
        /* geçersiz origin */
      }
    }
  }

  private handle(ev: MessageEvent) {
    const rn = Boolean((window as RNWindow).ReactNativeWebView);
    const originOk = rn ? ev.origin === NATIVE_ORIGIN || ev.origin === '' : this.allowed.has(ev.origin);
    if (!originOk) return;
    let data: unknown = ev.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    if (!isHostMessage(data)) return;
    if (!rn) {
      if (ev.source !== window.parent) return;
      if (!this.hostOrigin) this.hostOrigin = ev.origin;
      else if (ev.origin !== this.hostOrigin) return;
    }
    this.dispatch(data);
  }

  private dispatch(m: HostMessage) {
    switch (m.type) {
      case 'INIT':
        this.ctx = m.payload;
        this.scheduleRefresh(m.payload.expiresAt);
        this.pendingInit?.(m.payload);
        this.pendingInit = null;
        break;
      case 'SESSION_UPDATE':
        if (this.ctx) {
          this.ctx = { ...this.ctx, session: m.payload.session, participants: m.payload.participants };
        }
        this.listeners.session.forEach((f) => f(m.payload));
        break;
      case 'TOKEN':
        if (this.ctx) this.ctx = { ...this.ctx, token: m.payload.token, expiresAt: m.payload.expiresAt };
        this.scheduleRefresh(m.payload.expiresAt);
        this.listeners.token.forEach((f) => f(m.payload));
        break;
      case 'VISIBILITY':
        this.listeners.visibility.forEach((f) => f(m.payload.visible));
        break;
      case 'ERROR':
        this.listeners.error.forEach((f) => f(m.payload));
        break;
    }
  }

  private scheduleRefresh(expiresAt: string) {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const ms = new Date(expiresAt).getTime() - Date.now() - this.opts.refreshBeforeMs;
    this.refreshTimer = setTimeout(() => this.refreshToken(), Math.max(5_000, ms));
  }

  /** Yeni token iste (otomatik de yapılır) */
  refreshToken() {
    this.send({ source: EMBED_SOURCE, type: 'REFRESH_TOKEN' });
  }

  /** Oyunu kapat (oturumdan çık) */
  close() {
    this.send({ source: EMBED_SOURCE, type: 'CLOSE' });
  }

  /** Dracord davet penceresini aç */
  openInvite() {
    this.send({ source: EMBED_SOURCE, type: 'INVITE' });
  }

  /** Harici bağlantı aç — kullanıcıya onay sorulur */
  openExternal(url: string) {
    this.send({ source: EMBED_SOURCE, type: 'OPEN_EXTERNAL', payload: { url } });
  }

  /** Dracord'da kısa bildirim göster */
  toast(text: string) {
    this.send({ source: EMBED_SOURCE, type: 'TOAST', payload: { text: String(text).slice(0, 140) } });
  }

  /** Ses kanalı durum metnini ayarla (ör. "COOMBIE · Dalga 7") — null temizler */
  setStatus(text: string | null) {
    this.send({ source: EMBED_SOURCE, type: 'SET_STATUS', payload: { text: text ? String(text).slice(0, 100) : null } });
  }

  onSessionUpdate(f: Listener<{ session: EmbedSession; participants: EmbedParticipant[] }>) {
    this.listeners.session.add(f);
    return () => this.listeners.session.delete(f);
  }
  onTokenRefresh(f: Listener<{ token: string; expiresAt: string }>) {
    this.listeners.token.add(f);
    return () => this.listeners.token.delete(f);
  }
  onVisibilityChange(f: Listener<boolean>) {
    this.listeners.visibility.add(f);
    return () => this.listeners.visibility.delete(f);
  }
  onError(f: Listener<{ code: string; message: string }>) {
    this.listeners.error.add(f);
    return () => this.listeners.error.delete(f);
  }

  destroy() {
    if (typeof window !== 'undefined') window.removeEventListener('message', this.onMessage);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    Object.values(this.listeners).forEach((s) => s.clear());
  }
}

/**
 * Sunucu tarafı yardımcı (Node 18+ / Deno / Bun): token'ı Dracord'da doğrula.
 * GAME_SECRET'i asla istemciye koyma.
 */
export async function verifyDracordToken(opts: {
  token: string;
  gameSecret: string;
  apiBase?: string;
}): Promise<{
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  gameId: string;
  sessionId: string;
  guildId: string;
  channelId: string;
  participantIds: string[];
  testMode: boolean;
  exp: number;
}> {
  const base = (opts.apiBase ?? 'https://api.dracord.com.tr').replace(/\/$/, '');
  const res = await fetch(`${base}/v1/games/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Game ${opts.gameSecret}` },
    body: JSON.stringify({ token: opts.token }),
  });
  if (!res.ok) throw new Error(`Dracord doğrulama başarısız (${res.status})`);
  return res.json();
}
