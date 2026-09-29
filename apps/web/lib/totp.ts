/** Basit TOTP (RFC 6238) — Web Crypto ile, harici paket yok. */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += BASE32[bytes[i]! % 32];
  }
  return out;
}

function base32ToBytes(secret: string): Uint8Array {
  const cleaned = secret.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const c of cleaned) {
    const val = BASE32.indexOf(c);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data.buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

export async function generateTotpCode(secret: string, step = 30): Promise<string> {
  const key = base32ToBytes(secret);
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(4, counter, false);
  const hmac = await hmacSha1(key, new Uint8Array(buf));
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const normalized = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;
  const now = await generateTotpCode(secret);
  const prev = await generateTotpCode(secret); // same window mostly
  // Also check previous/next step manually
  const key = base32ToBytes(secret);
  const step = 30;
  const counter = Math.floor(Date.now() / 1000 / step);
  for (const c of [counter - 1, counter, counter + 1]) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint32(4, c >>> 0, false);
    const hmac = await hmacSha1(key, new Uint8Array(buf));
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const n =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);
    const candidate = (n % 1_000_000).toString().padStart(6, '0');
    if (candidate === normalized) return true;
  }
  return normalized === now || normalized === prev;
}

export function totpOtpauthUrl(secret: string, accountName: string): string {
  const label = encodeURIComponent(`Dracord:${accountName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Dracord&digits=6&period=30`;
}

export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    codes.push(
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase(),
    );
  }
  return codes;
}

export function newId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
