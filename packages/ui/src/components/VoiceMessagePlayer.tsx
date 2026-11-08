'use client';

import { useEffect, useRef, useState } from 'react';
import type { MessageAttachment } from '@dracord/types';
import { cn } from '../lib/cn';
import { formatVoiceDuration } from '../lib/use-voice-recorder';

const SPEEDS = [1, 1.5, 2] as const;

/** Sesli mesaj oynatıcı — dalga formu, sarma, hız */
export function VoiceMessagePlayer({ attachment, className }: { attachment: MessageAttachment; className?: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(attachment.durationSec ?? 0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const bars = attachment.waveform?.length ? attachment.waveform : new Array(48).fill(60);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime);
    const onMeta = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) setDur(a.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setPos(0);
    };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', () => setPlaying(false));
    a.addEventListener('play', () => setPlaying(true));
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => undefined);
    else a.pause();
  };
  const progress = dur > 0 ? pos / dur : 0;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl bg-surface-container-high px-2 py-1.5 max-w-sm w-full',
        className,
      )}
    >
      <audio ref={audio} src={attachment.url} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className="h-9 w-9 shrink-0 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center"
        aria-label={playing ? 'Duraklat' : 'Oynat'}
      >
        <span className="material-symbols-outlined text-[22px]">{playing ? 'pause' : 'play_arrow'}</span>
      </button>
      <div
        className="flex-1 h-8 flex items-center gap-[2px] cursor-pointer min-w-0"
        role="slider"
        tabIndex={0}
        aria-label="Sesli mesaj konumu"
        aria-valuemin={0}
        aria-valuemax={Math.round(dur)}
        aria-valuenow={Math.round(pos)}
        onKeyDown={(e) => {
          const a = audio.current;
          if (!a || !dur) return;
          if (e.key === 'ArrowRight') a.currentTime = Math.min(dur, a.currentTime + 5);
          if (e.key === 'ArrowLeft') a.currentTime = Math.max(0, a.currentTime - 5);
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggle();
          }
        }}
        onClick={(e) => {
          const a = audio.current;
          if (!a || !dur) return;
          const r = e.currentTarget.getBoundingClientRect();
          a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
          setPos(a.currentTime);
        }}
      >
        {bars.map((v, i) => (
          <span
            key={i}
            className={cn(
              'flex-1 rounded-full transition-colors',
              i / bars.length < progress ? 'bg-primary-container' : 'bg-outline/50',
            )}
            style={{ height: `${Math.max(12, (v / 255) * 100)}%` }}
          />
        ))}
      </div>
      <span className="font-label-sm text-on-surface-variant tabular-nums w-10 text-right shrink-0">
        {formatVoiceDuration(playing || pos > 0 ? pos : dur)}
      </span>
      <button
        type="button"
        onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]!)}
        className="h-7 px-1.5 shrink-0 rounded-md font-label-sm text-on-surface-variant hover:bg-surface-container-highest tabular-nums"
        aria-label="Oynatma hızı"
      >
        {speed}×
      </button>
    </div>
  );
}
