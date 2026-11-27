/**
 * Uzak kontrol girdisi için LiveKit veri kanalı (E — gecikme).
 *
 * Eski yol: kontrol eden → API sunucusu → paylaşan (socket). Yeni yol: ikisi de zaten aynı
 * LiveKit odasında; olaylar doğrudan paylaşanın kimliğine gönderilir (fare hareketi kayıplı,
 * tık/tuş güvenilir). Yetki yine sunucuda: paylaşan, yalnız sunucunun onayladığı kontrol
 * edenden (LiveKit'in doğruladığı kimlik) ve oturum etkinken gelen veriyi uygular.
 * LiveKit yoksa (ör. mobil kontrol eden) socket yolu aynen çalışır.
 */
import type { RemoteControlInputPayload } from '@dracord/types';

export const RC_TOPIC = 'dracord-rc';

/** livekit-client Room'un kullandığımız kadarı (test edilebilir) */
export type RcRoomLike = {
  localParticipant: {
    publishData(data: Uint8Array, options: { reliable?: boolean; destinationIdentities?: string[]; topic?: string }): Promise<void>;
  };
  remoteParticipants: Map<string, { identity: string }>;
  on(event: 'dataReceived', fn: RcDataListener): unknown;
  off(event: 'dataReceived', fn: RcDataListener): unknown;
};

export type RcDataListener = (payload: Uint8Array, participant?: { identity: string }, kind?: unknown, topic?: string) => void;

export type RcInput = Pick<
  RemoteControlInputPayload,
  'type' | 'nx' | 'ny' | 'button' | 'deltaY' | 'key' | 'code' | 'keyAction' | 'ctrl' | 'alt' | 'shift' | 'meta'
>;

export type RcMessage = { v: 1; k: 'in'; p: RcInput } | { v: 1; k: 'ping'; id: number } | { v: 1; k: 'pong'; id: number };

const TYPES = new Set(['move', 'down', 'up', 'wheel', 'key']);
const enc = new TextEncoder();
const dec = new TextDecoder();

const num01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined);
const bool = (v: unknown) => (v === true ? true : undefined);

/** Paylaşan tarafta: dışarıdan gelen girdiyi daralt (sunucuyu atlayan yol olduğu için şart) */
export function sanitizeRcInput(raw: unknown): RcInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== 'string' || !TYPES.has(r.type)) return null;
  const out: RcInput = { type: r.type as RcInput['type'] };
  if (r.type === 'key') {
    const keyAction = r.keyAction === 'down' || r.keyAction === 'up' ? r.keyAction : null;
    const code = str(r.code, 32);
    const key = str(r.key, 32);
    if (!keyAction || (!code && !key)) return null;
    return { ...out, keyAction, code, key, ctrl: bool(r.ctrl), alt: bool(r.alt), shift: bool(r.shift), meta: bool(r.meta) };
  }
  const nx = num01(r.nx);
  const ny = num01(r.ny);
  if (r.type !== 'wheel' && (nx === undefined || ny === undefined)) return null;
  if (nx !== undefined) out.nx = nx;
  if (ny !== undefined) out.ny = ny;
  if (r.type === 'down' || r.type === 'up') {
    const b = Number(r.button ?? 0);
    out.button = Number.isInteger(b) && b >= 0 && b <= 4 ? b : 0;
  }
  if (r.type === 'wheel') {
    const d = Number(r.deltaY);
    if (!Number.isFinite(d)) return null;
    out.deltaY = Math.max(-2000, Math.min(2000, d));
  }
  return out;
}

export function encodeRc(m: RcMessage): Uint8Array {
  return enc.encode(JSON.stringify(m));
}

export function decodeRc(data: Uint8Array): RcMessage | null {
  if (!data || data.byteLength > 1024) return null;
  try {
    const m = JSON.parse(dec.decode(data)) as Record<string, unknown>;
    if (m?.v !== 1) return null;
    if (m.k === 'ping' || m.k === 'pong') return typeof m.id === 'number' && Number.isFinite(m.id) ? ({ v: 1, k: m.k, id: m.id } as RcMessage) : null;
    if (m.k === 'in') {
      const p = sanitizeRcInput(m.p);
      return p ? { v: 1, k: 'in', p } : null;
    }
  } catch {
    /* çöp veri */
  }
  return null;
}

/** Gönderilecek yol: paylaşan aynı LiveKit odasındaysa doğrudan, değilse sunucu */
export function rcCanDirect(room: RcRoomLike | null | undefined, sharerId: string | null | undefined): boolean {
  if (!room || !sharerId) return false;
  for (const p of room.remoteParticipants.values()) if (p.identity === sharerId) return true;
  return false;
}

export function rcSend(room: RcRoomLike, to: string, m: RcMessage, onFail?: () => void): void {
  // fare hareketi ve ölçüm kayıplı (eski konumu yeniden göndermenin anlamı yok); tık/tuş güvenilir
  const reliable = !(m.k === 'in' && m.p.type === 'move') && m.k === 'in';
  let p: Promise<void>;
  try {
    p = room.localParticipant.publishData(encodeRc(m), { reliable, destinationIdentities: [to], topic: RC_TOPIC });
  } catch {
    onFail?.();
    return;
  }
  void p.catch(() => onFail?.());
}

/**
 * Hangi yol: paylaşan aynı odada VE son `timeoutMs` içinde pong verdiyse doğrudan.
 * Eski sürüm paylaşan hiç pong vermez → hep sunucu (karışık sürümlerde kontrol kopmaz).
 */
export function rcRoute(o: { reachable: boolean; lastPongAt: number; now: number; timeoutMs: number }): 'direct' | 'server' {
  return o.reachable && o.lastPongAt > 0 && o.now - o.lastPongAt < o.timeoutMs ? 'direct' : 'server';
}
