'use client';

import type { MemberRoleSummary, PresenceStatus, SocialLinks } from '@dracord/types';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { SocialLinksRow } from './SocialLinksRow';
import { RoleBadge, ROLE_BADGE_STYLES } from './RoleBadge';
import { presenceLabelTr } from '../lib/presence';

export interface UserHoverCardUser {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
  bio?: string | null;
  status?: PresenceStatus;
  customStatus?: string | null;
  isBot?: boolean;
  socialLinks?: SocialLinks | null;
  roles?: MemberRoleSummary[];
}

const CARD_W = 288;
const GAP = 8;

export function UserHoverCard({
  user,
  children,
  className,
}: {
  user: UserHoverCardUser;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const tipId = useId();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('dracord-role-badge-styles')) return;
    const el = document.createElement('style');
    el.id = 'dracord-role-badge-styles';
    el.textContent = ROLE_BADGE_STYLES;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const place = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cardH = cardRef.current?.offsetHeight || 280;
    let x = rect.left;
    let y = rect.bottom + GAP;
    if (x + CARD_W > window.innerWidth - GAP) {
      x = Math.max(GAP, window.innerWidth - CARD_W - GAP);
    }
    if (x < GAP) x = GAP;
    // Prefer below; flip above if not enough room
    if (y + cardH > window.innerHeight - GAP) {
      y = Math.max(GAP, rect.top - cardH - GAP);
    }
    // Keep near the name horizontally: prefer aligning to left of anchor
    if (rect.right < CARD_W && rect.left > window.innerWidth / 2) {
      x = Math.max(GAP, rect.right - CARD_W);
    }
    setPos({ x, y });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const show = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      place();
      setOpen(true);
    }, 220);
  };

  const hide = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(false), 140);
  };

  const keep = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  };

  const topRoles = (user.roles ?? [])
    .filter((r) => r.name !== '@everyone' && r.badgeKey && r.badgeKey !== 'none')
    .sort((a, b) => b.position - a.position)
    .slice(0, 3);

  const bannerStyle = user.bannerUrl
    ? {
        backgroundImage: `url(${user.bannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: user.bannerColor || '#1e1e2e' };

  return (
    <span
      ref={anchorRef}
      className={cn('inline-flex max-w-full', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? tipId : undefined}
    >
      {children}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={tipId}
            ref={cardRef}
            role="tooltip"
            className="fixed z-[120] w-72 rounded-xl overflow-hidden border border-surface-container-highest bg-surface-container-low shadow-float dracord-fade-in"
            style={{ left: pos.x, top: pos.y }}
            onMouseEnter={keep}
            onMouseLeave={hide}
          >
            <div className="h-16 w-full" style={bannerStyle} />
            <div className="px-3 pb-3 -mt-6 relative">
              <Avatar
                displayName={user.displayName}
                imageUrl={user.avatarUrl}
                size="lg"
                status={user.status}
              />
              <p className="mt-2 font-headline-md text-on-surface truncate">{user.displayName}</p>
              {user.username && (
                <p className="font-body-sm text-on-surface-variant truncate">@{user.username}</p>
              )}
              {user.status && (
                <p className="mt-0.5 font-label-sm text-outline">
                  {presenceLabelTr(user.status)}
                  {user.customStatus ? ` · ${user.customStatus}` : ''}
                </p>
              )}
              {user.bio && (
                <p className="mt-2 font-body-sm text-on-surface-variant line-clamp-3 whitespace-pre-wrap">
                  {user.bio}
                </p>
              )}
              {topRoles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {topRoles.map((r) => (
                    <RoleBadge key={r.id} badgeKey={r.badgeKey} color={r.color} label={r.name} />
                  ))}
                </div>
              )}
              <SocialLinksRow links={user.socialLinks} className="mt-2" size="sm" />
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
