import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer } from 'expo-audio';
import type { DracordClient } from '@dracord/sdk';
import { SocketEvents, type GuildSoundDto, type SoundboardPlayPayload } from '@dracord/types';

/**
 * Mobil soundboard — web `useSoundboard` ile aynı akış; çalma expo-audio ile
 * (UI tonları gibi LiveKit oturumuyla birlikte çalışır). Ses ekleme web/desktop'tan.
 */
export function useSoundboard(
  client: DracordClient | null | undefined,
  guildId: string | null | undefined,
  voiceChannelId: string | null | undefined,
  opts?: { deafened?: boolean },
) {
  const [sounds, setSounds] = useState<GuildSoundDto[]>([]);
  const deafRef = useRef(opts?.deafened);
  deafRef.current = opts?.deafened;
  const active = useRef(0);

  useEffect(() => {
    if (!client || !guildId) return setSounds([]);
    void client.listGuildSounds(guildId).then(setSounds).catch(() => setSounds([]));
  }, [client, guildId]);

  useEffect(() => {
    if (!client || !guildId || !voiceChannelId) return;
    const sock = client.connectSocket();
    const onPlay = (p: SoundboardPlayPayload) => {
      if (p.guildId !== guildId || p.channelId !== voiceChannelId || !p.url) return;
      if (deafRef.current || active.current >= 3) return;
      try {
        const player = createAudioPlayer({ uri: p.url }, { updateInterval: 1000 });
        player.volume = Math.min(1, 0.8 * (p.volume ?? 1));
        active.current += 1;
        player.play();
        setTimeout(() => {
          active.current = Math.max(0, active.current - 1);
          try {
            player.release();
          } catch {
            /* ignore */
          }
        }, 6500);
      } catch {
        /* native yok */
      }
    };
    sock.on(SocketEvents.SOUNDBOARD_PLAY, onPlay);
    return () => {
      sock.off(SocketEvents.SOUNDBOARD_PLAY, onPlay);
    };
  }, [client, guildId, voiceChannelId]);

  const play = useCallback(
    (soundId: string) =>
      client && guildId && voiceChannelId
        ? client.playSound({ guildId, channelId: voiceChannelId, soundId })
        : Promise.resolve({ ok: false, error: 'not_in_channel' }),
    [client, guildId, voiceChannelId],
  );

  return { sounds, play };
}
