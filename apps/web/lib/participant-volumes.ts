const KEY = 'dracord_participant_volumes';
const MUSIC_BOT_VOL_KEY = 'dracord_music_bot_volume';

function clampVol(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function loadParticipantVolumes(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
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

export function saveParticipantVolumes(volumes: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(volumes));
  } catch {
    // ignore
  }
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
