import { useEffect, useMemo, useState } from 'react';
import type { PublicUser } from '@dracord/types';
import { FriendsHub, Modal } from '@dracord/ui';
import { useAuth } from '../auth';

export function FriendsHubView({ onOpenDm }: { onOpenDm: () => void }) {
  const { client } = useAuth();
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<PublicUser[]>([]);
  const [outgoing, setOutgoing] = useState<PublicUser[]>([]);
  const [blocked, setBlocked] = useState<PublicUser[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    void client.getFriends().then(setFriends);
    void client.getPendingFriends().then((p) => {
      setIncoming(p.incoming ?? []);
      setOutgoing(p.outgoing ?? []);
    });
    void client.listBlocked().then(setBlocked);
  };

  useEffect(() => {
    reload();
  }, [client]);

  const friendRows = useMemo(
    () =>
      friends.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        subtitle: `@${u.username}`,
        onMessage: () => {
          void client.openDm(u.id).then(onOpenDm);
        },
        onClick: () => {
          void client.openDm(u.id).then(onOpenDm);
        },
      })),
    [friends, client, onOpenDm],
  );

  const pendingRows = useMemo(
    () => [
      ...incoming.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        subtitle: 'Gelen istek',
        pendingIncoming: true,
        onAccept: () => void client.acceptFriendRequest(u.id).then(reload),
        onDecline: () => void client.declineFriendRequest(u.id).then(reload),
      })),
      ...outgoing.map((u) => ({
        id: `out-${u.id}`,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        subtitle: 'Giden istek',
        pendingIncoming: false,
      })),
    ],
    [incoming, outgoing, client],
  );

  const blockedRows = useMemo(
    () =>
      blocked.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        status: u.status,
        onUnblock: () => void client.unblockUser(u.id).then(reload),
      })),
    [blocked, client],
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <FriendsHub
        className="flex-1 min-h-0"
        friends={friendRows}
        pending={pendingRows}
        blocked={blockedRows}
        headerAction={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-8 px-3 rounded-lg bg-primary-container text-on-primary-container text-sm font-bold"
          >
            Arkadaş ekle
          </button>
        }
      />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Arkadaş ekle">
        {error && <p className="text-error text-sm mb-2">{error}</p>}
        <form
          className="flex gap-2 mb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!query.trim()) return;
            setError(null);
            void client
              .searchUsers(query.trim())
              .then(setResults)
              .catch((err) => setError(err instanceof Error ? err.message : 'Arama başarısız'));
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kullanıcı ara"
            className="flex-1 h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
          />
          <button
            type="submit"
            className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
          >
            Ara
          </button>
        </form>
        <div className="space-y-2 max-h-64 overflow-auto">
          {results.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 py-2 border-b border-outline-variant">
              <div>
                <div className="font-semibold">{u.displayName}</div>
                <div className="text-xs text-on-surface-variant">@{u.username}</div>
              </div>
              <button
                type="button"
                className="h-8 px-3 rounded-lg bg-primary-container text-on-primary-container text-sm font-bold"
                onClick={() => {
                  void client
                    .sendFriendRequest(u.id)
                    .then(() => {
                      setAddOpen(false);
                      reload();
                    })
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : 'İstek gönderilemedi'),
                    );
                }}
              >
                İstek gönder
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

/** @deprecated use FriendsHubView */
export { FriendsHubView as FriendsHub };
