'use client';

import { cn } from '../lib/cn';

export interface VolumeSliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Sürükleme bitince (opsiyonel) */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  /** Track dolu kısım rengi */
  tone?: 'primary' | 'secondary' | 'neutral';
  /** compact satırlar için ince slider */
  size?: 'sm' | 'md';
  'aria-label'?: string;
}

const TONE_FILL: Record<NonNullable<VolumeSliderProps['tone']>, string> = {
  primary: 'bg-primary-container',
  secondary: 'bg-secondary',
  neutral: 'bg-on-surface-variant',
};

const TONE_THUMB: Record<NonNullable<VolumeSliderProps['tone']>, string> = {
  primary: 'bg-primary-container border-on-primary-container/20',
  secondary: 'bg-secondary border-on-secondary/20',
  neutral: 'bg-on-surface border-surface-container-highest',
};

/**
 * Geniş dokunma alanı (~32px) + görünür track/thumb.
 * Native range şeffaf hit-layer olarak üstte.
 */
export function VolumeSlider({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
  tone = 'primary',
  size = 'md',
  'aria-label': ariaLabel,
}: VolumeSliderProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const pct = max === min ? 0 : ((clamped - min) / (max - min)) * 100;
  const compact = size === 'sm';

  return (
    <div
      className={cn(
        'relative flex items-center flex-1 min-w-0 select-none',
        compact ? 'h-5' : 'h-8',
        disabled && 'opacity-40 pointer-events-none',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-x-0 rounded-full bg-surface-container-highest pointer-events-none overflow-hidden',
          compact ? 'h-1' : 'h-2',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-75', TONE_FILL[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 shadow-sm pointer-events-none',
          compact ? 'h-2.5 w-2.5' : 'h-4 w-4',
          TONE_THUMB[tone],
        )}
        style={{ left: `${pct}%` }}
        aria-hidden
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        aria-label={ariaLabel}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
            onCommit?.(Number((e.target as HTMLInputElement).value));
          }
        }}
      />
    </div>
  );
}
