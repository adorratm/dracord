'use client';

import type { FriendRow } from '@dracord/ui';
import { FriendsHub } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useGuildNav } from '@/hooks/useGuildNav';

export default function FriendsHubPage() {
  const router = useRouter();
  const { user, client } = useAuth();
  const { guilds } = useGuildNav(undefined);
  const [friends, setFriends] = useState<FriendRow[]>([]);

  useEffect(() => {
    if (!user) return;
    void client
      .getFriends()
      .then((list) => {
        setFriends(
          list.map((f) => ({
            id: f.id,
            displayName: f.displayName,
            avatarUrl: f.avatarUrl,
            status: f.status,
            onMessage: () => router.push('/channels/@me'),
          })),
        );
      })
      .catch(() => {
        setFriends([]);
      });
  }, [client, user, router]);

  return (
    <RequireAuth>
      <AppShell guilds={guilds} homeActive titleBarNav="direct-messages" subtitle="Arkadaşlar">
        <div className="flex flex-1 min-h-0 bg-surface">
          <FriendsHub
            friends={friends}
            pending={[]}
            blocked={[]}
            headerAction={
              <button
                type="button"
                className="px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary-container font-label-md hover:opacity-90"
                onClick={() => {
                  const firstGuild = guilds[0];
                  if (firstGuild) {
                    router.push(`/channels/${firstGuild.id}/seed-ch-genel`);
                  }
                }}
              >
                Sunuculara git
              </button>
            }
          />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
