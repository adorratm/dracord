'use client';

import type {
  MemberRoleSummary,
  PresenceStatus,
  RoleProfileBgKey,
  SocialLinks,
  UserActivity,
} from '@dracord/types';
import { useEffect } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { RoleBadge, ROLE_BADGE_STYLES } from './RoleBadge';
import { SocialLinksRow } from './SocialLinksRow';
import { ActivityLine } from './ActivityLine';
import { openActivityUrl } from '../lib/open-activity-url';
import { presenceLabelTr } from '../lib/presence';

export interface UserProfileCardProps {
  open: boolean;
  onClose: () => void;
  /** modal = ortada; popout = sol paneldan açılan Discord tarzı kart */
  variant?: 'modal' | 'popout';
  user: {
    id: string;
    displayName: string;
    username?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bannerColor?: string | null;
    accentColor?: string | null;
    bio?: string | null;
    status?: PresenceStatus;
    customStatus?: string | null;
    activity?: UserActivity | null;
    isBot?: boolean;
    roles?: MemberRoleSummary[];
    socialLinks?: SocialLinks | null;
  };
  actions?: Array<{ id: string; label: string; danger?: boolean; onClick: () => void }>;
  onJoinActivity?: (activity: UserActivity) => void;
}

function pickBg(roles?: MemberRoleSummary[]): RoleProfileBgKey {
  const withBg = (roles ?? [])
    .filter((r) => r.profileBgKey && r.profileBgKey !== 'none')
    .sort((a, b) => b.position - a.position)[0];
  return (withBg?.profileBgKey as RoleProfileBgKey) || 'none';
}

export function UserProfileCard({
  open,
  onClose,
  user,
  actions = [],
  variant = 'modal',
  onJoinActivity,
}: UserProfileCardProps) {
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
    .slice(0, 8);
  const accent = user.accentColor ?? user.bannerColor ?? undefined;
  const bannerStyle = user.bannerUrl
    ? { backgroundImage: `url(${user.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : user.bannerColor
    ? { backgroundColor: user.bannerColor }
    : accent
        ? { background: `linear-gradient(135deg, ${accent}99, ${accent}33)` }
        : undefined;

  const isPopout = variant === 'popout';

  return (
    <div
      className={cn(
        'fixed inset-0 z-[100] p-space-md',
        isPopout
          ? 'flex items-start justify-start md:pl-[calc(72px+18rem)] pt-16 md:pt-20'
          : 'flex items-center justify-center',
      )}
    >
      <button
        type="button"
        className={cn('absolute inset-0', isPopout ? 'bg-black/40' : 'bg-black/65')}
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={user.displayName}
        className={cn(
          'relative overflow-y-auto rounded-2xl bg-surface-container-low border border-surface-container-highest shadow-float dracord-fade-in',
          isPopout
            ? 'w-[min(100%,20rem)] max-h-[min(85vh,560px)]'
            : 'w-full max-w-lg max-h-[90vh]',
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-lg bg-black/40 text-white flex items-center justify-center hover:bg-black/55"
          aria-label="Kapat"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div
          className={cn(
            'h-44 w-full profile-bg',
            !user.bannerUrl && bgKey !== 'none' && `profile-bg--${bgKey}`,
            !user.bannerUrl && bgKey === 'none' && !user.bannerColor && !accent && 'bg-surface-container-highest',
          )}
          style={bannerStyle}
        />

        <div className="px-space-xl pb-space-xl -mt-14 relative">
          <div className="flex items-end gap-space-md flex-wrap">
            <div className="rounded-full ring-[6px] ring-surface-container-low bg-surface-container-low shadow-lg">
              <Avatar
                displayName={user.displayName}
                imageUrl={user.avatarUrl}
                size="xl"
                status={user.status}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 pb-2 min-w-0 flex-1">
              {user.isBot && (
                <span className="h-6 px-2 rounded bg-primary text-on-primary text-[11px] font-bold uppercase flex items-center">
                  Bot
                </span>
              )}
              {topRoles.map((r) => (
                <RoleBadge key={r.id} badgeKey={r.badgeKey} color={r.color} label={r.name} size="sm" />
              ))}
            </div>
          </div>

          <div className="mt-space-lg rounded-2xl bg-surface-container-lowest/95 border border-surface-container-highest p-space-lg">
            <p className="font-headline-lg text-headline-lg text-on-surface leading-tight">
              {user.displayName}
            </p>
            {user.username && (
              <p className="font-body-md text-on-surface-variant mt-0.5">@{user.username}</p>
            )}
            {user.status && (
              <p className="mt-2 font-label-md text-outline flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-current opacity-70" />
                {presenceLabelTr(user.status)}
                {user.customStatus ? ` · ${user.customStatus}` : ''}
              </p>
            )}
            {!user.status && user.customStatus && (
              <p className="mt-2 font-body-sm text-on-surface-variant">{user.customStatus}</p>
            )}
            {user.activity && (
              <div className="mt-3 flex items-start gap-3 rounded-xl bg-surface-container px-3 py-3 min-w-0">
                {user.activity.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.activity.imageUrl}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover shrink-0 shadow-sm"
                  />
                ) : (
                  <span className="material-symbols-outlined text-secondary text-[36px] shrink-0 w-20 h-20 flex items-center justify-center rounded-lg bg-surface-container-high">
                    {user.activity.type === 'listening'
                      ? 'headphones'
                      : user.activity.type === 'watching'
                        ? 'live_tv'
                        : 'sports_esports'}
                  </span>
                )}
                <div className="min-w-0 flex-1 self-center">
                  <ActivityLine
                    activity={user.activity}
                    size="md"
                    showImage={false}
                    className="font-label-md text-secondary w-full"
                    textClassName="font-label-md text-secondary"
                  />
                  {user.activity.details ? (
                    <p className="font-body-sm text-on-surface-variant truncate mt-0.5">
                      {user.activity.details}
                    </p>
                  ) : null}
                  {user.activity.join && onJoinActivity ? (
                    <button
                      type="button"
                      className="mt-1 font-label-sm text-primary-container hover:underline"
                      onClick={() => onJoinActivity(user.activity!)}
                    >
                      Katıl
                    </button>
                  ) : user.activity.url ? (
                    <a
                      href={user.activity.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block font-label-sm text-primary-container hover:underline"
                      onClick={(e) => {
                        e.preventDefault();
                        openActivityUrl(user.activity!.url!);
                      }}
                    >
                      {user.activity.source === 'spotify'
                        ? 'Spotify’da aç'
                        : user.activity.source === 'desktop'
                          ? 'Mağazada / sitede aç'
                          : 'Aç'}
                    </a>
                  ) : null}
                </div>
              </div>
            )}
            {user.bio && (
              <p className="mt-space-md font-body-md text-on-surface-variant whitespace-pre-wrap leading-relaxed">
                {user.bio}
              </p>
            )}
            <SocialLinksRow links={user.socialLinks} className="mt-space-md" />
            {topRoles.length > 0 && (
              <div className="mt-space-lg">
                <p className="font-label-sm text-outline uppercase tracking-wider mb-space-sm">
                  Roller
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topRoles.map((r) => (
                    <span
                      key={`chip-${r.id}`}
                      className="inline-flex items-center h-7 px-2.5 rounded-full text-[12px] font-semibold text-white"
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
                    'h-11 rounded-xl font-label-md text-left px-space-md transition-colors',
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
