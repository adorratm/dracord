import { useMemo } from 'react';
import type { PublicUser } from '@dracord/types';
import { MemberList, type MemberListGroup } from '@dracord/ui';
import { useAuth } from '../auth';

export function MemberPanel({
  members,
  onOpenDm,
}: {
  members: PublicUser[];
  onOpenDm?: (userId: string) => void;
}) {
  const { client, user } = useAuth();

  const groups: MemberListGroup[] = useMemo(() => {
    const online = members.filter((m) => m.status && m.status !== 'OFFLINE');
    const offline = members.filter((m) => !m.status || m.status === 'OFFLINE');
    const map = (list: PublicUser[]) =>
      list.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        username: m.username,
        avatarUrl: m.avatarUrl,
        bannerUrl: m.bannerUrl,
        bannerColor: m.bannerColor,
        bio: m.bio,
        status: m.status ?? 'OFFLINE',
        customStatus: m.customStatus,
        socialLinks: m.socialLinks,
        isBot: m.isBot,
        roles: m.roles,
        onClick: () => onOpenDm?.(m.id),
        contextActions: [
          {
            id: 'dm',
            label: 'Mesaj gönder',
            onSelect: () => onOpenDm?.(m.id),
          },
          ...(m.id !== user?.id
            ? [
                {
                  id: 'friend',
                  label: 'Arkadaş ekle',
                  onSelect: () => {
                    void client.sendFriendRequest(m.id);
                  },
                },
                {
                  id: 'block',
                  label: 'Engelle',
                  danger: true,
                  onSelect: () => {
                    void client.blockUser(m.id);
                  },
                },
              ]
            : []),
        ],
      }));
    const out: MemberListGroup[] = [];
    if (online.length) out.push({ id: 'online', label: `Çevrimiçi — ${online.length}`, members: map(online) });
    if (offline.length)
      out.push({ id: 'offline', label: `Çevrimdışı — ${offline.length}`, members: map(offline) });
    return out;
  }, [members, client, user?.id, onOpenDm]);

  return (
    <aside className="w-60 shrink-0 border-l border-outline-variant bg-surface-container-low min-h-0 flex flex-col">
      <div className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        Üyeler — {members.length}
      </div>
      <MemberList className="flex-1 min-h-0 overflow-auto px-1" groups={groups} />
    </aside>
  );
}
