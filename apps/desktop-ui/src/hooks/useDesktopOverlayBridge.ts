import { useEffect, useRef } from 'react';
import { useVoiceSession } from '../voice/VoiceSession';

/**
 * Overlay mute/deafen IPC + konuşan üyeleri Electron overlay / speaking HUD’a iter.
 */
export function useDesktopOverlayBridge() {
  const voice = useVoiceSession();
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    const api = window.dracordDesktop;
    if (!api?.onOverlayVoiceCommand) return;
    return api.onOverlayVoiceCommand((payload) => {
      const v = voiceRef.current;
      const kind =
        payload && typeof payload === 'object' && 'kind' in payload
          ? String((payload as { kind?: unknown }).kind ?? '')
          : '';
      if (kind === 'mute') {
        v.setMuted(!v.muted);
        return;
      }
      if (kind === 'deafen') {
        v.setDeafened(!v.deafened);
      }
    });
  }, []);

  useEffect(() => {
    const api = window.dracordDesktop;
    if (!api?.setGameOverlayState) return;
    const inVoice = Boolean(voice.voiceChannelId && voice.connected);
    const members = (voice.peers ?? []).map((p) => ({
      id: p.id,
      name: p.displayName || p.id,
      avatarUrl: p.avatarUrl ?? null,
      muted: Boolean(p.muted),
      speaking: Boolean(p.speaking),
    }));
    void api.setGameOverlayState({
      members,
      inVoice,
      selfMuted: voice.muted,
      selfDeafened: voice.deafened,
    });
  }, [
    voice.peers,
    voice.voiceChannelId,
    voice.connected,
    voice.muted,
    voice.deafened,
  ]);
}
