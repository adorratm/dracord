'use client';

import type { MusicQueueState } from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useVoiceSession } from '@/components/VoiceSessionProvider';

type Props = {
  guildId: string;
  /** Metin kanalı (bot yanıtları için, opsiyonel) */
  textChannelId?: string | null;
  /** compact: ses sahnesi altı; default: sohbet üstü önizleme */
  variant?: 'chat' | 'stage';
};

function formatDuration(sec?: number | null) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null;
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function MusicPlayerBar({ guildId, textChannelId, variant = 'chat' }: Props) {
  const { client } = useAuth();
  const voice = useVoiceSession();
  const voiceChannelId = voice.voiceChannelId;
  const [state, setState] = useState<MusicQueueState | null>(null);
  const [localBotVol, setLocalBotVol] = useState(100);
  const [busy, setBusy] = useState(false);

  const botInVoice = voice.participants.some((p) => p.id === DRACORD_BOT_USER_ID);

  const refresh = useCallback(async () => {
    if (!voiceChannelId) {
      setState(null);
      return;
    }
    try {
      const res = await client.getMusicState(guildId, voiceChannelId);
      if ('empty' in res && res.empty) {
        setState(null);
        return;
      }
      setState(res as MusicQueueState);
    } catch {
      setState(null);
    }
  }, [client, guildId, voiceChannelId]);

  useEffect(() => {
    if (!voiceChannelId) {
      setState(null);
      return;
    }
    void refresh();
    const t = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(t);
  }, [voiceChannelId, refresh]);

  useEffect(() => {
    setLocalBotVol(voice.getParticipantVolume(DRACORD_BOT_USER_ID));
  }, [voice, voiceChannelId, botInVoice]);

  const control = async (
    action: 'pause' | 'resume' | 'skip' | 'stop' | 'volume',
    volume?: number,
  ) => {
    if (!voiceChannelId) return;
    setBusy(true);
    try {
      const res = await client.controlMusic({
        guildId,
        voiceChannelId,
        textChannelId: textChannelId ?? undefined,
        action,
        volume,
      });
      if (res.state) setState(res.state);
      else if (action === 'stop') setState(null);
      else void refresh();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  if (!voiceChannelId || (!state?.nowPlaying && !botInVoice)) return null;

  const track = state?.nowPlaying;
  const paused = Boolean(state?.paused);
  const botVol = state?.volume ?? 80;
  const duration = formatDuration(track?.durationSec);
  const thumb = track?.thumbnailUrl;

  return (
    <div
      className={
        variant === 'stage'
          ? 'shrink-0 mx-space-md mb-space-sm rounded-xl border border-surface-container-highest bg-surface-container-high px-space-md py-space-sm shadow-bar'
          : 'shrink-0 mx-space-md mb-space-sm rounded-xl border border-primary-container/30 bg-surface-container-high overflow-hidden shadow-bar'
      }
    >
      <div className="flex gap-space-sm min-w-0 p-space-sm sm:p-space-md">
        <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-surface-container-highest border border-surface-container-highest">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="material-symbols-outlined text-primary-container text-[32px]">
                album
              </span>
            </div>
          )}
          {paused && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[22px]">pause</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <p className="font-label-sm text-primary-container uppercase tracking-wide">
            {paused ? 'Duraklatıldı' : track ? 'Şimdi çalıyor' : 'Dracord-Bot'}
          </p>
          <p className="font-body-md text-on-surface truncate font-medium">
            {track ? track.title : 'Ses kanalında hazır'}
          </p>
          <p className="font-label-sm text-outline truncate">
            {track
              ? [
                  track.requestedByName ? `İsteyen: ${track.requestedByName}` : null,
                  duration,
                  state && state.queue.length > 0
                    ? `Kuyruk: ${state.queue.length}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Parça bekleniyor'}
          </p>
        </div>
      </div>

      <div className="px-space-sm sm:px-space-md pb-space-sm flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy || !track}
          className="h-9 px-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-40 flex items-center gap-1 font-label-sm"
          title={paused ? 'Devam ettir' : 'Duraklat'}
          onClick={() => void control(paused ? 'resume' : 'pause')}
        >
          <span className="material-symbols-outlined text-[20px]">
            {paused ? 'play_arrow' : 'pause'}
          </span>
          <span className="hidden xs:inline sm:inline">{paused ? 'Oynat' : 'Duraklat'}</span>
        </button>
        <button
          type="button"
          disabled={busy || !track}
          className="h-9 px-space-sm rounded-lg bg-surface-container-highest text-on-surface hover:bg-surface-bright disabled:opacity-40 flex items-center gap-1 font-label-sm"
          title="Sonraki parçaya atla"
          onClick={() => void control('skip')}
        >
          <span className="material-symbols-outlined text-[20px]">skip_next</span>
          <span className="hidden sm:inline">Atla</span>
        </button>
        <button
          type="button"
          disabled={busy}
          className="h-9 px-space-sm rounded-lg bg-error/15 text-error hover:bg-error/25 disabled:opacity-40 flex items-center gap-1 font-label-sm"
          title="Çalmayı durdur ve kuyruğu temizle"
          onClick={() => void control('stop')}
        >
          <span className="material-symbols-outlined text-[20px]">stop</span>
          <span className="hidden sm:inline">Durdur</span>
        </button>
        {track?.url ? (
          <a
            href={track.url.startsWith('http') ? track.url : undefined}
            target="_blank"
            rel="noreferrer"
            className={`h-9 px-space-sm rounded-lg text-outline hover:bg-surface-bright flex items-center gap-1 font-label-sm ml-auto ${
              track.url.startsWith('http') ? '' : 'pointer-events-none opacity-40'
            }`}
            title="Kaynağı aç"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </a>
        ) : null}
      </div>

      <div className="px-space-sm sm:px-space-md pb-space-sm grid gap-space-xs sm:grid-cols-2 border-t border-surface-container-highest/80 pt-space-sm">
        <label className="flex items-center gap-space-sm min-w-0">
          <span className="font-label-sm text-outline shrink-0 w-16">Bot sesi</span>
          <input
            type="range"
            min={0}
            max={100}
            value={botVol}
            disabled={busy}
            className="flex-1 accent-primary-container"
            onChange={(e) => {
              const v = Number(e.target.value);
              setState((s) => (s ? { ...s, volume: v } : s));
            }}
            onMouseUp={(e) => {
              void control('volume', Number((e.target as HTMLInputElement).value));
            }}
            onTouchEnd={(e) => {
              void control('volume', Number((e.target as HTMLInputElement).value));
            }}
          />
          <span className="font-label-sm text-outline w-8 text-right tabular-nums">{botVol}</span>
        </label>
        <label className="flex items-center gap-space-sm min-w-0">
          <span className="font-label-sm text-outline shrink-0 w-16">Senin</span>
          <input
            type="range"
            min={0}
            max={100}
            value={localBotVol}
            className="flex-1 accent-secondary"
            onChange={(e) => {
              const v = Number(e.target.value);
              setLocalBotVol(v);
              voice.setParticipantVolume(DRACORD_BOT_USER_ID, v);
            }}
          />
          <span className="font-label-sm text-outline w-8 text-right tabular-nums">{localBotVol}</span>
        </label>
      </div>

      {state && state.queue.length > 0 && (
        <p className="px-space-md pb-space-sm font-label-sm text-outline truncate">
          Sıradaki: {state.queue[0]?.title}
          {state.queue.length > 1 ? ` (+${state.queue.length - 1})` : ''}
        </p>
      )}
    </div>
  );
}
