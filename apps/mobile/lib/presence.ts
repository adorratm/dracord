import type { PresenceStatus } from '@dracord/types';

/** Görüntüleme etiketi — OFFLINE her zaman Çevrimdışı (Görünmez yalnızca kendi seçicide) */
export function presenceLabelTr(
  status: PresenceStatus | string | null | undefined,
  customStatus?: string | null,
): string {
  const custom = customStatus?.trim();
  if (custom) return custom;
  switch (normalizePresence(status)) {
    case 'ONLINE':
      return 'Çevrimiçi';
    case 'IDLE':
      return 'Boşta';
    case 'DND':
      return 'Rahatsız etme';
    case 'OFFLINE':
    default:
      return 'Çevrimdışı';
  }
}

export function normalizePresence(
  status: PresenceStatus | string | null | undefined,
): PresenceStatus {
  const s = String(status ?? 'OFFLINE').toUpperCase();
  if (s === 'ONLINE' || s === 'IDLE' || s === 'DND') return s;
  return 'OFFLINE';
}

export function isOnlinePresence(
  status: PresenceStatus | string | null | undefined,
): boolean {
  const s = normalizePresence(status);
  return s === 'ONLINE' || s === 'IDLE' || s === 'DND';
}
