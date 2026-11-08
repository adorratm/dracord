import { useCallback, useEffect, useRef, useState } from 'react';
import { SocketEvents, type GuildSoundDto, type SoundboardPlayPayload } from '@dracord/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type SocketLike = { on(e: any, f: any): unknown; off(e: any, f: any): unknown };
/* eslint-enable @typescript-eslint/no-explicit-any */

export type SoundboardClient = {
  connectSocket(): SocketLike;
  listGuildSounds(guildId: string): Promise<GuildSoundDto[]>;
  playSound(p: { guildId: string; channelId: string; soundId: string }): Promise<{ ok: boolean; error?: string }>;
};

const VOL_KEY = 'dracord.soundboard.volume';

export function getSoundboardVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && localStorage.getItem(VOL_KEY) !== null ? Math.min(1, Math.max(0, v)) : 0.8;
  } catch {
    return 0.8;
  }
}
export function setSoundboardVolume(v: number) {
  try {
    localStorage.setItem(VOL_KEY, String(Math.min(1, Math.max(0, v))));
  } catch {
    /* ignore */
  }
}

/**
 * Soundboard: sunucu sesleri + ses kanalında çalınanları yerel oynat.
 * Sesler LiveKit'e karıştırılmaz; her dinleyici kendi cihazında çalar
 * (sağırken / soundboard sesi 0 iken çalmaz).
 */
export function useSoundboard(
  client: SoundboardClient | null | undefined,
  guildId: string | null | undefined,
  /** Kullanıcının bulunduğu ses kanalı (yoksa dinlemez) */
  voiceChannelId: string | null | undefined,
  opts?: { deafened?: boolean; outputVolume?: number },
) {
  const [sounds, setSounds] = useState<GuildSoundDto[]>([]);
  const [lastPlayed, setLastPlayed] = useState<SoundboardPlayPayload | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const playing = useRef(new Set<HTMLAudioElement>());

  const reload = useCallback(async () => {
    if (!client || !guildId) return setSounds([]);
    try {
      setSounds(await client.listGuildSounds(guildId));
    } catch {
      setSounds([]);
    }
  }, [client, guildId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!client || !guildId || !voiceChannelId) return;
    const sock = client.connectSocket();
    const onPlay = (p: SoundboardPlayPayload) => {
      if (p.guildId !== guildId || p.channelId !== voiceChannelId || !p.url) return;
      setLastPlayed(p);
      if (optsRef.current?.deafened) return;
      const vol =
        getSoundboardVolume() * (p.volume ?? 1) * Math.min(1, Math.max(0, optsRef.current?.outputVolume ?? 1));
      if (vol <= 0.001) return;
      // Aynı anda en fazla 3 ses
      if (playing.current.size >= 3) return;
      const a = new Audio(p.url);
      a.volume = Math.min(1, vol);
      playing.current.add(a);
      const done = () => playing.current.delete(a);
      a.addEventListener('ended', done);
      a.addEventListener('error', done);
      void a.play().catch(done);
    };
    sock.on(SocketEvents.SOUNDBOARD_PLAY, onPlay);
    return () => {
      sock.off(SocketEvents.SOUNDBOARD_PLAY, onPlay);
    };
  }, [client, guildId, voiceChannelId]);

  useEffect(
    () => () => {
      for (const a of playing.current) a.pause();
      playing.current.clear();
    },
    [],
  );

  const play = useCallback(
    async (soundId: string) => {
      if (!client || !guildId || !voiceChannelId) return { ok: false, error: 'not_in_channel' };
      return client.playSound({ guildId, channelId: voiceChannelId, soundId });
    },
    [client, guildId, voiceChannelId],
  );

  return { sounds, play, reload, lastPlayed };
}
