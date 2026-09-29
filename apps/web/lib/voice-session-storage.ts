const VOICE_KEY = 'dracord:active-voice';

export type ActiveVoiceSession = {
  guildId: string;
  channelId: string;
};

export function saveActiveVoice(session: ActiveVoiceSession) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(VOICE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode
  }
}

export function clearActiveVoice() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(VOICE_KEY);
  } catch {
    // ignore
  }
}

export function readActiveVoice(): ActiveVoiceSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(VOICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveVoiceSession;
    if (!parsed?.guildId || !parsed?.channelId) return null;
    return parsed;
  } catch {
    return null;
  }
}
