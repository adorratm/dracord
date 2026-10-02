const KEY = 'dracord_participant_volumes';
const SCREEN_SHARE_KEY = 'dracord_screen_share_volumes';
const MUSIC_BOT_VOL_KEY = 'dracord_music_bot_volume';

function clampVol(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function loadVolumeMap(storageKey: string): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [id, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[id] = clampVol(v);
    }
    return out;
  } catch {
    return {};
  }
}

function saveVolumeMap(storageKey: string, volumes: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(volumes));
  } catch {
    // ignore
  }
}

export function loadParticipantVolumes(): Record<string, number> {
  return loadVolumeMap(KEY);
}

export function saveParticipantVolumes(volumes: Record<string, number>): void {
  saveVolumeMap(KEY, volumes);
}

export function loadScreenShareVolumes(): Record<string, number> {
  return loadVolumeMap(SCREEN_SHARE_KEY);
}

export function saveScreenShareVolumes(volumes: Record<string, number>): void {
  saveVolumeMap(SCREEN_SHARE_KEY, volumes);
}

export function loadMusicBotVolume(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MUSIC_BOT_VOL_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampVol(n);
  } catch {
    return null;
  }
}

export function saveMusicBotVolume(volume: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MUSIC_BOT_VOL_KEY, String(clampVol(volume)));
  } catch {
    // ignore
  }
}
