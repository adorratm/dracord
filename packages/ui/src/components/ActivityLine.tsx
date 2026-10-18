'use client';

import type { UserActivity } from '@dracord/types';
import { cn } from '../lib/cn';
import { activityLineTr } from '../lib/presence';

/** Üye listesi / hover / arkadaş satırı — metin + küçük kapak/logo */
export function ActivityLine({
  activity,
  className,
  textClassName,
  size = 'sm',
}: {
  activity?: UserActivity | null;
  className?: string;
  textClassName?: string;
  /** sm: üye listesi (14px), md: hover/arkadaş (18px) */
  size?: 'sm' | 'md';
}) {
  const line = activityLineTr(activity);
  if (!line) return null;
  const box = size === 'md' ? 'w-[18px] h-[18px]' : 'w-3.5 h-3.5';
  return (
    <span className={cn('inline-flex items-center gap-1 min-w-0 max-w-full', className)}>
      {activity?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activity.imageUrl}
          alt=""
          className={cn(box, 'rounded-sm object-cover shrink-0 bg-surface-container')}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span className={cn('truncate', textClassName)}>{line}</span>
    </span>
  );
}
