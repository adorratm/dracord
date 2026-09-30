'use client';

import type { FriendRow } from '@dracord/ui';
import { FriendsHub } from '@dracord/ui';
import type { ChannelSummary } from '@dracord/types';
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
  const { guilds } = useGuildNav(undefined);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [blocked, setBlocked] = useState<FriendRow[]>([]);
  const [dms, setDms] = useState<ChannelSummary[]>([]);
  const [dmError, setDmError] = useState<string | null>(null);
  const [dmsOpen, setDmsOpen] = useState(false);

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
    void client
      .getFriends()
      .then((list) => {
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
      })
      .catch(() => {
        setFriends([]);
      });
    void loadBlocked();
  }, [client, user, openDm, loadBlocked]);

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
        {dmError && (
          <p className="mt-space-xs font-body-sm text-error">{dmError}</p>
        )}
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
                <span className="material-symbols-outlined text-[18px] text-outline shrink-0">
                  {ch.selfNotes ? 'sticky_note_2' : 'person'}
                </span>
                <span className="font-body-sm text-on-surface truncate flex-1">
                  {ch.name}
                </span>
                {ch.unread && (
                  <span
                    className="w-2 h-2 rounded-full bg-primary shrink-0"
                    aria-label="Okunmamış"
                  />
                )}
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );

  return (
    <RequireAuth>
      <AppShell guilds={guilds} homeActive titleBarNav="direct-messages" subtitle="Direkt mesajlar">
        <div className="flex flex-1 min-h-0 bg-surface relative">
          <div className="hidden md:flex h-full min-h-0 shrink-0">{dmSidebar}</div>

          <MobileDrawer
            open={dmsOpen}
            onClose={() => setDmsOpen(false)}
            side="left"
            title="Mesajlar"
          >
            {dmSidebar}
          </MobileDrawer>

          <button
            type="button"
            className="md:hidden fixed bottom-20 left-3 z-40 h-11 w-11 rounded-full bg-surface-container-high text-on-surface shadow-float flex items-center justify-center border border-surface-container-highest"
            aria-label="Mesajlar"
            title="Mesajlar"
            onClick={() => setDmsOpen(true)}
          >
            <span className="material-symbols-outlined text-[22px]">forum</span>
          </button>

          <FriendsHub
            friends={friends}
            pending={[]}
            blocked={blocked}
            emptyState={
              <DracoEmpty
                mood="peek"
                size={112}
                title="Kimse yok gibi…"
                description="Draco da yalnızlık çekiyor. Bir sunucuya girip sohbet başlat!"
                headset
              />
            }
            headerAction={
              <div className="flex items-center gap-space-sm">
                <button
                  type="button"
                  className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  aria-label="Mesajlar"
                  onClick={() => setDmsOpen(true)}
                >
                  <span className="material-symbols-outlined text-[20px]">forum</span>
                </button>
                <button
                  type="button"
                  className="px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary-container font-label-md hover:opacity-90"
                  onClick={() => {
                    const firstGuild = guilds[0];
                    if (firstGuild) router.push(`/channels/${firstGuild.id}`);
                  }}
                >
                  Sunuculara git
                </button>
              </div>
            }
          />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
