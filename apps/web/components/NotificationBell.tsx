'use client';

import type { NotificationDto } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { DracoEmpty } from '@/components/Draco';
import { useUserPreferences } from '@/lib/user-preferences';

function typeIcon(type: NotificationDto['type']): string {
  switch (type) {
    case 'MENTION':
      return 'alternate_email';
    case 'ANNOUNCEMENT':
      return 'campaign';
    case 'FRIEND':
      return 'person_add';
    case 'DM':
      return 'mail';
    default:
      return 'notifications';
  }
}

function formatTime(iso: string, hour24: boolean, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: !hour24,
    });
  } catch {
    return '';
  }
}

function inQuietHours(): boolean {
  const h = new Date().getHours();
  return h >= 23 || h < 7;
}

function playNotifySound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    window.setTimeout(() => void ctx.close(), 300);
  } catch {
    // ignore
  }
}

export function NotificationBell() {
  const { client, user, ready } = useAuth();
  const { prefs } = useUserPreferences();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [list, count] = await Promise.all([
        client.listNotifications({ limit: 30 }),
        client.notificationsUnreadCount(),
      ]);
      setItems(list);
      setUnread(count.count);
    } catch {
      // ignore
    }
  }, [client, user]);

  useEffect(() => {
    if (!ready || !user) return;
    void refresh();
    const sock = client.connectSocket();
    const onNotif = (n: NotificationDto) => {
      // mentionsOnly: FRIEND her zaman; DM/ANNOUNCEMENT filtre
      if (
        prefs.notifications.mentionsOnly &&
        n.type !== 'MENTION' &&
        n.type !== 'FRIEND'
      ) {
        return;
      }
      if (prefs.notifications.quietHours && inQuietHours()) return;

      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 40));
      setUnread((c) => c + 1);

      if (prefs.notifications.soundEnabled) playNotifySound();

      if (
        prefs.notifications.desktopEnabled &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.visibilityState === 'hidden'
      ) {
        try {
          new Notification(n.title, { body: n.body, tag: n.id });
        } catch {
          // ignore
        }
      }
    };
    sock.on(SocketEvents.NOTIFICATION_CREATE, onNotif);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      sock.off(SocketEvents.NOTIFICATION_CREATE, onNotif);
      window.clearInterval(interval);
    };
  }, [ready, user, client, refresh, prefs.notifications]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, refresh]);

  const openItem = async (n: NotificationDto) => {
    if (!n.readAt) {
      try {
        await client.markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
        );
        setUnread((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    try {
      await client.markAllNotificationsRead();
      setItems((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })),
      );
      setUnread(0);
    } catch {
      // ignore
    }
  };

  if (!user) return null;

  const showBadge = prefs.notifications.unreadBadge && unread > 0;
  const locale = prefs.language.locale === 'en' ? 'en-US' : 'tr-TR';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        aria-label="Bildirimler"
      >
        <span className="material-symbols-outlined text-[20px] leading-none">notifications</span>
        {showBadge && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-1.5rem,22rem)] max-h-[70vh] rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float z-[80] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-space-md py-space-sm border-b border-surface-container-highest">
            <p className="font-headline-md text-on-surface">Bildirimler</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAll()}
                className="font-label-sm text-primary-container hover:underline"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {items.length === 0 ? (
              <DracoEmpty
                mood="sleep"
                size={72}
                title="Henüz bildirim yok"
                description="Draco uyuyor — birisi seni etiketleyince uyanır."
                className="py-space-lg"
              />
            ) : (
              items
                .filter(
                  (n) =>
                    !prefs.notifications.mentionsOnly ||
                    n.type === 'MENTION' ||
                    n.type === 'FRIEND',
                )
                .map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void openItem(n)}
                  className={`w-full text-left px-space-md py-space-sm flex gap-space-sm hover:bg-surface-bright border-b border-surface-container-highest/60 ${
                    !n.readAt ? 'bg-primary-container/10' : ''
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] text-primary-container shrink-0 mt-0.5">
                    {typeIcon(n.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <p className="font-label-md text-on-surface truncate flex-1">{n.title}</p>
                      <span className="font-label-sm text-outline shrink-0">
                        {n.type === 'FRIEND'
                          ? 'Arkadaş'
                          : n.type === 'MENTION'
                            ? 'Bahsetme'
                            : n.type === 'DM'
                              ? 'DM'
                              : n.type === 'ANNOUNCEMENT'
                                ? 'Duyuru'
                                : 'Sistem'}
                      </span>
                    </div>
                    <p className="font-body-sm text-on-surface-variant line-clamp-3 mt-0.5">
                      {n.body}
                    </p>
                    <p className="font-label-sm text-outline mt-1">
                      {formatTime(n.createdAt, prefs.language.hour24, locale)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
