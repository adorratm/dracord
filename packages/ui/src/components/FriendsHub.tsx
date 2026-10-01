'use client';

import type { PresenceStatus } from '@dracord/types';
import { useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { presenceLabelTr } from '../lib/presence';

export type FriendsTab = 'online' | 'offline' | 'pending' | 'blocked';

export interface FriendRow {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  status?: PresenceStatus;
  subtitle?: string;
  pendingIncoming?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onMessage?: () => void;
  onUnblock?: () => void;
  onClick?: () => void;
}

export interface FriendsHubProps {
  friends: FriendRow[];
  pending?: FriendRow[];
  blocked?: FriendRow[];
  initialTab?: FriendsTab;
  onTabChange?: (tab: FriendsTab) => void;
  headerAction?: ReactNode;
  /** Boş liste içeriği (tab’a göre override) */
  emptyState?: ReactNode;
  className?: string;
}

const TABS: { id: FriendsTab; label: string }[] = [
  { id: 'online', label: 'Çevrimiçi' },
  { id: 'offline', label: 'Çevrimdışı' },
  { id: 'pending', label: 'Bekleyen' },
  { id: 'blocked', label: 'Engellenen' },
];

function isOnlineStatus(status?: PresenceStatus) {
  return status === 'ONLINE' || status === 'IDLE' || status === 'DND';
}

function FriendRowItem({ friend, tab }: { friend: FriendRow; tab: FriendsTab }) {
  return (
    <div
      className={cn(
        'flex items-center gap-space-sm sm:gap-space-md px-space-md py-space-sm rounded-lg hover:bg-surface-container transition-colors min-w-0',
        tab === 'blocked' && 'opacity-80',
      )}
    >
      <button type="button" onClick={friend.onClick} className="flex items-center gap-space-md flex-1 min-w-0 text-left">
        <Avatar
          displayName={friend.displayName}
          imageUrl={friend.avatarUrl}
          size="lg"
          status={friend.status}
        />
        <div className="flex flex-col min-w-0">
          <span className="font-headline-md text-headline-md text-on-surface truncate">{friend.displayName}</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
            {friend.subtitle ??
              (friend.status
                ? presenceLabelTr(friend.status)
                : tab === 'pending'
                  ? 'Arkadaşlık isteği'
                  : '')}
          </span>
        </div>
      </button>
      {tab === 'pending' && friend.pendingIncoming && (
        <div className="flex items-center gap-space-xs shrink-0">
          <button
            type="button"
            onClick={friend.onAccept}
            className="w-9 h-9 rounded-full bg-primary-container hover:bg-primary text-on-primary-container flex items-center justify-center transition-colors"
            aria-label="Kabul et"
          >
            <span className="material-symbols-outlined text-[20px]">check</span>
          </button>
          <button
            type="button"
            onClick={friend.onDecline}
            className="w-9 h-9 rounded-full bg-surface-container-highest hover:bg-error-container text-on-surface flex items-center justify-center transition-colors"
            aria-label="Reddet"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}
      {tab === 'pending' && !friend.pendingIncoming && friend.onDecline && (
        <button
          type="button"
          onClick={friend.onDecline}
          className="shrink-0 h-9 px-space-md rounded-full bg-surface-container-highest hover:bg-error-container text-on-surface font-label-sm transition-colors"
          aria-label="İsteği iptal et"
        >
          İptal
        </button>
      )}
      {(tab === 'online' || tab === 'offline') && (
        <button
          type="button"
          onClick={friend.onMessage}
          className="shrink-0 w-9 h-9 rounded-full bg-surface-container-highest hover:bg-surface-bright flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Mesaj gönder"
        >
          <span className="material-symbols-outlined text-[20px]">chat</span>
        </button>
      )}
      {tab === 'blocked' && friend.onUnblock && (
        <button
          type="button"
          onClick={friend.onUnblock}
          className="shrink-0 h-9 px-2.5 sm:px-space-md rounded-full bg-surface-container-highest hover:bg-primary-container text-on-surface hover:text-on-primary-container font-label-sm transition-colors"
          aria-label="Engeli kaldır"
          title="Engeli kaldır"
        >
          <span className="sm:hidden">Kaldır</span>
          <span className="hidden sm:inline">Engeli kaldır</span>
        </button>
      )}
    </div>
  );
}

export function FriendsHub({
  friends,
  pending = [],
  blocked = [],
  initialTab = 'online',
  onTabChange,
  headerAction,
  emptyState,
  className,
}: FriendsHubProps) {
  const [tab, setTab] = useState<FriendsTab>(initialTab);

  const setActiveTab = (next: FriendsTab) => {
    setTab(next);
    onTabChange?.(next);
  };

  const online = friends.filter((f) => isOnlineStatus(f.status));
  const offline = friends.filter((f) => !isOnlineStatus(f.status));

  const list =
    tab === 'online'
      ? online
      : tab === 'offline'
        ? offline
        : tab === 'pending'
          ? pending
          : blocked;

  return (
    <div className={cn('flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden bg-surface-container', className)}>
      <div className="px-space-md pt-space-md sm:pt-space-lg pb-space-sm border-b border-surface-container-high flex items-center justify-between gap-space-sm min-w-0">
        <h1 className="font-headline-lg text-headline-lg text-on-surface shrink-0 truncate">
          Arkadaşlar
        </h1>
        {headerAction ? (
          <div className="flex items-center justify-end gap-space-xs sm:gap-space-sm min-w-0 shrink">
            {headerAction}
          </div>
        ) : null}
      </div>

      <div
        className="flex gap-1 sm:gap-space-md px-space-md pt-space-md border-b border-surface-container-high overflow-x-auto overscroll-x-contain min-w-0 touch-pan-x"
        role="tablist"
        aria-label="Arkadaş sekmeleri"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'pb-space-sm px-1 sm:px-0 font-label-md sm:font-headline-md text-[13px] sm:text-headline-md border-b-2 transition-colors whitespace-nowrap shrink-0',
              tab === t.id
                ? 'border-primary-container text-on-surface'
                : 'border-transparent text-on-surface-variant hover:text-on-surface',
            )}
          >
            {t.label}
            {t.id === 'online' ? ` (${online.length})` : ''}
            {t.id === 'offline' ? ` (${offline.length})` : ''}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-space-md space-y-0.5 min-w-0">
        {list.length === 0 ? (
          tab === 'online' && emptyState ? (
            emptyState
          ) : (
            <p className="px-space-md text-outline font-body-md text-body-md">
              {tab === 'online' && 'Çevrimiçi arkadaş yok.'}
              {tab === 'offline' && 'Çevrimdışı arkadaş yok.'}
              {tab === 'pending' && 'Bekleyen istek yok.'}
              {tab === 'blocked' && 'Engellenen kullanıcı yok.'}
            </p>
          )
        ) : (
          list.map((friend) => <FriendRowItem key={friend.id} friend={friend} tab={tab} />)
        )}
      </div>
    </div>
  );
}
