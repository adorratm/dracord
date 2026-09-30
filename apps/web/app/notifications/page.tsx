'use client';

import type { NotificationDto } from '@dracord/types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { DracoEmpty } from '@/components/Draco';
import { useGuildNav } from '@/hooks/useGuildNav';
import { useUserPreferences } from '@/lib/user-preferences';

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

export default function NotificationsPage() {
  const { client, user } = useAuth();
  const { guilds } = useGuildNav(undefined);
  const { prefs, setSection } = useUserPreferences();
  const router = useRouter();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [showRead, setShowRead] = useState(false);
  const [busy, setBusy] = useState(false);

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
    void refresh();
  }, [refresh]);

  const mutedUsers = prefs.notifications.mutedUserIds ?? [];
  const mutedChannels = prefs.notifications.mutedChannelIds ?? [];
  const mutedGuilds = prefs.notifications.mutedGuildIds ?? [];

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
        // ignore
      }
    }
    if (n.link) router.push(n.link);
  };

  const muteActor = (actorId: string) => {
    if (mutedUsers.includes(actorId)) return;
    setSection('notifications', { mutedUserIds: [...mutedUsers, actorId] });
  };

  const unmuteActor = (actorId: string) => {
    setSection('notifications', {
      mutedUserIds: mutedUsers.filter((id) => id !== actorId),
    });
  };

  const muteGuild = (guildId: string) => {
    if (mutedGuilds.includes(guildId)) return;
    setSection('notifications', { mutedGuildIds: [...mutedGuilds, guildId] });
  };

  const unmuteGuild = (guildId: string) => {
    setSection('notifications', {
      mutedGuildIds: mutedGuilds.filter((id) => id !== guildId),
    });
  };

  const enableBrowser = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setSection('notifications', { desktopEnabled: perm === 'granted' });
  };

  return (
    <RequireAuth>
      <AppShell guilds={guilds}>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-space-md py-space-lg space-y-space-lg">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-headline-lg text-on-surface">Bildirimler</h1>
                <p className="font-body-sm text-on-surface-variant mt-1">
                  Okunmamışları yönet, kaynakları sessize al, tarayıcı bildirimlerini aç.
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
                  onClick={() => router.push('/settings/notifications')}
                  className="h-9 px-3 rounded-lg bg-surface-container-high font-label-sm"
                >
                  Ayarlar
                </button>
              </div>
            </div>

            <section className="rounded-xl border border-surface-container-highest bg-surface-container-low p-space-md space-y-3">
              <h2 className="font-headline-md text-on-surface">Tarayıcı bildirimleri</h2>
              <p className="font-body-sm text-on-surface-variant">
                İzin:{' '}
                {typeof Notification !== 'undefined' ? Notification.permission : 'desteklenmiyor'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void enableBrowser()}
                  className="h-9 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
                >
                  Etkinleştir
                </button>
                <button
                  type="button"
                  onClick={() => setSection('notifications', { desktopEnabled: false })}
                  className="h-9 px-3 rounded-lg bg-surface-container-high font-label-sm"
                >
                  Kapat
                </button>
              </div>
            </section>

            {(mutedUsers.length > 0 || mutedGuilds.length > 0) && (
              <section className="rounded-xl border border-surface-container-highest bg-surface-container-low p-space-md space-y-2">
                <h2 className="font-headline-md text-on-surface">Sessize alınanlar</h2>
                {mutedUsers.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-2">
                    <span className="font-body-sm text-on-surface-variant truncate">Kullanıcı {id}</span>
                    <button
                      type="button"
                      className="font-label-sm text-primary-container"
                      onClick={() => unmuteActor(id)}
                    >
                      Kaldır
                    </button>
                  </div>
                ))}
                {mutedGuilds.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-2">
                    <span className="font-body-sm text-on-surface-variant truncate">
                      Sunucu {guilds.find((g) => g.id === id)?.name ?? id}
                    </span>
                    <button
                      type="button"
                      className="font-label-sm text-primary-container"
                      onClick={() => unmuteGuild(id)}
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
                  className="py-space-xl"
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
                      <div className="px-space-md py-space-sm flex gap-space-sm">
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
                              onClick={() => muteActor(n.actorId!)}
                              title="Bu kullanıcıdan bildirim alma"
                            >
                              Kullanıcıyı sustur
                            </button>
                          )}
                          {n.guildId && (
                            <button
                              type="button"
                              className="font-label-sm text-outline hover:text-on-surface"
                              onClick={() => muteGuild(n.guildId!)}
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
      </AppShell>
    </RequireAuth>
  );
}
