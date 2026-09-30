'use client';

import type { MemberRoleSummary, PresenceStatus, RoleProfileBgKey, SocialLinks } from '@dracord/types';
import { useEffect } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { RoleBadge, ROLE_BADGE_STYLES } from './RoleBadge';
import { SocialLinksRow } from './SocialLinksRow';
import { presenceLabelTr } from '../lib/presence';

export interface UserProfileCardProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    displayName: string;
    username?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bannerColor?: string | null;
    bio?: string | null;
    status?: PresenceStatus;
    isBot?: boolean;
    roles?: MemberRoleSummary[];
    socialLinks?: SocialLinks | null;
  };
  actions?: Array<{ id: string; label: string; danger?: boolean; onClick: () => void }>;
}

function pickBg(roles?: MemberRoleSummary[]): RoleProfileBgKey {
  const withBg = (roles ?? [])
    .filter((r) => r.profileBgKey && r.profileBgKey !== 'none')
    .sort((a, b) => b.position - a.position)[0];
  return (withBg?.profileBgKey as RoleProfileBgKey) || 'none';
}

export function UserProfileCard({ open, onClose, user, actions = [] }: UserProfileCardProps) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('dracord-role-badge-styles')) return;
    const el = document.createElement('style');
    el.id = 'dracord-role-badge-styles';
    el.textContent = ROLE_BADGE_STYLES;
    document.head.appendChild(el);
  }, []);

  if (!open) return null;

  const bgKey = pickBg(user.roles);
  const topRoles = (user.roles ?? [])
    .filter((r) => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)
    .slice(0, 6);
  const bannerStyle = user.bannerUrl
    ? { backgroundImage: `url(${user.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : user.bannerColor
      ? { backgroundColor: user.bannerColor }
      : undefined;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-space-md">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Kapat" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={user.displayName}
        className="relative w-full max-w-sm rounded-2xl bg-surface-container-low border border-surface-container-high shadow-float overflow-hidden dracord-fade-in"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-8 h-8 rounded-lg bg-black/35 text-white flex items-center justify-center hover:bg-black/50"
          aria-label="Kapat"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div
          className={cn(
            'h-28 w-full profile-bg',
            !user.bannerUrl && bgKey !== 'none' && `profile-bg--${bgKey}`,
            !user.bannerUrl && bgKey === 'none' && !user.bannerColor && 'bg-surface-container-highest',
          )}
          style={bannerStyle}
        />

        <div className="px-space-lg pb-space-lg -mt-10 relative">
          <div className="flex items-end gap-space-md">
            <div className="rounded-full ring-4 ring-surface-container-low bg-surface-container-low">
              <Avatar
                displayName={user.displayName}
                imageUrl={user.avatarUrl}
                size="lg"
                status={user.status}
              />
            </div>
            <div className="flex flex-wrap gap-1 pb-1 min-w-0">
              {user.isBot && (
                <span className="h-5 px-1.5 rounded bg-primary text-on-primary text-[10px] font-bold uppercase flex items-center">
                  Bot
                </span>
              )}
              {topRoles.map((r) => (
                <RoleBadge key={r.id} badgeKey={r.badgeKey} color={r.color} label={r.name} size="sm" />
              ))}
            </div>
          </div>

          <div className="mt-space-md rounded-xl bg-surface-container-lowest/90 border border-surface-container-highest p-space-md">
            <p className="font-headline-md text-headline-md text-on-surface">{user.displayName}</p>
            {user.username && (
              <p className="font-body-sm text-on-surface-variant">@{user.username}</p>
            )}
            {user.status && (
              <p className="mt-1 font-label-sm text-outline">{presenceLabelTr(user.status)}</p>
            )}
            {user.bio && (
              <p className="mt-space-sm font-body-sm text-on-surface-variant whitespace-pre-wrap">
                {user.bio}
              </p>
            )}
            <SocialLinksRow links={user.socialLinks} className="mt-space-sm" />
            {topRoles.length > 0 && (
              <div className="mt-space-md">
                <p className="font-label-sm text-outline uppercase tracking-wider mb-space-xs">Roller</p>
                <div className="flex flex-wrap gap-1.5">
                  {topRoles.map((r) => (
                    <span
                      key={`chip-${r.id}`}
                      className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-semibold text-white"
                      style={{ backgroundColor: r.color }}
                    >
                      {r.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {actions.length > 0 && (
            <div className="mt-space-md flex flex-col gap-space-xs">
              {actions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    a.onClick();
                    onClose();
                  }}
                  className={cn(
                    'h-10 rounded-lg font-label-sm text-left px-space-md transition-colors',
                    a.danger
                      ? 'bg-error-container/30 text-error hover:bg-error-container/50'
                      : 'bg-surface-container-high text-on-surface hover:bg-surface-bright',
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
