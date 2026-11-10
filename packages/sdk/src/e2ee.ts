/**
 * E3 — uçtan uca şifreleme çekirdeği (tweetnacl; web, Electron ve React Native'de aynı).
 * Sunucu yalnız şifreli zarfı görür; anahtarlar cihazda kalır.
 *
 * Model: her cihazın X25519 anahtar çifti var. Mesaj başına rastgele anahtar → secretbox;
 * anahtar her alıcı cihaz için nacl.box ile sarılır (gönderenin diğer cihazları dahil).
 * Yeni eklenen cihaz, eklenmeden önceki mesajları okuyamaz (bilinçli; yedekleme yok).
 */
import nacl from 'tweetnacl';
import type { ChannelE2eeDto, E2eePayload } from '@dracord/types';

export type E2eeIdentity = { deviceId: string; publicKey: string; secretKey: string };

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(u: Uint8Array): string {
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]!);
  return btoa(s);
}
export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** React Native: güvenli rastgele kaynak ver (expo-crypto). Web/Electron'da gerekmez. */
export function setE2eeRandomSource(fill: (n: number) => Uint8Array) {
  nacl.setPRNG((x, n) => {
    const r = fill(n);
    for (let i = 0; i < n; i++) x[i] = r[i]!;
  });
}

export function e2eeAvailable(): boolean {
  try {
    nacl.randomBytes(1);
    return true;
  } catch {
    return false;
  }
}

export function generateE2eeKeyPair(): { publicKey: string; secretKey: string } {
  const kp = nacl.box.keyPair();
  return { publicKey: b64(kp.publicKey), secretKey: b64(kp.secretKey) };
}

export type E2eeRecipientDevice = { id: string; publicKey: string };

/** Metni şifrele (alıcılar: tüm katılımcıların tüm cihazları, gönderenin kendi cihazı dahil) */
export function e2eeEncrypt(text: string, me: E2eeIdentity, devices: E2eeRecipientDevice[]): E2eePayload {
  const mk = nacl.randomBytes(nacl.secretbox.keyLength);
  const n = nacl.randomBytes(nacl.secretbox.nonceLength);
  const c = nacl.secretbox(enc.encode(JSON.stringify({ t: text })), n, mk);
  const sec = unb64(me.secretKey);
  const k: E2eePayload['k'] = {};
  const seen = new Set<string>();
  for (const d of [...devices, { id: me.deviceId, publicKey: me.publicKey }]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const n2 = nacl.randomBytes(nacl.box.nonceLength);
    k[d.id] = [b64(n2), b64(nacl.box(mk, n2, unb64(d.publicKey), sec))];
  }
  return { v: 1, sd: me.deviceId, sk: me.publicKey, n: b64(n), c: b64(c), k };
}

export type E2eeDecryptResult =
  | { ok: true; text: string; /** gönderen anahtarı kayıtlı cihazla eşleşiyor */ verified: boolean }
  | { ok: false; reason: 'no_key' | 'corrupt' };

/**
 * Çöz. `authorDevices` mesaj yazarının sunucudaki kayıtlı cihazları — zarftaki gönderen
 * anahtarı bunlardan biriyle eşleşmezse `verified: false` (sahte / silinmiş cihaz).
 */
export function e2eeDecrypt(p: E2eePayload, me: E2eeIdentity, authorDevices?: E2eeRecipientDevice[]): E2eeDecryptResult {
  const mine = p.k[me.deviceId];
  if (!mine) return { ok: false, reason: 'no_key' };
  try {
    const mk = nacl.box.open(unb64(mine[1]), unb64(mine[0]), unb64(p.sk), unb64(me.secretKey));
    if (!mk) return { ok: false, reason: 'corrupt' };
    const plain = nacl.secretbox.open(unb64(p.c), unb64(p.n), mk);
    if (!plain) return { ok: false, reason: 'corrupt' };
    const obj = JSON.parse(dec.decode(plain)) as { t?: unknown };
    const verified = Boolean(authorDevices?.some((d) => d.id === p.sd && d.publicKey === p.sk));
    return { ok: true, text: typeof obj.t === 'string' ? obj.t : '', verified };
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
}

/** Kanal katılımcılarının tüm cihazları (düz liste) */
export function e2eeChannelDevices(info: ChannelE2eeDto): E2eeRecipientDevice[] {
  return info.members.flatMap((m) => m.devices.map((d) => ({ id: d.id, publicKey: d.publicKey })));
}

/**
 * Güvenlik kodu: iki tarafın da aynı sayıyı görmesi gerekir (araya giren yok).
 * Tüm katılımcı cihaz anahtarlarının sıralı özetinden 12 × 5 haneli sayı.
 */
export function e2eeSafetyNumber(info: ChannelE2eeDto): string {
  const keys = info.members
    .flatMap((m) => m.devices.map((d) => `${m.userId}:${d.publicKey}`))
    .sort()
    .join('|');
  const h = nacl.hash(enc.encode(`dracord-e2ee-v1|${keys}`));
  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    const v = ((h[i * 4]! << 24) | (h[i * 4 + 1]! << 16) | (h[i * 4 + 2]! << 8) | h[i * 4 + 3]!) >>> 0;
    groups.push(String(v % 100000).padStart(5, '0'));
  }
  return groups.join(' ');
}
