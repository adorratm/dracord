'use client';

import type { SocialLinks } from '@dracord/types';
import { cn } from '../lib/cn';

export type SocialLinkKey = keyof SocialLinks;

const SOCIAL_META: Record<
  SocialLinkKey,
  { label: string; icon: string; href: (v: string) => string }
> = {
  website: {
    label: 'Website',
    icon: 'language',
    href: (v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`),
  },
  twitter: {
    label: 'X / Twitter',
    icon: 'alternate_email',
    href: (v) =>
      v.startsWith('http') ? v : `https://x.com/${v.replace(/^@/, '')}`,
  },
  github: {
    label: 'GitHub',
    icon: 'code',
    href: (v) => (v.startsWith('http') ? v : `https://github.com/${v.replace(/^@/, '')}`),
  },
  discord: {
    label: 'Discord',
    icon: 'forum',
    href: (v) => (v.startsWith('http') ? v : `https://discord.com/users/${v}`),
  },
  youtube: {
    label: 'YouTube',
    icon: 'play_circle',
    href: (v) =>
      v.startsWith('http') ? v : `https://youtube.com/@${v.replace(/^@/, '')}`,
  },
  instagram: {
    label: 'Instagram',
    icon: 'photo_camera',
    href: (v) =>
      v.startsWith('http') ? v : `https://instagram.com/${v.replace(/^@/, '')}`,
  },
  twitch: {
    label: 'Twitch',
    icon: 'live_tv',
    href: (v) =>
      v.startsWith('http') ? v : `https://twitch.tv/${v.replace(/^@/, '')}`,
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'work',
    href: (v) => (v.startsWith('http') ? v : `https://linkedin.com/in/${v}`),
  },
  steam: {
    label: 'Steam',
    icon: 'sports_esports',
    href: (v) =>
      v.startsWith('http') ? v : `https://steamcommunity.com/id/${v}`,
  },
  spotify: {
    label: 'Spotify',
    icon: 'music_note',
    href: (v) =>
      v.startsWith('http') ? v : `https://open.spotify.com/user/${v}`,
  },
  tiktok: {
    label: 'TikTok',
    icon: 'movie',
    href: (v) =>
      v.startsWith('http') ? v : `https://tiktok.com/@${v.replace(/^@/, '')}`,
  },
  facebook: {
    label: 'Facebook',
    icon: 'public',
    href: (v) => (v.startsWith('http') ? v : `https://facebook.com/${v}`),
  },
};

export const SOCIAL_LINK_KEYS = Object.keys(SOCIAL_META) as SocialLinkKey[];

export function socialEntries(links?: SocialLinks | null): Array<{
  key: SocialLinkKey;
  label: string;
  icon: string;
  href: string;
  value: string;
}> {
  if (!links) return [];
  const out: Array<{
    key: SocialLinkKey;
    label: string;
    icon: string;
    href: string;
    value: string;
  }> = [];
  for (const key of SOCIAL_LINK_KEYS) {
    const value = links[key]?.trim();
    if (!value) continue;
    const meta = SOCIAL_META[key];
    out.push({
      key,
      label: meta.label,
      icon: meta.icon,
      href: meta.href(value),
      value,
    });
  }
  return out;
}

export function SocialLinksRow({
  links,
  className,
  size = 'md',
}: {
  links?: SocialLinks | null;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const entries = socialEntries(links);
  if (entries.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {entries.map((e) => (
        <a
          key={e.key}
          href={e.href}
          target="_blank"
          rel="noopener noreferrer"
          title={e.label}
          className={cn(
            'inline-flex items-center gap-1 rounded-full bg-surface-container-highest text-on-surface hover:bg-primary-container hover:text-on-primary-container transition-colors',
            size === 'sm' ? 'h-7 px-2' : 'h-8 px-2.5',
          )}
          onClick={(ev) => ev.stopPropagation()}
        >
          <span
            className="material-symbols-outlined leading-none"
            style={{ fontSize: size === 'sm' ? 16 : 18 }}
          >
            {e.icon}
          </span>
          <span className={cn('font-label-sm truncate max-w-[7rem]', size === 'sm' && 'text-[11px]')}>
            {e.label}
          </span>
        </a>
      ))}
    </div>
  );
}
