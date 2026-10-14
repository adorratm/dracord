import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClientSettings, NotificationDto } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useAuth } from '../auth';
import { DracoEmpty } from '../components/Draco';
import { DEFAULT_CLIENT_SETTINGS, mergeClientSettings } from '../lib/client-settings';

const STORAGE_KEY = 'dracord.userPreferences.v1';

function loadPrefs(): ClientSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLIENT_SETTINGS;
    return mergeClientSettings(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return DEFAULT_CLIENT_SETTINGS;
  }
}

function savePrefs(prefs: ClientSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function typeLabel(type: NotificationDto['type']): string {
  switch (type) {
    case 'MENTION':
      return 'Bahsetme';
    case 'FRIEND':
      return 'Arkadaş';
    case 'DM':
      return 'DM';
    case 'ANNOUNCEMENT':
      return 'Duyuru';
    default:
      return 'Sistem';
  }
}

export function NotificationsPanel({
  guildNames = {},
  onOpenSettings,
  onNavigateLink,
}: {
  guildNames?: Record<string, string>;
  onOpenSettings?: () => void;
  onNavigateLink?: (link: string) => void;
}) {
  const { client, user } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [showRead, setShowRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const list = await client.listNotifications({ limit: 80 });
      setItems(list);
    } catch {
      setItems([]);
    }
  }, [client, user]);

  useEffect(() => {
    setPrefs(loadPrefs());
    void refresh();
    const sock = client.connectSocket();
    const onNotif = (n: NotificationDto) => {
      setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 80));
    };
    sock.on(SocketEvents.NOTIFICATION_CREATE, onNotif);
    return () => {
      sock.off(SocketEvents.NOTIFICATION_CREATE, onNotif);
    };
  }, [client, refresh]);

  const mutedUsers = prefs.notifications.mutedUserIds ?? [];
  const mutedChannels = prefs.notifications.mutedChannelIds ?? [];
  const mutedGuilds = prefs.notifications.mutedGuildIds ?? [];

  const setNotifSection = (patch: Partial<ClientSettings['notifications']>) => {
    setPrefs((prev) => {
      const next = {
        ...prev,
        notifications: { ...prev.notifications, ...patch },
      };
      savePrefs(next);
      return next;
    });
  };

  const visible = useMemo(() => {
    return items.filter((n) => {
      if (!showRead && n.readAt) return false;
      if (n.actorId && mutedUsers.includes(n.actorId)) return false;
      if (n.channelId && mutedChannels.includes(n.channelId)) return false;
      if (n.guildId && mutedGuilds.includes(n.guildId)) return false;
      return true;
    });
  }, [items, showRead, mutedUsers, mutedChannels, mutedGuilds]);

  const markAll = async () => {
    setBusy(true);
    try {
      await client.markAllNotificationsRead();
      setItems((prev) =>
        prev.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })),
      );
    } finally {
      setBusy(false);
    }
  };

  const openItem = async (n: NotificationDto) => {
    if (!n.readAt) {
      try {
        await client.markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x,
          ),
        );
      } catch {
        /* ignore */
      }
    }
    if (n.link) onNavigateLink?.(n.link);
  };

  const enableDesktop = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifSection({ desktopEnabled: perm === 'granted' });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-surface">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-on-surface">Bildirimler</h1>
            <p className="font-body-sm text-on-surface-variant mt-1">
              Okunmamışları yönet, kaynakları sessize al, masaüstü bildirimlerini aç.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void markAll()}
              className="h-9 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            >
              Tümünü oku
            </button>
            <button
              type="button"
              onClick={() => setShowRead((v) => !v)}
              className="h-9 px-3 rounded-lg bg-surface-container-high font-label-sm"
            >
              {showRead ? 'Okunmuşları gizle' : 'Okunmuşları göster'}
            </button>
            <button
              type="button"
              onClick={() => onOpenSettings?.()}
              className="h-9 px-3 rounded-lg bg-surface-container-high font-label-sm"
            >
              Ayarlar
            </button>
          </div>
        </div>

        <section className="rounded-xl border border-surface-container-highest bg-surface-container-low p-4 space-y-3">
          <h2 className="font-headline-md text-on-surface">Masaüstü bildirimleri</h2>
          <p className="font-body-sm text-on-surface-variant">
            İzin:{' '}
            {typeof Notification !== 'undefined' ? Notification.permission : 'desteklenmiyor'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void enableDesktop()}
              className="h-9 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            >
              Etkinleştir
            </button>
            <button
              type="button"
              onClick={() => setNotifSection({ desktopEnabled: false })}
              className="h-9 px-3 rounded-lg bg-surface-container-high font-label-sm"
            >
              Kapat
            </button>
          </div>
        </section>

        {(mutedUsers.length > 0 || mutedGuilds.length > 0) && (
          <section className="rounded-xl border border-surface-container-highest bg-surface-container-low p-4 space-y-2">
            <h2 className="font-headline-md text-on-surface">Sessize alınanlar</h2>
            {mutedUsers.map((id) => (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="font-body-sm text-on-surface-variant truncate">
                  Kullanıcı {id}
                </span>
                <button
                  type="button"
                  className="font-label-sm text-primary-container"
                  onClick={() =>
                    setNotifSection({
                      mutedUserIds: mutedUsers.filter((x) => x !== id),
                    })
                  }
                >
                  Kaldır
                </button>
              </div>
            ))}
            {mutedGuilds.map((id) => (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="font-body-sm text-on-surface-variant truncate">
                  Sunucu {guildNames[id] ?? id}
                </span>
                <button
                  type="button"
                  className="font-label-sm text-primary-container"
                  onClick={() =>
                    setNotifSection({
                      mutedGuildIds: mutedGuilds.filter((x) => x !== id),
                    })
                  }
                >
                  Kaldır
                </button>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-xl border border-surface-container-highest bg-surface-container-low overflow-hidden">
          {visible.length === 0 ? (
            <DracoEmpty
              mood="sleep"
              size={90}
              title="Bildirim yok"
              description="Yeni bahsetme veya arkadaşlık isteği gelince burada görünür."
              className="py-12 w-full"
            />
          ) : (
            <ul>
              {visible.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-surface-container-highest/70 ${
                    n.readAt ? 'opacity-70' : 'bg-primary-container/5'
                  }`}
                >
                  <div className="px-4 py-3 flex gap-3">
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left"
                      onClick={() => void openItem(n)}
                    >
                      <div className="flex items-baseline gap-2">
                        <p className="font-label-md text-on-surface truncate flex-1">
                          {n.title}
                        </p>
                        <span className="font-label-sm text-outline shrink-0">
                          {typeLabel(n.type)}
                        </span>
                      </div>
                      <p className="font-body-sm text-on-surface-variant mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    </button>
                    <div className="flex flex-col gap-1 shrink-0">
                      {n.actorId && (
                        <button
                          type="button"
                          className="font-label-sm text-outline hover:text-on-surface"
                          onClick={() => {
                            if (mutedUsers.includes(n.actorId!)) return;
                            setNotifSection({
                              mutedUserIds: [...mutedUsers, n.actorId!],
                            });
                          }}
                          title="Bu kullanıcıdan bildirim alma"
                        >
                          Kullanıcıyı sustur
                        </button>
                      )}
                      {n.guildId && (
                        <button
                          type="button"
                          className="font-label-sm text-outline hover:text-on-surface"
                          onClick={() => {
                            if (mutedGuilds.includes(n.guildId!)) return;
                            setNotifSection({
                              mutedGuildIds: [...mutedGuilds, n.guildId!],
                            });
                          }}
                          title="Bu sunucudan bildirim alma"
                        >
                          Sunucuyu sustur
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
