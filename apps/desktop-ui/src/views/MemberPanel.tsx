import { useMemo } from 'react';
import { DRACORD_BOT_USER_ID, type PublicUser } from '@dracord/types';
import {
  MemberList,
  presenceLabelTr,
  type MemberListAction,
  type MemberListGroup,
} from '@dracord/ui';
import { useAuth } from '../auth';
import { loadLocalPrefs } from '../lib/client-settings';

export type VoicePeerSummary = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  isBot?: boolean;
};

export function MemberPanel({
  members,
  voicePeers = [],
  inVoice = false,
  onOpenDm,
  buildActions,
  draggable,
  friendIds,
  roleColors: roleColorsProp,
}: {
  members: PublicUser[];
  /** Aktif ses odasındaki katılımcılar — varsa ilk grup “Seste” olur */
  voicePeers?: VoicePeerSummary[];
  inVoice?: boolean;
  onOpenDm?: (userId: string) => void;
  buildActions?: (user: PublicUser) => MemberListAction[];
  draggable?: boolean;
  friendIds?: Set<string>;
  roleColors?: boolean;
}) {
  const { client, user } = useAuth();
  const roleColors =
    roleColorsProp ?? loadLocalPrefs().accessibility.roleColors !== false;

  const groups: MemberListGroup[] = useMemo(() => {
    const mapMember = (
      m: PublicUser,
      opts?: { subtitle?: string; forceOnline?: boolean },
    ): MemberListGroup['members'][number] => {
      const isSelf = m.id === user?.id;
      const isBot = Boolean(m.isBot);
      const topRole = (m.roles ?? [])
        .filter((r) => r.name !== '@everyone')
        .sort((a, b) => b.position - a.position)[0];
      const status = opts?.forceOnline
        ? m.status === 'IDLE' || m.status === 'DND'
          ? m.status
          : 'ONLINE'
        : (m.status ?? 'OFFLINE');

      const defaultActions: MemberListAction[] = [];
      const canDm =
        !isSelf && !isBot && m.id !== DRACORD_BOT_USER_ID;
      if (canDm) {
        defaultActions.push({
          id: 'dm',
          label: 'Mesaj gönder',
          onSelect: () => onOpenDm?.(m.id),
        });
      }
      if (!isSelf && !isBot && m.id !== DRACORD_BOT_USER_ID) {
        if (!friendIds?.has(m.id)) {
          defaultActions.push({
            id: 'friend',
            label: 'Arkadaşlık isteği gönder',
            onSelect: () => {
              void client.sendFriendRequest(m.id);
            },
          });
        }
        defaultActions.push({
          id: 'block',
          label: 'Kullanıcıyı engelle',
          danger: true,
          onSelect: () => {
            void client.blockUser(m.id);
          },
        });
      }

      return {
        id: m.id,
        displayName: m.displayName,
        username: m.username,
        avatarUrl: m.avatarUrl,
        bannerUrl: m.bannerUrl,
        bannerColor: m.bannerColor,
        bio: m.bio,
        status,
        customStatus: m.customStatus,
        socialLinks: m.socialLinks,
        isBot,
        roles: m.roles,
        roleColor: roleColors ? topRole?.color : undefined,
        badges: (m.roles ?? [])
          .filter((r) => r.badgeKey && r.badgeKey !== 'none')
          .map((r) => ({
            id: r.id,
            badgeKey: r.badgeKey,
            color: r.color,
            label: r.name,
          })),
        subtitle:
          opts?.subtitle ?? presenceLabelTr(status, m.customStatus),
        draggable: Boolean(draggable) && m.id !== user?.id && !m.isPlatformAdmin,
        onClick: () => {
          if (canDm) onOpenDm?.(m.id);
        },
        contextActions: buildActions ? buildActions(m) : defaultActions,
      };
    };

    // Web parity: sesdeyken “Seste”, değilse “Çevrimiçi” (kendin / ses katılımcıları)
    const voiceList: MemberListGroup['members'] =
      inVoice && voicePeers.length > 0
        ? voicePeers.map((p) => {
            const m = members.find((g) => g.id === p.id);
            if (m) {
              return mapMember(
                {
                  ...m,
                  displayName: p.displayName || m.displayName,
                  avatarUrl: p.avatarUrl ?? m.avatarUrl,
                },
                { forceOnline: true },
              );
            }
            return {
              id: p.id,
              displayName: p.displayName,
              avatarUrl: p.avatarUrl,
              status: 'ONLINE' as const,
              isBot: Boolean(p.isBot),
              subtitle: presenceLabelTr('ONLINE'),
              onClick: () => onOpenDm?.(p.id),
              contextActions: onOpenDm
                ? [
                    {
                      id: 'dm',
                      label: 'Mesaj gönder',
                      onSelect: () => onOpenDm(p.id),
                    },
                  ]
                : undefined,
            };
          })
        : user
          ? [
              mapMember(
                {
                  id: user.id,
                  username: user.username,
                  displayName: user.displayName,
                  avatarUrl: user.avatarUrl,
                  bannerUrl: user.bannerUrl,
                  bannerColor: user.bannerColor,
                  bio: user.bio,
                  status: user.status,
                  customStatus: user.customStatus,
                  socialLinks: user.socialLinks,
                  isBot: user.isBot,
                  roles: members.find((m) => m.id === user.id)?.roles,
                } as PublicUser,
                { forceOnline: true },
              ),
            ]
          : [];

    return [
      {
        id: 'voice',
        label: inVoice ? 'Seste' : 'Çevrimiçi',
        members: voiceList,
      },
      {
        id: 'members',
        label: 'Üyeler',
        members: members.map((m) => mapMember(m)),
      },
    ];
  }, [
    members,
    voicePeers,
    inVoice,
    client,
    user,
    onOpenDm,
    buildActions,
    draggable,
    friendIds,
    roleColors,
  ]);

  return (
    <aside className="w-64 shrink-0 min-w-[16rem] h-full min-h-0 flex flex-col overflow-hidden">
      <MemberList className="w-full h-full min-h-0" groups={groups} />
    </aside>
  );
}
