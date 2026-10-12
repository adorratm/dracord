'use client';

import { useEffect, useState } from 'react';
import { cn } from '@dracord/ui';
import {
  getGameAudioVolume,
  isGameAudioMuted,
  setGameAudioMuted,
  setGameAudioVolume,
  unlockGameAudio,
} from '@/lib/game-audio';

/** Oyun FX + kurpiyer TTS: aç/kapa + seviye */
export function GameSoundControls({ className }: { className?: string }) {
  const [muted, setMuted] = useState(false);
  const [vol, setVol] = useState(85);

  useEffect(() => {
    setMuted(isGameAudioMuted());
    setVol(Math.round(getGameAudioVolume() * 100));
  }, []);

  const toggleMute = () => {
    unlockGameAudio();
    const next = !muted;
    setGameAudioMuted(next);
    setMuted(next);
  };

  const onVol = (raw: number) => {
    unlockGameAudio();
    const v = Math.min(100, Math.max(0, raw));
    setVol(v);
    setGameAudioVolume(v / 100);
    if (v > 0 && muted) {
      setGameAudioMuted(false);
      setMuted(false);
    }
  };

  return (
    <div
      className={cn(
        'pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-[#bd93f9]/35 bg-[#11131e]/90 px-2 py-1.5 shadow-lg backdrop-blur-md',
        className,
      )}
    >
      <button
        type="button"
        onClick={toggleMute}
        title={muted ? 'Sesi aç' : 'Sesi kapat'}
        aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[18px] transition',
          muted
            ? 'bg-[#ff5555]/20 text-[#ff5555]'
            : 'bg-[#bd93f9]/15 text-[#bd93f9] hover:bg-[#bd93f9]/25',
        )}
      >
        <span className="material-symbols-outlined text-[20px]">
          {muted || vol === 0 ? 'volume_off' : vol < 40 ? 'volume_down' : 'volume_up'}
        </span>
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={muted ? 0 : vol}
        disabled={muted}
        onChange={(e) => onVol(Number(e.target.value))}
        aria-label="Ses seviyesi"
        title={`Ses: ${muted ? 0 : vol}%`}
        className={cn(
          'h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-[#44307a] accent-[#bd93f9] sm:w-28',
          muted && 'opacity-40',
        )}
      />
      <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-[#f8f8f2]/70">
        {muted ? 'Kapalı' : `${vol}%`}
      </span>
    </div>
  );
}
