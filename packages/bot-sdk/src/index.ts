import { io, type Socket } from 'socket.io-client';

export type DracordBotOptions = {
  token: string;
  /** API kökü, örn. https://api.example.com */
  baseUrl: string;
  /** Discovery atlanırsa bot gateway URL (varsayılan: baseUrl + /v1/gateway) */
  gatewayUrl?: string;
  fetch?: typeof fetch;
};

export type Discovery = {
  name: string;
  version: number;
  endpoints: {
    api_public: string;
    bot_gateway?: string;
    openapi?: string;
    [key: string]: unknown;
  };
  features?: Record<string, unknown>;
};

export type GatewayPacket =
  | {
      op: 10;
      d: {
        heartbeat_interval: number;
        shard_id?: number;
        shard_count?: number;
      };
    }
  | { op: 11; d?: null }
  | { op: 0; t: string; s?: number; d: unknown }
  | { op: 1; d?: null }
  | { op: 2; d: { token: string; shard?: [number, number]; intents?: number } }
  | { op: number; t?: string; d?: unknown; s?: number };

/** Discord-parity: `(BigInt(guildId) >> 22n) % shardCount` */
export function guildShardIndex(
  guildId: string,
  shardCount: number,
): number {
  const n = Math.max(1, Math.floor(shardCount) || 1);
  try {
    return Number((BigInt(String(guildId).trim()) >> 22n) % BigInt(n));
  } catch {
    let h = 0x811c9dc5;
    for (let i = 0; i < guildId.length; i++) {
      h ^= guildId.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) % n;
  }
}

export type SlashCommandOptionInput = {
  /** Discord ApplicationCommandOptionType: 3=STRING … 11=ATTACHMENT */
  type: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
  name: string;
  description: string;
  required?: boolean;
  choices?: Array<{ name: string; value: string | number }>;
};

export type SlashCommandInput = {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  responseTemplate?: string;
  options?: SlashCommandOptionInput[];
};

export class DracordApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'DracordApiError';
  }
}

/**
 * Platform bot istemcisi (Fluxer/Discord bot SDK benzeri).
 *
 * ```ts
 * const bot = new DracordBot({ token: process.env.BOT_TOKEN!, baseUrl: 'http://localhost:4000' });
 * await bot.sendMessage(channelId, 'merhaba');
 * bot.connectGateway({ onDispatch: (t, d) => console.log(t, d) });
 * ```
 */
export class DracordBot {
  private readonly token: string;
  private baseUrl: string;
  private gatewayUrl: string | null;
  private readonly fetchImpl: typeof fetch;
  private socket: Socket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: DracordBotOptions) {
    if (!opts.token?.trim()) throw new Error('Bot token gerekli');
    if (!opts.baseUrl?.trim()) throw new Error('baseUrl gerekli');
    this.token = opts.token.trim();
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.gatewayUrl = opts.gatewayUrl?.replace(/\/$/, '') ?? null;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  static async fromDiscovery(
    origin: string,
    token: string,
  ): Promise<DracordBot> {
    const root = origin.replace(/\/$/, '');
    const res = await fetch(`${root}/.well-known/dracord`);
    if (!res.ok) {
      throw new DracordApiError(res.status, 'Discovery başarısız');
    }
    const disc = (await res.json()) as Discovery;
    const api = String(disc.endpoints?.api_public || root).replace(/\/$/, '');
    return new DracordBot({
      token,
      baseUrl: api,
      gatewayUrl: disc.endpoints?.bot_gateway
        ? String(disc.endpoints.bot_gateway)
        : undefined,
    });
  }

  async discovery(): Promise<Discovery> {
    const res = await this.fetchImpl(`${this.baseUrl}/.well-known/dracord`);
    if (!res.ok) throw new DracordApiError(res.status, 'Discovery başarısız');
    const disc = (await res.json()) as Discovery;
    if (disc.endpoints?.bot_gateway) {
      this.gatewayUrl = String(disc.endpoints.bot_gateway);
    }
    return disc;
  }

  async health() {
    return this.request<{
      ok: boolean;
      platformApi: boolean;
      platformOauth: boolean;
      service: string;
    }>('/v1/health', { auth: false });
  }

  async me() {
    return this.request<Record<string, unknown>>('/v1/users/@me');
  }

  async getGuild(guildId: string) {
    return this.request<{
      id: string;
      name: string;
      iconUrl: string | null;
      ownerId: string;
    }>(`/v1/guilds/${encodeURIComponent(guildId)}`);
  }

  async sendMessage(channelId: string, content: string) {
    return this.request<unknown>(
      `/v1/channels/${encodeURIComponent(channelId)}/messages`,
      {
        method: 'POST',
        body: { content },
      },
    );
  }

  async syncCommands(
    applicationId: string,
    guildId: string | 'global' | null,
    commands: SlashCommandInput[],
  ) {
    return this.request<{
      applicationId: string;
      guildId: string | null;
      commands: Array<{ id: string; name: string }>;
    }>(`/v1/applications/${encodeURIComponent(applicationId)}/commands`, {
      method: 'PUT',
      body: { guildId: guildId ?? 'global', commands },
    });
  }

  /**
   * Bot gateway’e bağlan. Hello → Identify → READY.
   * Dönen fonksiyon bağlantıyı kapatır.
   */
  connectGateway(handlers?: {
    onReady?: (data: unknown) => void;
    onDispatch?: (event: string, data: unknown) => void;
    onPacket?: (packet: GatewayPacket) => void;
    onError?: (err: unknown) => void;
    /**
     * Discord-parity shard pair. Verilmezse Hello’daki instance dilimi kullanılır
     * (`shard_count > 1` ise).
     */
    shard?: [number, number];
  }): () => void {
    this.disconnectGateway();
    const url = this.gatewayUrl || `${this.baseUrl}/v1/gateway`;
    const socket = io(url, {
      transports: ['websocket'],
      path: '/socket.io',
      autoConnect: true,
    });
    this.socket = socket;

    socket.on('packet', (raw: GatewayPacket) => {
      handlers?.onPacket?.(raw);
      if (raw.op === 10) {
        const d = raw.d as {
          heartbeat_interval?: number;
          shard_id?: number;
          shard_count?: number;
        };
        const interval = Number(d?.heartbeat_interval ?? 41250);
        let shard = handlers?.shard;
        if (
          !shard &&
          typeof d?.shard_count === 'number' &&
          d.shard_count > 1 &&
          typeof d.shard_id === 'number'
        ) {
          shard = [d.shard_id, d.shard_count];
        }
        socket.emit('packet', {
          op: 2,
          d: { token: this.token, ...(shard ? { shard } : {}) },
        });
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(() => {
          socket.emit('packet', { op: 1, d: null });
        }, interval);
        return;
      }
      if (raw.op === 0) {
        const t = raw.t ?? '';
        if (t === 'READY') handlers?.onReady?.(raw.d);
        handlers?.onDispatch?.(t, raw.d);
      }
    });

    socket.on('connect_error', (err) => handlers?.onError?.(err));
    socket.on('error', (err) => handlers?.onError?.(err));

    return () => this.disconnectGateway();
  }

  disconnectGateway() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private async request<T>(
    path: string,
    opts?: {
      method?: string;
      body?: unknown;
      auth?: boolean;
    },
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (opts?.auth !== false) {
      headers.Authorization = `Bot ${this.token}`;
    }
    let body: string | undefined;
    if (opts?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: opts?.method ?? 'GET',
      headers,
      body,
    });
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
    }
    if (!res.ok) {
      const msg =
        typeof json === 'object' &&
        json &&
        'message' in json &&
        typeof (json as { message: unknown }).message === 'string'
          ? (json as { message: string }).message
          : res.statusText;
      throw new DracordApiError(res.status, msg, json);
    }
    return json as T;
  }
}

export default DracordBot;
