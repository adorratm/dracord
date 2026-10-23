import { useCallback, useEffect, useState } from 'react';
import type { ChannelSummary, PublicUser } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { Avatar } from '@dracord/ui';
import { useAuth } from '../auth';

type Props = {
  active: 'friends' | 'dms';
  activeChannelId?: string | null;
  onFriends: () => void;
  onOpenDmChannel: (channelId: string) => void;
  onOpenSettingsTab?: (tab: 'nitro' | 'gifts' | 'boost') => void;
  onFindChat: () => void;
};

export function DmSidebar({
  active,
  activeChannelId,
  onFriends,
  onOpenDmChannel,
  onOpenSettingsTab,
  onFindChat,
}: Props) {
  const { client, user } = useAuth();
  const [dms, setDms] = useState<ChannelSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    void client
      .listDms()
      .then(setDms)
      .catch(() => setDms([]));
  }, [client]);

  useEffect(() => {
    reload();
  }, [reload]);

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
      // Açık sohbette sayaç artırma
      if (msg.channelId === activeChannelId) return;
      setDms((prev) => {
        if (!prev.some((d) => d.id === msg.channelId)) return prev;
        return prev.map((ch) => {
          if (ch.id !== msg.channelId) return ch;
          const unreadCount = (ch.unreadCount ?? 0) + 1;
          return { ...ch, unreadCount, unread: true };
        });
      });
    };
    const onPresence = (payload: {
      userId: string;
      status: PublicUser['status'];
      activity?: PublicUser['activity'];
      activities?: PublicUser['activities'];
    }) => {
      setDms((prev) =>
        prev.map((ch) =>
          ch.peerUserId === payload.userId
            ? {
                ...ch,
                peerStatus: payload.status,
                peerActivity:
                  payload.activity !== undefined
                    ? payload.activity
                    : ch.peerActivity,
                peerActivities:
                  payload.activities !== undefined
                    ? payload.activities
                    : ch.peerActivities,
              }
            : ch,
        ),
      );
    };
    const onUserUpdate = (payload: {
      userId: string;
      displayName?: string;
      avatarUrl?: string | null;
    }) => {
      setDms((prev) =>
        prev.map((ch) =>
          ch.peerUserId === payload.userId
            ? {
                ...ch,
                name: payload.displayName ?? ch.name,
                peerAvatarUrl:
                  payload.avatarUrl !== undefined
                    ? payload.avatarUrl
                    : ch.peerAvatarUrl,
              }
            : ch,
        ),
      );
    };
    sock.on(SocketEvents.MESSAGE_CREATE, onCreate);
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    sock.on(SocketEvents.USER_UPDATE, onUserUpdate);
    return () => {
      sock.off(SocketEvents.MESSAGE_CREATE, onCreate);
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
      sock.off(SocketEvents.USER_UPDATE, onUserUpdate);
    };
  }, [client, user, dmIdsKey, activeChannelId]);

  const openNotes = () => {
    if (!user) return;
    setError(null);
    void client
      .openDm(user.id)
      .then((ch) => onOpenDmChannel(ch.id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Notlar açılamadı'));
  };

  return (
    <aside className="w-60 h-full shrink-0 border-r border-surface-container-highest bg-surface-container-low flex flex-col min-h-0">
      <div className="px-2 pt-3 pb-2">
        <button
          type="button"
          className="w-full h-8 px-2 rounded-md bg-surface-container-highest text-left font-body-sm text-on-surface-variant hover:text-on-surface truncate"
          onClick={onFindChat}
        >
          Sohbet bul ya da başlat
        </button>
      </div>
      <nav className="px-2 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onFriends}
          className={
            active === 'friends' && !activeChannelId
              ? 'h-10 px-2 rounded-md flex items-center gap-3 bg-surface-container text-on-surface font-label-md'
              : 'h-10 px-2 rounded-md flex items-center gap-3 text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md'
          }
        >
          <span className="material-symbols-outlined text-[22px]">group</span>
          Arkadaşlar
        </button>
        <button
          type="button"
          onClick={() => onOpenSettingsTab?.('nitro')}
          className="h-10 px-2 rounded-md flex items-center gap-3 text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md"
        >
          <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
          Nitro
        </button>
        <button
          type="button"
          onClick={() => onOpenSettingsTab?.('gifts')}
          className="h-10 px-2 rounded-md flex items-center gap-3 text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md"
        >
          <span className="material-symbols-outlined text-[22px]">storefront</span>
          Mağaza
        </button>
        <button
          type="button"
          onClick={() => onOpenSettingsTab?.('boost')}
          className="h-10 px-2 rounded-md flex items-center gap-3 text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md"
        >
          <span className="material-symbols-outlined text-[22px]">diamond</span>
          Takviye
        </button>
      </nav>
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <p className="font-label-sm text-on-surface-variant uppercase tracking-wider font-bold text-[11px]">
          Direkt Mesajlar
        </p>
        <button
          type="button"
          className="w-5 h-5 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
          aria-label="Yeni DM"
          onClick={onFindChat}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
      </div>
      {error && <p className="px-3 font-body-sm text-error">{error}</p>}
      <ul className="flex-1 overflow-y-auto py-1 px-2">
        <li>
          <button
            type="button"
            onClick={openNotes}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-container text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-outline shrink-0 w-8 h-8 flex items-center justify-center">
              sticky_note_2
            </span>
            <span className="font-body-sm text-on-surface truncate flex-1">Notlarım</span>
          </button>
        </li>
        {dms.length === 0 ? (
          <li className="px-2 py-3 font-body-sm text-outline">Henüz DM yok.</li>
        ) : (
          dms
            .filter((ch) => !ch.selfNotes)
            .map((ch) => {
              const selected = activeChannelId === ch.id;
              return (
                <li key={ch.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      void client.markChannelRead(ch.id).catch(() => undefined);
                      setDms((prev) =>
                        prev.map((d) =>
                          d.id === ch.id ? { ...d, unread: false, unreadCount: 0 } : d,
                        ),
                      );
                      onOpenDmChannel(ch.id);
                    }}
                    className={
                      selected
                        ? 'w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-container text-left'
                        : 'w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-container text-left'
                    }
                  >
                    <Avatar
                      displayName={ch.name}
                      imageUrl={ch.peerAvatarUrl}
                      size="md"
                      status={ch.peerStatus ?? undefined}
                    />
                    <span className="font-body-sm text-on-surface truncate flex-1">{ch.name}</span>
                    {(ch.unreadCount ?? 0) > 0 ? (
                      <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-[11px] font-bold flex items-center justify-center group-hover:opacity-0">
                        {ch.unreadCount! > 99 ? '99+' : ch.unreadCount}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    title="Sohbeti listeden kaldır"
                    aria-label="Sohbeti listeden kaldır"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md items-center justify-center text-outline hover:text-on-surface hover:bg-surface-bright hidden group-hover:flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      void client.closeDm(ch.id).then(() => {
                        setDms((prev) => prev.filter((d) => d.id !== ch.id));
                        if (activeChannelId === ch.id) onFriends();
                      });
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </li>
              );
            })
        )}
      </ul>
    </aside>
  );
}
