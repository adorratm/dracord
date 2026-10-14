import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PublicUser } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { FriendsHub, type FriendRow } from '@dracord/ui';
import { useAuth } from '../auth';
import { DracoEmpty } from '../components/Draco';

export function FriendsHubView({
  onOpenDm,
  findChatOpen,
  onFindChatOpenChange,
}: {
  onOpenDm: (channelId: string) => void;
  findChatOpen?: boolean;
  onFindChatOpenChange?: (open: boolean) => void;
}) {
  const { client, user } = useAuth();
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<PublicUser[]>([]);
  const [outgoing, setOutgoing] = useState<PublicUser[]>([]);
  const [blocked, setBlocked] = useState<PublicUser[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openAdd = findChatOpen ?? addOpen;
  const setOpenAdd = (v: boolean) => {
    setAddOpen(v);
    onFindChatOpenChange?.(v);
  };

  useEffect(() => {
    if (findChatOpen != null) setAddOpen(findChatOpen);
  }, [findChatOpen]);

  const openDm = useCallback(
    async (userId: string) => {
      setError(null);
      try {
        const ch = await client.openDm(userId);
        onOpenDm(ch.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'DM açılamadı');
      }
    },
    [client, onOpenDm],
  );

  const loadFriends = useCallback(async () => {
    try {
      setFriends(await client.getFriends());
    } catch {
      setFriends([]);
    }
  }, [client]);

  const loadPending = useCallback(async () => {
    try {
      const p = await client.getPendingFriends();
      setIncoming(p.incoming ?? []);
      setOutgoing(p.outgoing ?? []);
    } catch {
      setIncoming([]);
      setOutgoing([]);
    }
  }, [client]);

  const loadBlocked = useCallback(async () => {
    try {
      setBlocked(await client.listBlocked());
    } catch {
      setBlocked([]);
    }
  }, [client]);

  useEffect(() => {
    void loadFriends();
    void loadPending();
    void loadBlocked();
  }, [loadFriends, loadPending, loadBlocked]);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onPresence = (payload: { userId: string; status: PublicUser['status'] }) => {
      setFriends((prev) =>
        prev.map((f) => (f.id === payload.userId ? { ...f, status: payload.status } : f)),
      );
    };
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    return () => {
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
    };
  }, [client, user]);

  useEffect(() => {
    if (!openAdd || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void client
        .searchUsers(query.trim())
        .then((list) => setResults(list.filter((u) => u.id !== user?.id).slice(0, 8)))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [openAdd, query, client, user?.id]);

  const friendRows: FriendRow[] = useMemo(
    () =>
      friends.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        subtitle: `@${u.username}`,
        onMessage: () => void openDm(u.id),
        onClick: () => void openDm(u.id),
      })),
    [friends, openDm],
  );

  const pendingRows: FriendRow[] = useMemo(
    () => [
      ...incoming.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        pendingIncoming: true,
        subtitle: 'Gelen istek',
        onAccept: () =>
          void client.acceptFriendRequest(u.id).then(() => {
            void loadPending();
            void loadFriends();
          }),
        onDecline: () => void client.declineFriendRequest(u.id).then(loadPending),
      })),
      ...outgoing.map((u) => ({
        id: `out-${u.id}`,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        pendingIncoming: false,
        subtitle: 'Giden istek',
        onDecline: () => void client.declineFriendRequest(u.id).then(loadPending),
      })),
    ],
    [incoming, outgoing, client, loadPending, loadFriends],
  );

  const blockedRows: FriendRow[] = useMemo(
    () =>
      blocked.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        subtitle: 'Engellendi',
        onUnblock: () => void client.unblockUser(u.id).then(loadBlocked),
      })),
    [blocked, client, loadBlocked],
  );

  const sendRequest = async (targetId: string) => {
    setBusy(true);
    setError(null);
    try {
      await client.sendFriendRequest(targetId);
      setQuery('');
      setResults([]);
      await loadPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İstek gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 min-w-0 min-h-0 relative bg-surface">
      <FriendsHub
        className="min-w-0 flex-1"
        friends={friendRows}
        pending={pendingRows}
        blocked={blockedRows}
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
          <button
            type="button"
            className="shrink-0 h-9 px-3 rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 inline-flex items-center gap-1"
            onClick={() => setOpenAdd(true)}
          >
            <span className="material-symbols-outlined text-[18px] leading-none">person_add</span>
            Arkadaş ekle
          </button>
        }
      />

      <aside className="hidden xl:flex w-80 shrink-0 border-l border-surface-container-highest bg-surface-container-low flex-col">
        <div className="px-4 py-4 border-b border-surface-container-highest">
          <p className="font-headline-md text-on-surface">Şimdi Aktif</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <span className="material-symbols-outlined text-[40px] text-outline mb-2">
            sports_esports
          </span>
          <p className="font-label-md text-on-surface">Şu an sessiz</p>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Arkadaşların bir aktivitedeyken burada görünür.
          </p>
        </div>
      </aside>

      {openAdd && (
        <div className="absolute inset-x-0 top-14 z-30 mx-auto w-full max-w-md px-4 min-w-0">
          <div className="rounded-xl border border-surface-container-highest bg-surface-container-low shadow-float p-4 min-w-0">
            <p className="font-label-sm text-on-surface-variant mb-2">
              Kullanıcı adı veya görünen ad ile ara — ya da sohbet başlat
            </p>
            {error && <p className="font-body-sm text-error mb-2">{error}</p>}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ara…"
              className="w-full h-10 rounded-lg bg-surface-container-highest px-3 font-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
            <ul className="mt-2 max-h-56 overflow-y-auto flex flex-col gap-1 min-w-0">
              {results.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container min-w-0"
                >
                  <span className="flex-1 font-body-sm text-on-surface truncate min-w-0">
                    {u.displayName} <span className="text-outline">@{u.username}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    className="shrink-0 h-8 px-2.5 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                    onClick={() => void sendRequest(u.id)}
                  >
                    İstek
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="shrink-0 h-8 px-2.5 rounded-lg bg-surface-container-high font-label-sm disabled:opacity-50"
                    onClick={() => void openDm(u.id).then(() => setOpenAdd(false))}
                  >
                    Mesaj
                  </button>
                </li>
              ))}
              {query.trim().length >= 2 && results.length === 0 && (
                <li className="px-2 py-3 font-body-sm text-outline">Sonuç yok</li>
              )}
            </ul>
            <button
              type="button"
              className="mt-2 font-label-sm text-outline hover:text-on-surface"
              onClick={() => setOpenAdd(false)}
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** @deprecated use FriendsHubView */
export { FriendsHubView as FriendsHub };
