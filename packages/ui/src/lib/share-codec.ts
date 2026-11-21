/**
 * Ekran paylaşımı codec seçimi (A/B denemesi). auto = LiveKit varsayılanı (VP8 simulcast).
 * H.264 çoğu GPU'da donanımla kodlanır (düşük işlemci); VP9/AV1 SVC aynı bit hızında daha net,
 * desteklemeyen izleyiciler için VP8 yedek akış yayınlanır.
 */
export type ShareCodec = 'auto' | 'h264' | 'vp9' | 'av1';
export const SHARE_CODECS: Array<{ id: ShareCodec; label: string; hint: string }> = [
  { id: 'auto', label: 'Otomatik (VP8)', hint: 'En uyumlu' },
  { id: 'h264', label: 'H.264', hint: 'Donanım kodlama, düşük işlemci' },
  { id: 'vp9', label: 'VP9 (SVC)', hint: 'Daha net metin, daha çok işlemci' },
  { id: 'av1', label: 'AV1 (SVC)', hint: 'En verimli; yeni ekran kartı ister' },
];
const KEY = 'dracord.share-codec';

export function loadShareCodec(): ShareCodec {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'h264' || v === 'vp9' || v === 'av1' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveShareCodec(c: ShareCodec) {
  try {
    localStorage.setItem(KEY, c);
  } catch {
    /* ignore */
  }
}

/** Bu tarayıcı codec'i gönderebiliyor mu */
export function canSendCodec(c: ShareCodec): boolean {
  if (c === 'auto') return true;
  try {
    const caps = typeof RTCRtpSender !== 'undefined' ? RTCRtpSender.getCapabilities?.('video') : null;
    if (!caps) return false;
    return caps.codecs.some((x) => x.mimeType.toLowerCase() === `video/${c}`);
  } catch {
    return false;
  }
}

/** setScreenShareEnabled yayın seçeneklerine eklenecek alanlar */
export function shareCodecPublishOptions(c: ShareCodec = loadShareCodec()): { videoCodec?: 'h264' | 'vp9' | 'av1'; backupCodec?: boolean } {
  if (c === 'auto' || !canSendCodec(c)) return {};
  if (c === 'h264') return { videoCodec: 'h264' };
  return { videoCodec: c, backupCodec: true };
}
