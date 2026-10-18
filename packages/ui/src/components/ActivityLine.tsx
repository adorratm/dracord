'use client';

import type { UserActivity } from '@dracord/types';
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cn } from '../lib/cn';
import { openActivityUrl } from '../lib/open-activity-url';
import { activityLineTr } from '../lib/presence';

const MARQUEE_STYLE_ID = 'dracord-activity-marquee-css';

function ensureMarqueeCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(MARQUEE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = MARQUEE_STYLE_ID;
  style.textContent = `
@keyframes dracord-activity-marquee {
  0% { transform: translateX(0); }
  15% { transform: translateX(0); }
  85% { transform: translateX(var(--marquee-shift, -50%)); }
  100% { transform: translateX(var(--marquee-shift, -50%)); }
}
.dracord-activity-marquee-run {
  animation: dracord-activity-marquee var(--marquee-duration, 8s) linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .dracord-activity-marquee-run { animation: none !important; }
}
`;
  document.head.appendChild(style);
}

function MarqueeText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useLayoutEffect(() => {
    ensureMarqueeCss();
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const overflow = inner.scrollWidth - outer.clientWidth;
      setShift(overflow > 4 ? overflow : 0);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(outer);
    return () => ro?.disconnect();
  }, [text]);

  const durationSec = Math.max(6, Math.min(18, shift / 28));

  return (
    <span ref={outerRef} className={cn('min-w-0 flex-1 overflow-hidden', className)}>
      <span
        ref={innerRef}
        className={cn(
          'inline-block whitespace-nowrap max-w-none',
          shift > 0 && 'dracord-activity-marquee-run',
        )}
        style={
          shift > 0
            ? ({
                '--marquee-shift': `-${shift}px`,
                '--marquee-duration': `${durationSec}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {text}
      </span>
    </span>
  );
}

function onActivityLinkClick(url: string, e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  openActivityUrl(url);
}

const IMAGE_BOX: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-4 h-4 rounded', // üye listesi
  md: 'w-7 h-7 rounded-md', // arkadaş satırı
  lg: 'w-12 h-12 rounded-lg', // hover kart
};

/** Üye listesi / hover / arkadaş — kapak + kayan yazı + Spotify/Steam link */
export function ActivityLine({
  activity,
  className,
  textClassName,
  size = 'sm',
  linkable = true,
  showImage = true,
}: {
  activity?: UserActivity | null;
  className?: string;
  textClassName?: string;
  /** sm: liste, md: arkadaş, lg: hover / popover */
  size?: 'sm' | 'md' | 'lg';
  /** url varsa tıklanınca aç (Spotify / Steam mağaza) */
  linkable?: boolean;
  /** Kapak/logo (profilde büyük görsel varken kapat) */
  showImage?: boolean;
}) {
  const line = activityLineTr(activity);
  if (!line || !activity) return null;
  const box = IMAGE_BOX[size];
  const url = linkable ? activity.url?.trim() || null : null;
  const title =
    activity.source === 'spotify'
      ? 'Spotify’da aç'
      : activity.source === 'desktop'
        ? 'Oyunu aç'
        : 'Bağlantıyı aç';
  const iconPx = size === 'lg' ? 'text-[16px]' : 'text-[12px]';
  const gap = size === 'lg' ? 'gap-2.5' : size === 'md' ? 'gap-1.5' : 'gap-1';

  const body: ReactNode = (
    <>
      {showImage && activity.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={activity.imageUrl}
          alt=""
          className={cn(box, 'object-cover shrink-0 bg-surface-container shadow-sm')}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <MarqueeText text={line} className={textClassName} />
      {url ? (
        <span
          className={cn('material-symbols-outlined shrink-0 opacity-70', iconPx)}
          aria-hidden
        >
          {activity.source === 'spotify' ? 'open_in_new' : 'link'}
        </span>
      ) : null}
    </>
  );

  const sharedClass = cn(
    'inline-flex items-center min-w-0 max-w-full',
    gap,
    url && 'hover:opacity-90 cursor-pointer',
    className,
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        title={title}
        className={sharedClass}
        onClick={(e) => onActivityLinkClick(url, e)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {body}
      </a>
    );
  }

  return <span className={sharedClass}>{body}</span>;
}
