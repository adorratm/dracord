/**
 * E3 — istemci anahtar yöneticisi (web, desktop, mobil ortak; depolama dışarıdan verilir).
 * Gizli anahtar yalnız bu cihazda; sunucuya sadece açık anahtar gider.
 */
import type { ChannelE2eeDto, E2eeDeviceDto, E2eePayload } from '@dracord/types';
import {
  e2eeAvailable,
  e2eeChannelDevices,
  e2eeDecrypt,
  e2eeEncrypt,
  e2eeSafetyNumber,
  generateE2eeKeyPair,
  type E2eeDecryptResult,
  type E2eeIdentity,
} from './e2ee';

export type E2eeStorage = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

type StoredIdentity = E2eeIdentity & { pastDeviceIds?: string[] };

export type E2eeApi = {
  listE2eeDevices(): Promise<E2eeDeviceDto[]>;
  registerE2eeDevice(input: { publicKey: string; name: string; platform: string }): Promise<E2eeDeviceDto>;
  getChannelE2ee(channelId: string): Promise<ChannelE2eeDto>;
};

export class E2eeManager {
  private ident: StoredIdentity | null = null;
  private loading: Promise<StoredIdentity | null> | null = null;
  private readonly channels = new Map<string, { at: number; info: ChannelE2eeDto }>();
  private readonly plain = new Map<string, E2eeDecryptResult>();

  constructor(
    private readonly api: E2eeApi,
    private readonly storage: E2eeStorage,
    private readonly userId: string,
    private readonly device: { name: string; platform: 'web' | 'desktop' | 'mobile' },
  ) {}

  private get key() {
    return `dracord:e2ee:v1:${this.userId}`;
  }

  get supported() {
    return e2eeAvailable();
  }

  /** Yerel kimlik (yoksa null) */
  async identity(): Promise<StoredIdentity | null> {
    if (this.ident) return this.ident;
    this.loading ??= this.storage
      .get(this.key)
      .then((raw) => (raw ? (JSON.parse(raw) as StoredIdentity) : null))
      .catch(() => null);
    this.ident = await this.loading;
    this.loading = null;
    return this.ident;
  }

  /**
   * Kimlik yoksa oluştur + sunucuya kaydet; varsa sunucuda hâlâ kayıtlı mı bak
   * (başka cihazdan silindiyse aynı anahtarla yeniden kaydol — eski mesajlar okunmaya devam eder).
   */
  async ensureIdentity(): Promise<StoredIdentity> {
    if (!this.supported) throw new Error('Bu cihazda güvenli rastgele sayı kaynağı yok');
    let id = await this.identity();
    if (!id) {
      const kp = generateE2eeKeyPair();
      const dev = await this.api.registerE2eeDevice({ publicKey: kp.publicKey, name: this.device.name, platform: this.device.platform });
      id = { deviceId: dev.id, publicKey: kp.publicKey, secretKey: kp.secretKey, pastDeviceIds: [] };
      await this.storage.set(this.key, JSON.stringify(id));
      this.ident = id;
      return id;
    }
    const mine = await this.api.listE2eeDevices().catch(() => null);
    if (mine && !mine.some((d) => d.id === id!.deviceId)) {
      const dev = await this.api.registerE2eeDevice({ publicKey: id.publicKey, name: this.device.name, platform: this.device.platform });
      id = { ...id, deviceId: dev.id, pastDeviceIds: [...new Set([...(id.pastDeviceIds ?? []), id.deviceId])].slice(-10) };
      await this.storage.set(this.key, JSON.stringify(id));
      this.ident = id;
    }
    return id;
  }

  async channel(channelId: string, force = false): Promise<ChannelE2eeDto> {
    const hit = this.channels.get(channelId);
    if (!force && hit && Date.now() - hit.at < 30_000) return hit.info;
    const info = await this.api.getChannelE2ee(channelId);
    this.channels.set(channelId, { at: Date.now(), info });
    return info;
  }

  invalidate(channelId: string) {
    this.channels.delete(channelId);
  }

  async encrypt(channelId: string, text: string): Promise<E2eePayload> {
    const me = await this.ensureIdentity();
    const info = await this.channel(channelId, true);
    const devices = e2eeChannelDevices(info).filter((d) => d.id !== me.deviceId);
    const others = info.members.filter((m) => m.userId !== this.userId);
    if (others.some((m) => m.devices.length === 0)) throw new Error('Karşı tarafın şifreleme anahtarı yok');
    return e2eeEncrypt(text, me, devices);
  }

  /** Senkron: önbellekten; yoksa çözer ve önbelleğe koyar */
  decrypt(messageId: string, payload: E2eePayload, authorId: string, info: ChannelE2eeDto | null): E2eeDecryptResult {
    const hit = this.plain.get(messageId);
    if (hit) return hit;
    const id = this.ident;
    if (!id) return { ok: false, reason: 'no_key' };
    const authorDevices = info?.members.find((m) => m.userId === authorId)?.devices.map((d) => ({ id: d.id, publicKey: d.publicKey }));
    let res: E2eeDecryptResult = { ok: false, reason: 'no_key' };
    for (const did of [id.deviceId, ...(id.pastDeviceIds ?? [])]) {
      res = e2eeDecrypt(payload, { ...id, deviceId: did }, authorDevices);
      if (res.ok || res.reason === 'corrupt') break;
    }
    // Yazar cihazı listede yoksa (bilgi eski) doğrulanmamış sonucu önbelleğe koyma
    if (res.ok || res.reason === 'corrupt') this.plain.set(messageId, res);
    if (this.plain.size > 5000) this.plain.clear();
    return res;
  }

  safetyNumber(info: ChannelE2eeDto) {
    return e2eeSafetyNumber(info);
  }
}
