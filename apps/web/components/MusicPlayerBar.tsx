'use client';

import type { MusicQueueState } from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import { VolumeSlider } from '@dracord/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useVoiceSession } from '@/components/VoiceSessionProvider';
import { loadMusicBotVolume, saveMusicBotVolume } from '@/lib/participant-volumes';

type Props = {
  guildId: string;
  textChannelId?: string | null;
  variant?: 'chat' | 'stage';
};

const SIZE_KEY = 'dracord:music-bar-size';

function formatDuration(sec?: number | null) {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return null;
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function loadExpanded(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = localStorage.getItem(SIZE_KEY);
    if (v === 'compact') return false;
    return true;
  } catch {
    return true;
  }
}

export function MusicPlayerBar({ guildId, textChannelId, variant = 'chat' }: Props) {
  const { client } = useAuth();
  const voice = useVoiceSession();
  const voiceChannelId = voice.voiceChannelId;
  const [state, setState] = useState<MusicQueueState | null>(null);
  const [localBotVol, setLocalBotVol] = useState(() =>
    voice.getParticipantVolume(DRACORD_BOT_USER_ID),
  );
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const appliedServerVolRef = useRef<string | null>(null);

  useEffect(() => {
    setExpanded(loadExpanded());
  }, []);

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
      appliedServerVolRef.current = null;
      return;
    }
    void refresh();
    const t = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(t);
  }, [voiceChannelId, refresh]);

  useEffect(() => {
    setLocalBotVol(voice.getParticipantVolume(DRACORD_BOT_USER_ID));
  }, [voice, voiceChannelId, botInVoice]);

  const control = useCallback(
    async (
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
    },
    [client, guildId, voiceChannelId, textChannelId, refresh],
  );

  useEffect(() => {
    if (!voiceChannelId || !state) return;
    if (appliedServerVolRef.current === voiceChannelId) return;
    appliedServerVolRef.current = voiceChannelId;
    const pref = loadMusicBotVolume();
    if (pref == null) return;
    if (pref === state.volume) return;
    void control('volume', pref);
  }, [voiceChannelId, state, control]);

  const toggleSize = () => {
    setExpanded((v) => {
      const next = !v;
      try {
        localStorage.setItem(SIZE_KEY, next ? 'expanded' : 'compact');
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (!voiceChannelId || (!state?.nowPlaying && !botInVoice)) return null;

  const track = state?.nowPlaying;
  const paused = Boolean(state?.paused);
  const botVol = state?.volume ?? loadMusicBotVolume() ?? 80;
  const duration = formatDuration(track?.durationSec);
  const thumb = track?.thumbnailUrl;

  if (!expanded) {
    return (
      <div
        className={
          variant === 'stage'
            ? 'shrink-0 mx-space-md mb-space-sm rounded-lg border border-surface-container-highest bg-surface-container-high px-space-sm py-1.5 flex flex-col gap-1.5 min-h-10'
            : 'shrink-0 mx-space-md mb-space-sm rounded-lg border border-primary-container/30 bg-surface-container-high px-space-sm py-1.5 flex flex-col gap-1.5 min-h-10'
        }
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            disabled={busy || !track}
            className="w-8 h-8 rounded-md bg-primary-container text-on-primary-container disabled:opacity-40 flex items-center justify-center shrink-0"
            onClick={() => void control(paused ? 'resume' : 'pause')}
            aria-label={paused ? 'Oynat' : 'Duraklat'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {paused ? 'play_arrow' : 'pause'}
            </span>
          </button>
          <button
            type="button"
            disabled={busy || !track}
            className="w-8 h-8 rounded-md bg-surface-container-highest text-on-surface disabled:opacity-40 flex items-center justify-center shrink-0"
            onClick={() => void control('skip')}
            aria-label="Atla"
          >
            <span className="material-symbols-outlined text-[18px]">skip_next</span>
          </button>
          <button
            type="button"
            disabled={busy}
            className="w-8 h-8 rounded-md bg-error/15 text-error disabled:opacity-40 flex items-center justify-center shrink-0"
            onClick={() => void control('stop')}
            aria-label="Durdur"
          >
            <span className="material-symbols-outlined text-[18px]">stop</span>
          </button>
          <p className="font-body-sm text-on-surface truncate flex-1 min-w-0">
            {track?.title ?? 'Dracord-Bot'}
          </p>
          <button
            type="button"
            className="w-8 h-8 rounded-md text-outline hover:bg-surface-bright flex items-center justify-center shrink-0"
            onClick={toggleSize}
            aria-label="Büyüt"
            title="Genişlet"
          >
            <span className="material-symbols-outlined text-[18px]">unfold_more</span>
          </button>
        </div>
        <div className="flex items-center gap-2 min-w-0 px-0.5">
          <label className="flex items-center gap-1 flex-1 min-w-0" title="Bot sunucu sesi">
            <span className="material-symbols-outlined text-[14px] text-primary-container shrink-0">
              smart_toy
            </span>
            <VolumeSlider
              value={botVol}
              disabled={busy}
              tone="primary"
              aria-label="Bot sesi"
              onChange={(v) => setState((s) => (s ? { ...s, volume: v } : s))}
              onCommit={(v) => {
                saveMusicBotVolume(v);
                void control('volume', v);
              }}
            />
          </label>
          <label className="flex items-center gap-1 flex-1 min-w-0" title="Senin (yerel)">
            <span className="material-symbols-outlined text-[14px] text-outline shrink-0">
              headphones
            </span>
            <VolumeSlider
              value={localBotVol}
              tone="secondary"
              aria-label="Senin sesin"
              onChange={(v) => {
                setLocalBotVol(v);
                voice.setParticipantVolume(DRACORD_BOT_USER_ID, v);
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        variant === 'stage'
          ? 'shrink-0 mx-space-md mb-space-sm rounded-xl border border-surface-container-highest bg-surface-container-high px-space-md py-space-sm shadow-bar'
          : 'shrink-0 mx-space-md mb-space-sm rounded-xl border border-primary-container/30 bg-surface-container-high overflow-hidden shadow-bar'
      }
    >
      <div className="flex items-start justify-between gap-2 px-space-sm pt-space-sm">
        <div className="flex gap-space-sm min-w-0 flex-1 p-space-sm sm:p-space-md pt-0">
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
                    state && state.queue.length > 0 ? `Kuyruk: ${state.queue.length}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'Parça bekleniyor'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="w-8 h-8 rounded-md text-outline hover:bg-surface-bright flex items-center justify-center shrink-0 mt-1"
          onClick={toggleSize}
          aria-label="Küçült"
          title="İnce çubuk"
        >
          <span className="material-symbols-outlined text-[18px]">unfold_less</span>
        </button>
      </div>

      <div className="px-space-sm sm:px-space-md pb-space-sm flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy || !track}
          className="h-9 px-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-40 flex items-center gap-1 font-label-sm"
          onClick={() => void control(paused ? 'resume' : 'pause')}
        >
          <span className="material-symbols-outlined text-[20px]">
            {paused ? 'play_arrow' : 'pause'}
          </span>
          <span className="hidden sm:inline">{paused ? 'Oynat' : 'Duraklat'}</span>
        </button>
        <button
          type="button"
          disabled={busy || !track}
          className="h-9 px-space-sm rounded-lg bg-surface-container-highest text-on-surface hover:bg-surface-bright disabled:opacity-40 flex items-center gap-1 font-label-sm"
          onClick={() => void control('skip')}
        >
          <span className="material-symbols-outlined text-[20px]">skip_next</span>
          <span className="hidden sm:inline">Atla</span>
        </button>
        <button
          type="button"
          disabled={busy}
          className="h-9 px-space-sm rounded-lg bg-error/15 text-error hover:bg-error/25 disabled:opacity-40 flex items-center gap-1 font-label-sm"
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
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </a>
        ) : null}
      </div>

      <div className="px-space-sm sm:px-space-md pb-space-sm grid gap-space-sm sm:grid-cols-2 border-t border-surface-container-highest/80 pt-space-sm">
        <label className="flex items-center gap-space-sm min-w-0">
          <span className="font-label-sm text-outline shrink-0 w-16">Bot sesi</span>
          <VolumeSlider
            value={botVol}
            disabled={busy}
            tone="primary"
            aria-label="Bot sunucu ses seviyesi"
            onChange={(v) => {
              setState((s) => (s ? { ...s, volume: v } : s));
            }}
            onCommit={(v) => {
              saveMusicBotVolume(v);
              void control('volume', v);
            }}
          />
          <span className="font-label-sm text-outline w-8 text-right tabular-nums">{botVol}</span>
        </label>
        <label className="flex items-center gap-space-sm min-w-0">
          <span className="font-label-sm text-outline shrink-0 w-16">Senin</span>
          <VolumeSlider
            value={localBotVol}
            tone="secondary"
            aria-label="Bot yerel ses seviyesi"
            onChange={(v) => {
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
