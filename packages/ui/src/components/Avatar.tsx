'use client';

import type { PresenceStatus } from '@dracord/types';
import { cn } from '../lib/cn';
import { presenceDotClass } from '../lib/presence';

export interface AvatarProps {
  displayName: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  status?: PresenceStatus;
  statusRing?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { box: 'w-5 h-5', text: 'text-[10px]', dot: 'w-2 h-2 ring-1' },
  md: { box: 'w-8 h-8', text: 'text-headline-md', dot: 'w-2.5 h-2.5 ring-2' },
  lg: { box: 'w-12 h-12', text: 'text-headline-lg', dot: 'w-3 h-3 ring-2' },
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  displayName,
  imageUrl,
  size = 'md',
  status,
  statusRing = true,
  className,
}: AvatarProps) {
  const s = sizeMap[size];

  return (
    <div className={cn('relative shrink-0', className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className={cn(s.box, 'rounded-full object-cover bg-surface-container-high')}
        />
      ) : (
        <div
          className={cn(
            s.box,
            'rounded-full bg-secondary-container flex items-center justify-center font-headline-md text-on-secondary-container',
            s.text,
          )}
        >
          {initialsFromName(displayName)}
        </div>
      )}
      {status && statusRing && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-surface-container-lowest',
            s.dot,
            presenceDotClass(status),
          )}
          aria-hidden
        />
      )}
    </div>
  );
}
