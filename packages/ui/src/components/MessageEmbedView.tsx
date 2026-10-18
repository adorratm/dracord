'use client';

import type { MessageEmbed, MessageEmbedAction } from '@dracord/types';
import { useState } from 'react';
import { cn } from '../lib/cn';

export interface MessageEmbedViewProps {
  embed: MessageEmbed;
  censored?: boolean;
  className?: string;
  onAction?: (action: MessageEmbedAction, embed: MessageEmbed) => void;
}

function isHttpUrl(s: string | null | undefined): boolean {
  return Boolean(s && /^https?:\/\//i.test(s.trim()));
}

function safeOpenUrl(raw: string | null | undefined, title?: string | null): string | null {
  if (isHttpUrl(raw)) return raw!.trim();
  const q = (raw || title || '').replace(/^ytsearch\d*:/i, '').trim();
  if (!q) return null;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function MessageEmbedView({
  embed,
  censored = false,
  className,
  onAction,
}: MessageEmbedViewProps) {
  const [revealed, setRevealed] = useState(false);
  const showContent = !censored || revealed;
  const actions = embed.actions ?? [];
  const embedHref = safeOpenUrl(embed.url, embed.title);

  return (
    <div
      className={cn(
        'mt-space-sm max-w-md rounded-lg border-l-4 border-primary-container bg-surface-container-low overflow-hidden',
        className,
      )}
    >
      <a
        href={embedHref ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-surface-container transition-colors"
        onClick={(e) => {
          if (censored && !revealed) {
            e.preventDefault();
            setRevealed(true);
            return;
          }
          if (!embedHref) e.preventDefault();
        }}
      >
        <div className="p-space-sm flex gap-3 min-w-0">
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            {embed.siteName && (
              <p className="font-label-sm text-outline truncate">{embed.siteName}</p>
            )}
            <p className="font-headline-md text-primary-container line-clamp-2">
              {embed.title || embed.siteName || 'Bağlantı'}
            </p>
            {embed.description && showContent && (
              <p className="font-body-sm text-on-surface-variant line-clamp-3">
                {embed.description}
              </p>
            )}
            {censored && !revealed && (
              <p className="font-label-sm text-outline">
                Sansürlü önizleme · göstermek için tıkla
              </p>
            )}
          </div>
          {embed.imageUrl && (
            <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden bg-surface-container-highest">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={embed.imageUrl}
                alt=""
                className={cn(
                  'w-full h-full object-cover',
                  !showContent && 'blur-xl scale-105',
                )}
              />
            </div>
          )}
        </div>
      </a>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-space-sm pb-space-sm">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              className="min-h-10 px-2.5 rounded-md bg-surface-container-highest hover:bg-surface-bright text-on-surface font-label-sm inline-flex items-center gap-1.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // replay / lyrics her zaman parent’a; open yalnızca http(s)
                if (a.action === 'replay' || a.action === 'lyrics') {
                  onAction?.(a, embed);
                  return;
                }
                if (a.action === 'open' || !a.action) {
                  const href = safeOpenUrl(a.url || embed.url, embed.title);
                  if (href) window.open(href, '_blank', 'noopener,noreferrer');
                  onAction?.(a, embed);
                  return;
                }
                onAction?.(a, embed);
              }}
            >
              <span className="material-symbols-outlined text-[16px]">
                {a.action === 'replay'
                  ? 'replay'
                  : a.action === 'lyrics'
                    ? 'lyrics'
                    : 'open_in_new'}
              </span>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
