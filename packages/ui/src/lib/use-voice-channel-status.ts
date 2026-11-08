import { useCallback, useEffect, useState } from 'react';
import {
  SocketEvents,
  normalizeVoiceChannelStatus,
  type VoiceChannelStatusPayload,
  type VoiceSyncPayload,
} from '@dracord/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SocketLike = {
  on(event: any, fn: any): unknown;
  off(event: any, fn: any): unknown;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** @dracord/sdk DracordClient'ın ihtiyaç duyulan alt kümesi (paket bağımlılığı olmadan) */
export type VoiceChannelStatusClient = {
  connectSocket(): SocketLike;
  setVoiceChannelStatus(payload: {
    guildId: string;
    channelId: string;
    status: string | null;
  }): Promise<{ ok: boolean; error?: string; status?: VoiceChannelStatusPayload }>;
};

/**
 * Guild ses kanalı durum metinleri (web / desktop / mobil ortak).
 * VOICE_SYNC snapshot + VOICE_CHANNEL_STATUS canlı güncelleme.
 */
export function useVoiceChannelStatuses(
  client: VoiceChannelStatusClient | null | undefined,
  guildId: string | null | undefined,
) {
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    setStatuses({});
    if (!client || !guildId) return;
    const sock = client.connectSocket();
    const onSync = (payload: VoiceSyncPayload) => {
      if (payload.guildId !== guildId) return;
      const next: Record<string, string> = {};
      for (const [chId, st] of Object.entries(payload.statusByChannel ?? {})) {
        if (st?.status) next[chId] = st.status;
      }
      setStatuses(next);
    };
    const onStatus = (payload: VoiceChannelStatusPayload) => {
      if (payload.guildId !== guildId) return;
      setStatuses((prev) => {
        const cur = prev[payload.channelId];
        if (payload.status === (cur ?? null)) return prev;
        const next = { ...prev };
        if (payload.status) next[payload.channelId] = payload.status;
        else delete next[payload.channelId];
        return next;
      });
    };
    sock.on(SocketEvents.VOICE_SYNC, onSync as never);
    sock.on(SocketEvents.VOICE_CHANNEL_STATUS, onStatus as never);
    return () => {
      sock.off(SocketEvents.VOICE_SYNC, onSync as never);
      sock.off(SocketEvents.VOICE_CHANNEL_STATUS, onStatus as never);
    };
  }, [client, guildId]);

  const setStatus = useCallback(
    async (channelId: string, raw: string | null) => {
      if (!client || !guildId) return { ok: false, error: 'offline' };
      const status = normalizeVoiceChannelStatus(raw);
      const res = await client.setVoiceChannelStatus({ guildId, channelId, status });
      if (res.ok) {
        setStatuses((prev) => {
          const next = { ...prev };
          if (status) next[channelId] = status;
          else delete next[channelId];
          return next;
        });
      }
      return res;
    },
    [client, guildId],
  );

  return { voiceStatuses: statuses, setVoiceStatus: setStatus };
}

export function voiceStatusErrorMessage(error?: string): string {
  switch (error) {
    case 'not_in_channel':
      return 'Durumu yalnızca kanaldakiler değiştirebilir.';
    case 'rate_limited':
      return 'Biraz yavaş — birkaç saniye sonra tekrar dene.';
    case 'offline':
    case 'timeout':
      return 'Bağlantı yok, tekrar dene.';
    default:
      return 'Durum kaydedilemedi.';
  }
}
