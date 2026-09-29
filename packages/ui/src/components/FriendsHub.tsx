'use client';

import type { PresenceStatus } from '@dracord/types';
import { useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { presenceLabelTr } from '../lib/presence';

export type FriendsTab = 'online' | 'pending' | 'blocked';

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
  onClick?: () => void;
}

export interface FriendsHubProps {
  friends: FriendRow[];
  pending?: FriendRow[];
  blocked?: FriendRow[];
  initialTab?: FriendsTab;
  onTabChange?: (tab: FriendsTab) => void;
  headerAction?: ReactNode;
  className?: string;
}

const TABS: { id: FriendsTab; label: string }[] = [
  { id: 'online', label: 'Çevrimiçi' },
  { id: 'pending', label: 'Bekleyen' },
  { id: 'blocked', label: 'Engellenen' },
];

function FriendRowItem({ friend, tab }: { friend: FriendRow; tab: FriendsTab }) {
  return (
    <div
      className={cn(
        'flex items-center gap-space-md px-space-md py-space-sm rounded-lg hover:bg-surface-container transition-colors',
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
              (friend.status ? presenceLabelTr(friend.status) : tab === 'pending' ? 'Arkadaşlık isteği' : '')}
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
      {tab === 'online' && (
        <button
          type="button"
          onClick={friend.onMessage}
          className="shrink-0 w-9 h-9 rounded-full bg-surface-container-highest hover:bg-surface-bright flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Mesaj gönder"
        >
          <span className="material-symbols-outlined text-[20px]">chat</span>
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
  className,
}: FriendsHubProps) {
  const [tab, setTab] = useState<FriendsTab>(initialTab);

  const setActiveTab = (next: FriendsTab) => {
    setTab(next);
    onTabChange?.(next);
  };

  const list =
    tab === 'online' ? friends : tab === 'pending' ? pending : blocked;

  return (
    <div className={cn('flex flex-col flex-1 min-h-0 bg-surface-container', className)}>
      <div className="px-space-md pt-space-lg pb-space-sm border-b border-surface-container-high flex items-center justify-between gap-space-md">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Arkadaşlar</h1>
        {headerAction}
      </div>

      <div className="flex gap-space-md px-space-md pt-space-md border-b border-surface-container-high">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'pb-space-sm font-headline-md text-headline-md border-b-2 transition-colors',
              tab === t.id
                ? 'border-primary-container text-on-surface'
                : 'border-transparent text-on-surface-variant hover:text-on-surface',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto py-space-md space-y-0.5">
        {list.length === 0 ? (
          <p className="px-space-md text-outline font-body-md text-body-md">
            {tab === 'online' && 'Çevrimiçi arkadaş yok.'}
            {tab === 'pending' && 'Bekleyen istek yok.'}
            {tab === 'blocked' && 'Engellenen kullanıcı yok.'}
          </p>
        ) : (
          list.map((friend) => <FriendRowItem key={friend.id} friend={friend} tab={tab} />)
        )}
      </div>
    </div>
  );
}
