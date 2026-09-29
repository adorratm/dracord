'use client';

import type { MessageEmbed } from '@dracord/types';
import { useState } from 'react';
import { cn } from '../lib/cn';

export interface MessageEmbedViewProps {
  embed: MessageEmbed;
  censored?: boolean;
  className?: string;
}

export function MessageEmbedView({ embed, censored = false, className }: MessageEmbedViewProps) {
  const [revealed, setRevealed] = useState(false);
  const showContent = !censored || revealed;

  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'mt-space-sm max-w-md block rounded-lg border-l-4 border-primary-container bg-surface-container-low overflow-hidden hover:bg-surface-container transition-colors',
        className,
      )}
      onClick={(e) => {
        if (censored && !revealed) {
          e.preventDefault();
          setRevealed(true);
        }
      }}
    >
      <div className="p-space-sm flex flex-col gap-1 min-w-0">
        {embed.siteName && (
          <p className="font-label-sm text-outline truncate">{embed.siteName}</p>
        )}
        <p className="font-headline-md text-primary-container truncate">
          {embed.title ?? embed.url}
        </p>
        {embed.description && showContent && (
          <p className="font-body-sm text-on-surface-variant line-clamp-3">{embed.description}</p>
        )}
        {censored && !revealed && (
          <p className="font-label-sm text-outline">Sansürlü önizleme · göstermek için tıkla</p>
        )}
      </div>
      {embed.imageUrl && (
        <div className="relative max-h-56 overflow-hidden bg-surface-container-highest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={embed.imageUrl}
            alt=""
            className={cn(
              'w-full max-h-56 object-cover',
              !showContent && 'blur-xl scale-105',
            )}
          />
          {!showContent && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <span className="font-label-md text-white px-space-sm py-1 rounded-lg bg-black/50">
                Önizlemeyi göster
              </span>
            </div>
          )}
        </div>
      )}
    </a>
  );
}
