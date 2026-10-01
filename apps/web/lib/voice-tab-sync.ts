/**
 * Çoklu sekme ses liderliği.
 * Yalnızca lider sekme LiveKit’e bağlanır; presence API’yi o yönetir.
 * Bot sesi sunucu tarafında kaldığı için lider değişiminde odadan çıkılmaz.
 */

export type VoiceTabMessage =
  | {
      type: 'claim';
      tabId: string;
      channelId: string;
      guildId: string;
      at: number;
    }
  | {
      type: 'release';
      tabId: string;
      channelId: string;
      at: number;
    }
  | {
      type: 'leave';
      tabId: string;
      at: number;
    }
  | {
      type: 'ping';
      tabId: string;
      channelId: string | null;
      at: number;
    };

const CHANNEL_NAME = 'dracord-voice-tab';

export function createTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function openVoiceTabChannel(
  onMessage: (msg: VoiceTabMessage) => void,
): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  const bc = new BroadcastChannel(CHANNEL_NAME);
  bc.onmessage = (ev: MessageEvent<VoiceTabMessage>) => {
    if (ev.data && typeof ev.data === 'object' && 'type' in ev.data) {
      onMessage(ev.data);
    }
  };
  return bc;
}

export function postVoiceTabMessage(
  bc: BroadcastChannel | null,
  msg: VoiceTabMessage,
) {
  try {
    bc?.postMessage(msg);
  } catch {
    // ignore
  }
}
