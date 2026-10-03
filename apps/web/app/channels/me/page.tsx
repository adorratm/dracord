'use client';

import type { FriendRow } from '@dracord/ui';
import { Avatar, FriendsHub } from '@dracord/ui';
import type { ChannelSummary, PublicUser } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DracoEmpty } from '@/components/Draco';
import { MobileDrawer } from '@/components/MobileDrawer';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useGuildNav } from '@/hooks/useGuildNav';

export default function FriendsHubPage() {
  const router = useRouter();
  const { user, client } = useAuth();
  const { guilds, reload } = useGuildNav(undefined);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [pending, setPending] = useState<FriendRow[]>([]);
  const [blocked, setBlocked] = useState<FriendRow[]>([]);
  const [dms, setDms] = useState<ChannelSummary[]>([]);
  const [dmError, setDmError] = useState<string | null>(null);
  const [dmsOpen, setDmsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<PublicUser[]>([]);
  const [addBusy, setAddBusy] = useState(false);

  const openDm = useCallback(
    async (userId: string) => {
      setDmError(null);
      try {
        const ch = await client.openDm(userId);
        setDmsOpen(false);
        router.push(`/channels/me/${ch.id}`);
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'DM açılamadı');
      }
    },
    [client, router],
  );

  const openDmChannel = useCallback(
    (channelId: string) => {
      setDmsOpen(false);
      router.push(`/channels/me/${channelId}`);
    },
    [router],
  );

  const loadFriends = useCallback(async () => {
    try {
      const list = await client.getFriends();
      setFriends(
        list.map((f) => ({
          id: f.id,
          displayName: f.displayName,
          avatarUrl: f.avatarUrl,
          status: f.status,
          onMessage: () => {
            void openDm(f.id);
          },
        })),
      );
    } catch {
      setFriends([]);
    }
  }, [client, openDm]);

  const loadPending = useCallback(async () => {
    try {
      const { incoming, outgoing } = await client.getPendingFriends();
      const rows: FriendRow[] = [
        ...incoming.map((f) => ({
          id: f.id,
          displayName: f.displayName,
          avatarUrl: f.avatarUrl,
          status: f.status,
          pendingIncoming: true,
          subtitle: 'Gelen istek',
          onAccept: () => {
            void (async () => {
              try {
                await client.acceptFriendRequest(f.id);
                await Promise.all([loadPending(), loadFriends()]);
              } catch (err) {
                setDmError(err instanceof Error ? err.message : 'Kabul edilemedi');
              }
            })();
          },
          onDecline: () => {
            void (async () => {
              try {
                await client.declineFriendRequest(f.id);
                await loadPending();
              } catch (err) {
                setDmError(err instanceof Error ? err.message : 'Reddedilemedi');
              }
            })();
          },
        })),
        ...outgoing.map((f) => ({
          id: f.id,
          displayName: f.displayName,
          avatarUrl: f.avatarUrl,
          status: f.status,
          pendingIncoming: false,
          subtitle: 'Giden istek',
          onDecline: () => {
            void (async () => {
              try {
                await client.declineFriendRequest(f.id);
                await loadPending();
              } catch (err) {
                setDmError(err instanceof Error ? err.message : 'İptal edilemedi');
              }
            })();
          },
        })),
      ];
      setPending(rows);
    } catch {
      setPending([]);
    }
  }, [client, loadFriends]);

  const loadBlocked = useCallback(async () => {
    try {
      const list = await client.listBlocked();
      setBlocked(
        list.map((f) => ({
          id: f.id,
          displayName: f.displayName,
          avatarUrl: f.avatarUrl,
          subtitle: 'Engellendi',
          onUnblock: () => {
            void (async () => {
              try {
                await client.unblockUser(f.id);
                setBlocked((prev) => prev.filter((b) => b.id !== f.id));
              } catch (err) {
                setDmError(err instanceof Error ? err.message : 'Engel kaldırılamadı');
              }
            })();
          },
        })),
      );
    } catch {
      setBlocked([]);
    }
  }, [client]);

  useEffect(() => {
    if (!user) return;
    void client
      .listDms()
      .then(setDms)
      .catch(() => setDms([]));
    void loadFriends();
    void loadPending();
    void loadBlocked();
  }, [client, user, loadFriends, loadPending, loadBlocked]);

  // Canlı presence: arkadaş listesi status güncelle
  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onPresence = (payload: {
      userId: string;
      status: PublicUser['status'];
    }) => {
      setFriends((prev) =>
        prev.map((f) => (f.id === payload.userId ? { ...f, status: payload.status } : f)),
      );
    };
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    return () => {
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
    };
  }, [client, user]);

  const dmIdsKey = dms.map((d) => d.id).join(',');

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const ids = dmIdsKey ? dmIdsKey.split(',') : [];
    for (const id of ids) {
      if (id) client.joinChannel(id);
    }
    const onCreate = (msg: { channelId: string; author?: { id?: string } }) => {
      if (!msg?.channelId) return;
      if (msg.author?.id === user.id) return;
      setDms((prev) => {
        if (!prev.some((d) => d.id === msg.channelId)) return prev;
        return prev.map((ch) => {
          if (ch.id !== msg.channelId) return ch;
          const unreadCount = (ch.unreadCount ?? 0) + 1;
          return { ...ch, unreadCount, unread: true };
        });
      });
    };
    sock.on('message:create', onCreate);
    return () => {
      sock.off('message:create', onCreate);
    };
  }, [client, user, dmIdsKey]);

  useEffect(() => {
    if (!addOpen || addQuery.trim().length < 2) {
      setAddResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void client
        .searchUsers(addQuery.trim())
        .then((list) => setAddResults(list.filter((u) => u.id !== user?.id).slice(0, 8)))
        .catch(() => setAddResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [addOpen, addQuery, client, user?.id]);

  const sendRequest = async (targetId: string) => {
    setAddBusy(true);
    setDmError(null);
    try {
      await client.sendFriendRequest(targetId);
      setAddQuery('');
      setAddResults([]);
      await loadPending();
    } catch (err) {
      setDmError(err instanceof Error ? err.message : 'İstek gönderilemedi');
    } finally {
      setAddBusy(false);
    }
  };

  const dmSidebar = (
    <aside className="w-full md:w-60 h-full shrink-0 border-r border-surface-container-highest bg-surface-container-low flex flex-col min-h-0">
      <div className="px-space-md py-space-md border-b border-surface-container-highest">
        <p className="font-label-sm text-on-surface-variant uppercase tracking-wider font-bold">
          Mesajlar
        </p>
        <button
          type="button"
          className="mt-space-sm w-full h-9 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
          onClick={() => user && void openDm(user.id)}
        >
          Notlarım
        </button>
        {dmError && <p className="mt-space-xs font-body-sm text-error">{dmError}</p>}
      </div>
      <ul className="flex-1 overflow-y-auto py-space-sm px-space-xs">
        {dms.length === 0 ? (
          <li className="px-space-sm py-space-md font-body-sm text-outline">
            Henüz DM yok. Üye listesinden birine tıkla.
          </li>
        ) : (
          dms.map((ch) => (
            <li key={ch.id}>
              <button
                type="button"
                onClick={() => openDmChannel(ch.id)}
                className="w-full flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg hover:bg-surface-container text-left"
              >
                {ch.selfNotes ? (
                  <span className="material-symbols-outlined text-[22px] text-outline shrink-0 w-8 h-8 flex items-center justify-center">
                    sticky_note_2
                  </span>
                ) : (
                  <Avatar
                    displayName={ch.name}
                    imageUrl={ch.peerAvatarUrl}
                    size="md"
                    status={ch.peerStatus ?? undefined}
                  />
                )}
                <span className="font-body-sm text-on-surface truncate flex-1">{ch.name}</span>
                {(ch.unreadCount ?? 0) > 0 ? (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-[11px] font-bold flex items-center justify-center">
                    {ch.unreadCount! > 99 ? '99+' : ch.unreadCount}
                  </span>
                ) : ch.unread ? (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-label="Okunmamış" />
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );

  return (
    <RequireAuth>
      <AppShell
        guilds={guilds}
        homeActive
        titleBarNav="direct-messages"
        subtitle="Direkt mesajlar"
        onGuildsChanged={() => void reload()}
      >
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden bg-surface relative">
          <div className="hidden md:flex h-full min-h-0 shrink-0">{dmSidebar}</div>

          <MobileDrawer open={dmsOpen} onClose={() => setDmsOpen(false)} side="left" title="Mesajlar">
            {dmSidebar}
          </MobileDrawer>

          <button
            type="button"
            className="md:hidden fixed bottom-20 right-3 z-40 h-11 w-11 rounded-full bg-surface-container-high text-on-surface shadow-float flex items-center justify-center border border-surface-container-highest"
            aria-label="Mesajlar"
            title="Mesajlar"
            onClick={() => setDmsOpen(true)}
          >
            <span className="material-symbols-outlined text-[22px]">forum</span>
          </button>

          <FriendsHub
            className="min-w-0 w-full"
            friends={friends}
            pending={pending}
            blocked={blocked}
            onTabChange={(tab) => {
              if (tab === 'blocked') void loadBlocked();
              if (tab === 'pending') void loadPending();
            }}
            emptyState={
              <DracoEmpty
                mood="peek"
                size={112}
                title="Kimse yok gibi…"
                description="Arkadaş ekle veya bir sunucuya girip sohbet başlat!"
                headset
              />
            }
            headerAction={
              <div className="flex items-center gap-1 sm:gap-space-sm min-w-0">
                <button
                  type="button"
                  className="md:hidden h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  aria-label="Mesajlar"
                  onClick={() => setDmsOpen(true)}
                >
                  <span className="material-symbols-outlined text-[20px]">forum</span>
                </button>
                <button
                  type="button"
                  className="shrink-0 h-9 px-2.5 sm:px-space-md rounded-lg bg-primary text-on-primary font-label-sm sm:font-label-md hover:opacity-90 inline-flex items-center gap-1"
                  onClick={() => setAddOpen((v) => !v)}
                >
                  <span className="material-symbols-outlined text-[18px] sm:hidden leading-none">
                    person_add
                  </span>
                  <span className="sm:hidden">Ekle</span>
                  <span className="hidden sm:inline">Arkadaş ekle</span>
                </button>
              </div>
            }
          />

          {addOpen && (
            <div className="absolute inset-x-0 top-14 z-30 mx-auto w-full max-w-md px-space-md min-w-0">
              <div className="rounded-xl border border-surface-container-highest bg-surface-container-low shadow-float p-space-md min-w-0">
                <p className="font-label-sm text-on-surface-variant mb-space-sm">
                  Kullanıcı adı veya görünen ad ile ara
                </p>
                <input
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  placeholder="ara…"
                  className="w-full h-10 rounded-lg bg-surface-container-highest px-space-md font-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
                <ul className="mt-space-sm max-h-56 overflow-y-auto flex flex-col gap-1 min-w-0">
                  {addResults.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center gap-space-sm px-space-sm py-space-xs rounded-lg hover:bg-surface-container min-w-0"
                    >
                      <span className="flex-1 font-body-sm text-on-surface truncate min-w-0">
                        {u.displayName}{' '}
                        <span className="text-outline">@{u.username}</span>
                      </span>
                      <button
                        type="button"
                        disabled={addBusy}
                        className="shrink-0 h-8 px-2.5 sm:px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                        onClick={() => void sendRequest(u.id)}
                      >
                        <span className="sm:hidden">İstek</span>
                        <span className="hidden sm:inline">İstek gönder</span>
                      </button>
                    </li>
                  ))}
                  {addQuery.trim().length >= 2 && addResults.length === 0 && (
                    <li className="px-space-sm py-space-md font-body-sm text-outline">Sonuç yok</li>
                  )}
                </ul>
                <button
                  type="button"
                  className="mt-space-sm font-label-sm text-outline hover:text-on-surface"
                  onClick={() => setAddOpen(false)}
                >
                  Kapat
                </button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
