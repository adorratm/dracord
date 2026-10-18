import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ClientSettings,
  MessageBookmarkDto,
  MessageReminderDto,
  NotificationDto,
} from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useAuth } from '../auth';
import { DEFAULT_CLIENT_SETTINGS, mergeClientSettings } from '../lib/client-settings';

type InboxTab = 'unreads' | 'mentions' | 'bookmarks' | 'reminders';

const STORAGE_KEY = 'dracord.userPreferences.v1';

const TABS: { id: InboxTab; label: string }[] = [
  { id: 'unreads', label: 'Okunmamışlar' },
  { id: 'mentions', label: 'Bahsedilmeler' },
  { id: 'bookmarks', label: 'İşaretler' },
  { id: 'reminders', label: 'Hatırlatmalar' },
];

function loadPrefs(): ClientSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLIENT_SETTINGS;
    return mergeClientSettings(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return DEFAULT_CLIENT_SETTINGS;
  }
}

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
    case 'REMINDER':
      return 'schedule';
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
    /* ignore */
  }
}

export function NotificationBell({
  onOpenAll,
  onOpenSettings,
  onNavigateLink,
}: {
  onOpenAll?: () => void;
  onOpenSettings?: () => void;
  onNavigateLink?: (link: string) => void;
}) {
  const { client, user, ready } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>('unreads');
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [bookmarks, setBookmarks] = useState<MessageBookmarkDto[]>([]);
  const [reminders, setReminders] = useState<MessageReminderDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState(loadPrefs);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [list, count, marks, rems] = await Promise.all([
        client.listNotifications({ limit: 40 }),
        client.notificationsUnreadCount(),
        client.listBookmarks(40).catch(() => [] as MessageBookmarkDto[]),
        client.listReminders({ limit: 40 }).catch(() => [] as MessageReminderDto[]),
      ]);
      setItems(list);
      setUnread(count.count);
      setBookmarks(marks);
      setReminders(rems);
    } catch {
      /* ignore */
    }
  }, [client, user]);

  useEffect(() => {
    if (!ready || !user) return;
    setPrefs(loadPrefs());
    void refresh();
    const sock = client.connectSocket();
    const onNotif = (n: NotificationDto) => {
      const p = loadPrefs().notifications;
      if (p.mentionsOnly && n.type !== 'MENTION' && n.type !== 'FRIEND') return;
      if (n.actorId && (p.mutedUserIds ?? []).includes(n.actorId)) return;
      if (n.channelId && (p.mutedChannelIds ?? []).includes(n.channelId)) return;
      if (n.guildId && (p.mutedGuildIds ?? []).includes(n.guildId)) return;
      if (p.quietHours && inQuietHours()) return;

      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 40));
      setUnread((c) => c + 1);
      if (p.soundEnabled) playNotifySound();
      if (
        p.desktopEnabled &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.visibilityState === 'hidden'
      ) {
        try {
          new Notification(n.title, { body: n.body, tag: n.id });
        } catch {
          /* ignore */
        }
      }
    };
    sock.on(SocketEvents.NOTIFICATION_CREATE, onNotif);
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPrefs(loadPrefs());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      sock.off(SocketEvents.NOTIFICATION_CREATE, onNotif);
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
    };
  }, [ready, user, client, refresh]);

  useEffect(() => {
    if (!open) return;
    setPrefs(loadPrefs());
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
        /* ignore */
      }
    }
    setOpen(false);
    if (n.link) onNavigateLink?.(n.link);
  };

  const markAll = async () => {
    try {
      await client.markAllNotificationsRead();
      setItems((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })),
      );
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const visible = useMemo(() => {
    const mutedUsers = new Set(prefs.notifications.mutedUserIds ?? []);
    const mutedChannels = new Set(prefs.notifications.mutedChannelIds ?? []);
    const mutedGuilds = new Set(prefs.notifications.mutedGuildIds ?? []);
    return items.filter((n) => {
      if (n.actorId && mutedUsers.has(n.actorId)) return false;
      if (n.channelId && mutedChannels.has(n.channelId)) return false;
      if (n.guildId && mutedGuilds.has(n.guildId)) return false;
      if (tab === 'unreads') return !n.readAt;
      if (tab === 'mentions') return n.type === 'MENTION';
      if (tab === 'bookmarks' || tab === 'reminders') return false;
      return true;
    });
  }, [items, prefs.notifications, tab]);

  if (!user) return null;

  const showBadge = prefs.notifications.unreadBadge && unread > 0;
  const locale = prefs.language.locale === 'en' ? 'en-US' : 'tr-TR';

  return (
    <div className="relative" ref={rootRef} data-tour="notifications">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        aria-label="Gelen Kutusu"
        title="Gelen Kutusu"
      >
        <span className="material-symbols-outlined text-[20px] leading-none">inbox</span>
        {showBadge && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(100vw-1.5rem,32rem)] max-h-[75vh] rounded-xl bg-surface-container-high border border-surface-container-highest shadow-float z-[80] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-container-highest gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[20px] text-on-surface">inbox</span>
              <p className="font-headline-md text-on-surface">Gelen Kutusu</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => void markAll()}
                className="h-8 w-8 rounded-md bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-bright"
                aria-label="Tümünü okundu yap"
                title="Tümünü okundu yap"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenSettings?.();
                }}
                className="h-8 w-8 rounded-md bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-bright"
                aria-label="Gelen kutusu ayarları"
                title="Gelen kutusu ayarları"
              >
                <span className="material-symbols-outlined text-[18px]">tune</span>
              </button>
            </div>
          </div>

          <div className="flex items-stretch border-b border-surface-container-highest px-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? 'shrink-0 px-2.5 sm:px-3 py-2.5 font-label-sm text-on-surface border-b-2 border-primary-container whitespace-nowrap'
                    : 'shrink-0 px-2.5 sm:px-3 py-2.5 font-label-sm text-on-surface-variant hover:text-on-surface border-b-2 border-transparent whitespace-nowrap'
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
            {tab === 'reminders' ? (
              reminders.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <span className="material-symbols-outlined text-[40px] text-outline mb-3">
                    schedule
                  </span>
                  <p className="font-headline-md text-on-surface">Hatırlatma yok</p>
                  <p className="mt-2 font-body-sm text-on-surface-variant max-w-xs">
                    Bir mesaja sağ tıklayıp Hatırlat seçtiğinde burada görünür.
                  </p>
                </div>
              ) : (
                reminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start gap-2 px-3 py-2.5 border-b border-surface-container-highest/60 hover:bg-surface-container"
                  >
                    <button
                      type="button"
                      className="flex-1 text-left min-w-0"
                      onClick={() => {
                        setOpen(false);
                        if (r.guildId && r.channelId) {
                          onNavigateLink?.(
                            `/channels/${r.guildId}/${r.channelId}?around=${r.messageId}`,
                          );
                        } else if (r.channelId) {
                          onNavigateLink?.(
                            `/channels/me/${r.channelId}?around=${r.messageId}`,
                          );
                        }
                      }}
                    >
                      <p className="font-label-sm text-primary-container">
                        {formatTime(
                          r.remindAt,
                          prefs.language.hour24,
                          prefs.language.locale === 'en' ? 'en-US' : 'tr-TR',
                        )}
                        {r.channelName ? ` · #${r.channelName}` : ''}
                      </p>
                      <p className="font-body-sm text-on-surface line-clamp-2 mt-0.5">
                        {r.message?.content?.trim() || 'Mesaj'}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="text-[11px] font-label-sm text-error shrink-0"
                      onClick={() => {
                        void client.cancelReminder(r.id).then(() => void refresh());
                      }}
                    >
                      İptal
                    </button>
                  </div>
                ))
              )
            ) : tab === 'bookmarks' ? (
              bookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <span className="material-symbols-outlined text-[40px] text-outline mb-3">
                    bookmark
                  </span>
                  <p className="font-headline-md text-on-surface">İşaret yok</p>
                  <p className="mt-2 font-body-sm text-on-surface-variant max-w-xs">
                    Mesajları yer imine eklediğinde burada görünür.
                  </p>
                </div>
              ) : (
                bookmarks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      if (b.guildId) {
                        onNavigateLink?.(`/channels/${b.guildId}/${b.channelId}`);
                      } else {
                        onNavigateLink?.(`/channels/@me/${b.channelId}`);
                      }
                    }}
                    className="w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-surface-bright border-b border-surface-container-highest/60"
                  >
                    <span className="material-symbols-outlined text-[22px] text-primary-container shrink-0 mt-0.5">
                      bookmark
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-label-md text-on-surface truncate">
                        {b.channelName ? `#${b.channelName}` : 'Kanal'}
                      </p>
                      <p className="font-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
                        {b.message.content?.trim() || '(ekli içerik)'}
                      </p>
                      <p className="font-label-sm text-outline mt-1">
                        {formatTime(b.createdAt, prefs.language.hour24, locale)}
                      </p>
                    </div>
                  </button>
                ))
              )
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center">
                    <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                      inbox
                    </span>
                  </div>
                  <span className="absolute -top-1 -right-1 text-dracula-orange text-sm">✦</span>
                </div>
                <p className="font-headline-md text-on-surface">Güncele yetiştin!</p>
                <p className="mt-2 font-body-sm text-on-surface-variant max-w-xs">
                  <span className="text-dracula-green font-semibold">TÜYO:</span> Gelen Kutusunu
                  açmak için bildirim ikonuna tıkla; tümünü okundu yapmak için üstteki çift onay
                  işaretini kullan.
                </p>
              </div>
            ) : (
              visible.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void openItem(n)}
                  className={
                    n.readAt
                      ? 'w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-surface-bright border-b border-surface-container-highest/60'
                      : 'w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-surface-bright border-b border-surface-container-highest/60 bg-primary-container/10'
                  }
                >
                  <span className="material-symbols-outlined text-[22px] text-primary-container shrink-0 mt-0.5">
                    {typeIcon(n.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-on-surface truncate">{n.title}</p>
                    <p className="font-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
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

          {onOpenAll && (
            <button
              type="button"
              className="w-full py-2.5 text-sm text-primary-container font-semibold hover:bg-surface-bright border-t border-surface-container-highest"
              onClick={() => {
                setOpen(false);
                onOpenAll();
              }}
            >
              Tüm bildirimler
            </button>
          )}
        </div>
      )}
    </div>
  );
}
