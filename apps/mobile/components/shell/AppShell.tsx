import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import type {
  CategoryDto,
  ChannelSummary,
  GuildPermissionsDto,
  GuildSummary,
  PresenceStatus,
  PublicUser,
  RoleDto,
  VoiceMemberSummary,
  VoiceStatePayload,
  VoiceSyncPayload,
} from '@dracord/types';
import { DRACORD_BOT_USER_ID, SocketEvents } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { leaveActivityFully } from '../../lib/leaveActivityFully';
import { rememberChannel, readGuildLastChannel, readLastChannel } from '../../lib/lastChannel';
import { ActionsSheet, type ActionSheetItem } from '../ActionsSheet';
import { CreateGuildModal, JoinInviteModal } from '../GuildModals';
import { MemberSheet } from '../MemberSheet';
import { Drawer } from './Drawer';
import { ServerRail } from './ServerRail';
import { ChannelList } from './ChannelList';
import { UserPanel } from './UserPanel';
import { ServerMenu } from './ServerMenu';
import { ProfileSheet, copyUserId, type ProfileAction } from './ProfileSheet';
import { GuildExtrasSheet } from './GuildExtrasSheet';
import { TitleBar } from './TitleBar';
import { useVoiceSessionOptional } from '../voice/VoiceSession';
import { useActivitySessionOptional } from '../activity/ActivitySession';
import { confirmDialog, noticeDialog } from '../ConfirmModal';

type MemberMenuState = {
  title: string;
  subtitle?: string;
  actions: ActionSheetItem[];
};

type ShellMode = 'home' | 'guild';

type AppShellCtx = {
  mode: ShellMode;
  guilds: GuildSummary[];
  guildId: string | null;
  channels: ChannelSummary[];
  categories: CategoryDto[];
  members: PublicUser[];
  activeChannelId: string | null;
  notificationCount: number;
  serversOpen: boolean;
  channelsOpen: boolean;
  membersOpen: boolean;
  setServersOpen: (v: boolean) => void;
  setChannelsOpen: (v: boolean) => void;
  setMembersOpen: (v: boolean) => void;
  reloadGuilds: () => Promise<GuildSummary[]>;
  selectGuild: (id: string, opts?: { openFirst?: boolean }) => Promise<void>;
  goHome: () => void;
  openChannel: (c: ChannelSummary, guildIdOverride?: string) => Promise<void>;
  setActiveChannelId: (id: string | null) => void;
  refreshMembers: () => Promise<void>;
  openProfile: (user: PublicUser) => void;
  openVoiceMember: (member: VoiceMemberSummary, channel?: ChannelSummary) => void;
  openVoiceMemberMenu: (member: VoiceMemberSummary, channel?: ChannelSummary) => void;
  openCreateGuild: () => void;
  openJoinInvite: () => void;
  openServerMenu: () => void;
  guildPermissions: GuildPermissionsDto | null;
};

const Ctx = createContext<AppShellCtx | null>(null);

export function useAppShell() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppShellProvider gerekli');
  return v;
}

export function useAppShellOptional() {
  return useContext(Ctx);
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const { client, user, refreshUser } = useAuth();
  const voice = useVoiceSessionOptional();
  const activity = useActivitySessionOptional();
  const router = useRouter();
  const pathname = usePathname();

  const [mode, setMode] = useState<ShellMode>('guild');
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [guildId, setGuildId] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [guildPermissions, setGuildPermissions] = useState<GuildPermissionsDto | null>(null);
  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);
  const [profileJoinedAt, setProfileJoinedAt] = useState<string | null>(null);
  const [profileActions, setProfileActions] = useState<ProfileAction[]>([]);
  const [guildRoles, setGuildRoles] = useState<RoleDto[]>([]);
  const [memberMenu, setMemberMenu] = useState<MemberMenuState | null>(null);
  const [moveTargetUser, setMoveTargetUser] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(null);
  const setActiveChannelId = useCallback((id: string | null) => {
    setActiveChannelIdState(id);
  }, []);
  const [notificationCount, setNotificationCount] = useState(0);

  const [serversOpen, setServersOpen] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [extrasTab, setExtrasTab] = useState<'events' | 'boost'>('events');
  const [favoriteGuildIds, setFavoriteGuildIds] = useState<string[]>([]);
  const [guildOrderIds, setGuildOrderIds] = useState<string[]>([]);

  const reloadGuilds = useCallback(async () => {
    const g = await client.listGuilds();
    setGuilds(g);
    return g;
  }, [client]);

  useEffect(() => {
    if (!user) return;
    void client
      .getClientSettings()
      .then((s) => {
        setFavoriteGuildIds(s.appearance?.favoriteGuildIds ?? []);
        setGuildOrderIds(s.appearance?.guildOrderIds ?? []);
      })
      .catch(() => undefined);
  }, [client, user?.id]);

  const railGuilds = useMemo(() => {
    const favSet = new Set(favoriteGuildIds);
    const byId = new Map(guilds.map((g) => [g.id, g]));
    const ordered: GuildSummary[] = [];
    for (const id of guildOrderIds) {
      const g = byId.get(id);
      if (g) {
        ordered.push(g);
        byId.delete(id);
      }
    }
    for (const g of byId.values()) ordered.push(g);
    return ordered.map((g) => ({ ...g, favorite: favSet.has(g.id) }));
  }, [guilds, favoriteGuildIds, guildOrderIds]);

  const toggleFavoriteGuild = useCallback(
    (id: string) => {
      const isFav = favoriteGuildIds.includes(id);
      const next = isFav
        ? favoriteGuildIds.filter((x) => x !== id)
        : [...favoriteGuildIds, id];
      setFavoriteGuildIds(next);
      void client
        .getClientSettings()
        .then((s) =>
          client.updateClientSettings({
            appearance: { ...s.appearance, favoriteGuildIds: next },
          }),
        )
        .catch(() => {
          setFavoriteGuildIds(favoriteGuildIds);
        });
    },
    [client, favoriteGuildIds],
  );

  const refreshMembers = useCallback(async () => {
    if (!guildId) {
      setMembers([]);
      return;
    }
    try {
      setMembers(await client.getGuildMembers(guildId));
    } catch {
      setMembers([]);
    }
  }, [client, guildId]);

  const closeNav = useCallback(() => {
    setServersOpen(false);
    setChannelsOpen(false);
  }, []);

  const openChannel = useCallback(
    async (c: ChannelSummary, guildIdOverride?: string) => {
      const gid = guildIdOverride ?? guildId;
      if (!gid) return;

      const go = async () => {
        await rememberChannel(gid, c.id);
        setActiveChannelId(c.id);
        setMode('guild');
        setGuildId(gid);
        closeNav();
        if (c.type === 'VOICE') {
          router.push(`/(app)/voice/${gid}/${c.id}`);
        } else if (c.type === 'GAME' || c.type === 'WATCH_PARTY') {
          router.push(`/(app)/activity/${gid}/${c.id}`);
        } else {
          router.push(`/(app)/channels/${gid}/${c.id}`);
        }
      };

      // Başka sesteyken yeni ses kanalına geçiş — onayla; sunucu gezinmesi bozulmasın
      if (
        c.type === 'VOICE' &&
        voice?.voiceChannelId &&
        voice.voiceChannelId !== c.id
      ) {
        const ok = await confirmDialog({
          title: 'Ses kanalı değiştir',
          message: `"${voice.voiceChannelName ?? 'Mevcut kanal'}" odasından çıkıp bu kanala katılmak istiyor musun?`,
          confirmLabel: 'Katıl',
          destructive: true,
        });
        if (!ok) return;
        if (activity?.activityChannelId) {
          await leaveActivityFully({
            client,
            sessionId: activity.activitySessionId,
            channelId: activity.activityChannelId,
            clearActiveActivity: activity.clearActiveActivity,
            voice,
          });
        }
        await go();
        return;
      }

      // Aktivitedeyken ses kanalına gir — oyun sesinden de çık
      if (c.type === 'VOICE' && activity?.activityChannelId) {
        await leaveActivityFully({
          client,
          sessionId: activity.activitySessionId,
          channelId: activity.activityChannelId,
          clearActiveActivity: activity.clearActiveActivity,
          voice,
        });
        await go();
        return;
      }

      // Başka aktivitedeyken yeni oyun/watch party — onayla; menü gezinmesi bozulmasın
      if (
        (c.type === 'GAME' || c.type === 'WATCH_PARTY') &&
        activity?.activityChannelId &&
        activity.activityChannelId !== c.id
      ) {
        const ok = await confirmDialog({
          title: 'Aktivite değiştir',
          message: `"${activity.activityChannelName ?? 'Mevcut aktivite'}" odasından çıkıp bu kanala katılmak istiyor musun?`,
          confirmLabel: 'Katıl',
          destructive: true,
        });
        if (!ok) return;
        await leaveActivityFully({
          client,
          sessionId: activity.activitySessionId,
          channelId: activity.activityChannelId,
          clearActiveActivity: activity.clearActiveActivity,
          voice,
        });
        await go();
        return;
      }

      await go();
    },
    [
      client,
      guildId,
      router,
      closeNav,
      voice,
      voice?.voiceChannelId,
      voice?.voiceChannelName,
      activity?.activityChannelId,
      activity?.activityChannelName,
      activity?.activitySessionId,
      activity?.clearActiveActivity,
    ],
  );

  const selectGuild = useCallback(
    async (id: string, opts?: { openFirst?: boolean }) => {
      setMode('guild');
      setGuildId(id);
      // Sunucu değişiminde nav açık kalsın — kanal seçilene kadar liste görünsün
      const [chs, cats] = await Promise.all([
        client.getGuildChannels(id),
        client.listGuildCategories(id).catch(() => [] as CategoryDto[]),
      ]);
      setChannels(chs);
      setCategories(cats);
      void client.getGuildMembers(id).then(setMembers).catch(() => setMembers([]));

      // Ses/aktivitedeyken başka sunucuya bak: oturumdan çıkma, sadece kanal listesini göster
      const browsingWhileInVoice =
        Boolean(voice?.voiceChannelId) && voice?.voiceGuildId !== id;
      const browsingWhileInActivity =
        Boolean(activity?.activityChannelId) && activity?.activityGuildId !== id;

      if (opts?.openFirst === false || browsingWhileInVoice || browsingWhileInActivity) {
        router.push('/(app)/guilds');
        return;
      }
      // Drawer içinden seçildiyse hemen kanala atlama; kullanıcı kanal seçsin
      if (serversOpen || channelsOpen) {
        router.push('/(app)/guilds');
        return;
      }
      const preferId = await readGuildLastChannel(id);
      const isLiveMedia = (c: ChannelSummary) =>
        c.type === 'VOICE' || c.type === 'GAME' || c.type === 'WATCH_PARTY';
      const liveChannelId = voice?.voiceChannelId ?? activity?.activityChannelId ?? null;
      const preferRaw = preferId ? chs.find((c) => c.id === preferId) : undefined;
      // Canlı oturumdayken rastgele ses/oyun kanalına atlama
      const prefer =
        preferRaw && isLiveMedia(preferRaw) && preferRaw.id !== liveChannelId
          ? undefined
          : preferRaw;
      const first =
        prefer ??
        chs.find((c) => c.type === 'TEXT') ??
        chs.find((c) => c.type !== 'CATEGORY' && !isLiveMedia(c)) ??
        chs.find((c) => c.type !== 'CATEGORY');
      const wouldLeaveLive =
        first &&
        isLiveMedia(first) &&
        liveChannelId != null &&
        first.id !== liveChannelId;
      if (first && first.type !== 'CATEGORY' && !wouldLeaveLive) {
        await openChannel(first, id);
      } else {
        router.push('/(app)/guilds');
      }
    },
    [
      client,
      openChannel,
      router,
      serversOpen,
      channelsOpen,
      voice?.voiceChannelId,
      voice?.voiceGuildId,
      activity?.activityChannelId,
      activity?.activityGuildId,
    ],
  );

  const goHome = useCallback(() => {
    setMode('home');
    setGuildId(null);
    setActiveChannelId(null);
    setCategories([]);
    closeNav();
    router.push('/(app)/guilds');
  }, [router, closeNav]);

  useEffect(() => {
    void (async () => {
      const g = await reloadGuilds();
      if (!g.length) {
        setMode('home');
        return;
      }
      const last = await readLastChannel();
      if (last && g.some((x) => x.id === last.guildId)) {
        setGuildId(last.guildId);
        setMode('guild');
        const [chs, cats] = await Promise.all([
          client.getGuildChannels(last.guildId),
          client.listGuildCategories(last.guildId).catch(() => [] as CategoryDto[]),
        ]);
        setChannels(chs);
        setCategories(cats);
        setActiveChannelId(last.channelId);
        return;
      }
      setGuildId(g[0]!.id);
      setMode('guild');
    })();
  }, [client, reloadGuilds]);

  useEffect(() => {
    if (!guildId || mode !== 'guild') return;
    void client.getGuildChannels(guildId).then(setChannels);
    void client
      .listGuildCategories(guildId)
      .then(setCategories)
      .catch(() => setCategories([]));
    void client
      .getGuildPermissions(guildId)
      .then(setGuildPermissions)
      .catch(() => setGuildPermissions(null));
    void client
      .listGuildRoles(guildId)
      .then(setGuildRoles)
      .catch(() => setGuildRoles([]));
    void refreshMembers();
  }, [client, guildId, mode, refreshMembers]);

  const findMemberVoiceChannelId = useCallback(
    (userId: string, preferred?: string | null) => {
      if (preferred) return preferred;
      const live = channels.find(
        (c) =>
          (c.type === 'VOICE' || c.type === 'GAME' || c.type === 'WATCH_PARTY') &&
          (c.voiceMembers ?? []).some((m) => m.id === userId),
      );
      return live?.id ?? voice?.voiceChannelId ?? null;
    },
    [channels, voice?.voiceChannelId],
  );

  const buildMemberActions = useCallback(
    (target: PublicUser, opts?: { voiceChannelId?: string | null; joinedAt?: string | null }) => {
      const actions: ProfileAction[] = [];
      const isSelf = target.id === user?.id;
      const isBot = Boolean(target.isBot) || target.id === DRACORD_BOT_USER_ID;
      const isPlatformAdmin = Boolean(target.isPlatformAdmin);
      const perms = guildPermissions?.permissions ?? [];
      const elevated = Boolean(guildPermissions?.owner || guildPermissions?.platformAdmin);
      const canKick = elevated || perms.includes('KICK_MEMBERS');
      const canBan = elevated || perms.includes('BAN_MEMBERS');
      const canModerate = elevated || perms.includes('MODERATE_MEMBERS');
      const canManageChannels = elevated || perms.includes('MANAGE_CHANNELS');
      const canMoveMembers = elevated || perms.includes('MOVE_MEMBERS');
      const canManageRoles = elevated || perms.includes('MANAGE_ROLES');
      const voiceChId = findMemberVoiceChannelId(target.id, opts?.voiceChannelId);
      const voiceChannel = voiceChId ? channels.find((c) => c.id === voiceChId) : undefined;
      const denied = Boolean(voiceChannel?.deniedUserIds?.includes(target.id));
      const inVoice = Boolean(voiceChId);

      if (isSelf) {
        actions.push(
          {
            id: 'settings-profile',
            icon: 'person',
            label: 'Profil ayarları',
            onSelect: () => router.push('/(app)/settings'),
          },
          {
            id: 'settings',
            icon: 'settings',
            label: 'Kullanıcı ayarları',
            onSelect: () => router.push('/(app)/settings'),
          },
          {
            id: 'voice-settings',
            icon: 'headphones',
            label: 'Ses ve görüntü ayarları',
            onSelect: () => router.push('/(app)/settings'),
          },
          {
            id: 'copy-id',
            icon: 'content_copy',
            label: 'Kullanıcı ID’sini kopyala',
            onSelect: () => void copyUserId(target.id),
          },
        );
        return actions;
      }

      if (!isBot) {
        actions.push({
          id: 'dm',
          icon: 'chat',
          label: 'Mesaj gönder',
          onSelect: () => {
            void client
              .openDm(target.id)
              .then(() => router.push('/(app)/dms'))
              .catch((e) =>
                noticeDialog('Hata', e instanceof Error ? e.message : 'DM açılamadı'),
              );
          },
        });
        actions.push({
          id: 'friend',
          icon: 'person_add',
          label: 'Arkadaşlık isteği gönder',
          onSelect: () => {
            void client
              .sendFriendRequest(target.id)
              .then(() => noticeDialog('İstek gönderildi', `@${target.username}`))
              .catch((e) =>
                noticeDialog('Hata', e instanceof Error ? e.message : 'İstek gönderilemedi'),
              );
          },
        });
        actions.push({
          id: 'block',
          icon: 'block',
          label: 'Kullanıcıyı engelle',
          danger: true,
          onSelect: () => {
            void confirmDialog({
              title: 'Engelle',
              message: `@${target.username} engellensin mi?`,
              confirmLabel: 'Engelle',
              destructive: true,
            }).then((ok) => {
              if (!ok) return;
              void client
                .blockUser(target.id)
                .then(() => noticeDialog('Engellendi', `@${target.username}`))
                .catch((e) =>
                  noticeDialog('Hata', e instanceof Error ? e.message : 'Engellenemedi'),
                );
            });
          },
        });
      }

      if (!isSelf && canManageChannels && (inVoice || voice?.voiceChannelId)) {
        const chForDeny = voiceChId ?? voice?.voiceChannelId;
        if (chForDeny) {
          if (denied) {
            actions.push({
              id: 'allow-voice',
              icon: 'volume_up',
              label: 'Ses odası engelini kaldır',
              onSelect: () => {
                void client
                  .allowVoiceUser(chForDeny, target.id)
                  .then(() => {
                    if (guildId) void client.getGuildChannels(guildId).then(setChannels);
                    void noticeDialog('Engel kaldırıldı', target.displayName);
                  })
                  .catch((e) =>
                    noticeDialog('Hata', e instanceof Error ? e.message : 'Engel kaldırılamadı'),
                  );
              },
            });
          } else {
            actions.push({
              id: 'deny-voice',
              icon: 'volume_off',
              label: 'Ses odasından engelle',
              danger: true,
              onSelect: () => {
                void confirmDialog({
                  title: 'Ses odası engeli',
                  message: `${target.displayName} bu odadan engellensin mi?`,
                  confirmLabel: 'Engelle',
                  destructive: true,
                }).then((ok) => {
                  if (!ok) return;
                  void client
                    .denyVoiceUser(chForDeny, target.id)
                    .then(() => {
                      if (guildId) void client.getGuildChannels(guildId).then(setChannels);
                      void noticeDialog('Engellendi', target.displayName);
                    })
                    .catch((e) =>
                      noticeDialog('Hata', e instanceof Error ? e.message : 'Engellenemedi'),
                    );
                });
              },
            });
          }
        }
      }

      if (!isSelf && canMoveMembers && !isPlatformAdmin) {
        actions.push({
          id: 'move-voice',
          icon: 'swap_horiz',
          label: 'Ses kanalına taşı…',
          onSelect: () =>
            setMoveTargetUser({ id: target.id, displayName: target.displayName }),
        });
        if (inVoice && voiceChId) {
          actions.push({
            id: 'disconnect-voice',
            icon: 'call_end',
            label: 'Odadan ayır',
            onSelect: () => {
              void client
                .disconnectVoiceUser(voiceChId, target.id)
                .then(() => {
                  if (guildId) void client.getGuildChannels(guildId).then(setChannels);
                  void noticeDialog('Ayrıldı', `${target.displayName} odadan çıkarıldı`);
                })
                .catch((e) =>
                  noticeDialog('Hata', e instanceof Error ? e.message : 'Odadan ayrılamadı'),
                );
            },
          });
        }
      }

      if (guildId && canKick && !isBot && !isPlatformAdmin) {
        actions.push({
          id: 'kick',
          icon: 'person_remove',
          label: 'Sunucudan at',
          danger: true,
          onSelect: () => {
            void confirmDialog({
              title: 'At',
              message: `${target.displayName} sunucudan atılsın mı?`,
              confirmLabel: 'At',
              destructive: true,
            }).then((ok) => {
              if (!ok) return;
              void client
                .kickGuildMember(guildId, target.id)
                .then(() => void refreshMembers())
                .catch((e) =>
                  noticeDialog('Hata', e instanceof Error ? e.message : 'Atılamadı'),
                );
            });
          },
        });
      }
      if (guildId && canBan && !isBot && !isPlatformAdmin) {
        actions.push({
          id: 'ban',
          icon: 'gavel',
          label: 'Yasakla',
          danger: true,
          onSelect: () => {
            void confirmDialog({
              title: 'Yasakla',
              message: `${target.displayName} yasaklansın mı?`,
              confirmLabel: 'Yasakla',
              destructive: true,
            }).then((ok) => {
              if (!ok) return;
              void client
                .banGuildMember(guildId, target.id)
                .then(() => void refreshMembers())
                .catch((e) =>
                  noticeDialog('Hata', e instanceof Error ? e.message : 'Yasaklanamadı'),
                );
            });
          },
        });
      }
      if (guildId && canModerate && !isBot && !isPlatformAdmin) {
        actions.push({
          id: 'timeout',
          icon: 'timer',
          label: 'Timeout (10 dk)',
          danger: true,
          onSelect: () => {
            void client
              .timeoutGuildMember(guildId, target.id, 10)
              .then(() => noticeDialog('Timeout', '10 dakika uygulandı'))
              .catch((e) =>
                noticeDialog('Hata', e instanceof Error ? e.message : 'Timeout uygulanamadı'),
              );
          },
        });
      }

      if (guildId && canManageRoles && !isBot) {
        for (const role of guildRoles.filter((r) => r.name !== '@everyone')) {
          const has = (target.roles ?? []).some((r) => r.id === role.id);
          actions.push({
            id: `role-${role.id}`,
            icon: has ? 'remove_circle' : 'add_circle',
            label: has ? `Rol kaldır: ${role.name}` : `Rol ver: ${role.name}`,
            onSelect: () => {
              void (has
                ? client.removeMemberRole(guildId, target.id, role.id)
                : client.addMemberRole(guildId, target.id, role.id)
              )
                .then(() => void refreshMembers())
                .catch((e) =>
                  noticeDialog('Hata', e instanceof Error ? e.message : 'Rol güncellenemedi'),
                );
            },
          });
        }
      }

      actions.push({
        id: 'copy-id',
        icon: 'content_copy',
        label: 'Kullanıcı ID’sini kopyala',
        onSelect: () => void copyUserId(target.id),
      });

      return actions;
    },
    [
      user?.id,
      guildPermissions,
      guildId,
      client,
      router,
      refreshMembers,
      findMemberVoiceChannelId,
      channels,
      voice?.voiceChannelId,
      guildRoles,
    ],
  );

  const openProfileForUser = useCallback(
    (u: PublicUser, opts?: { joinedAt?: string | null }) => {
      setProfileUser(u);
      setProfileJoinedAt(opts?.joinedAt ?? null);
      setProfileActions(buildMemberActions(u, { joinedAt: opts?.joinedAt }));
    },
    [buildMemberActions],
  );

  const openMemberMenu = useCallback(
    (target: PublicUser, opts?: { voiceChannelId?: string | null; joinedAt?: string | null }) => {
      const actions: ActionSheetItem[] = [
        {
          id: 'profile',
          icon: 'account_circle',
          label: 'Profili gör',
          onSelect: () => openProfileForUser(target, { joinedAt: opts?.joinedAt }),
        },
        ...buildMemberActions(target, opts).map((a) => ({
          id: a.id,
          icon: a.icon,
          label: a.label,
          danger: a.danger,
          onSelect: a.onSelect,
        })),
      ];
      setMemberMenu({
        title: target.displayName,
        subtitle: `@${target.username}`,
        actions,
      });
    },
    [buildMemberActions, openProfileForUser],
  );

  const openVoiceMember = useCallback(
    (member: VoiceMemberSummary, _channel?: ChannelSummary) => {
      const fromGuild = members.find((m) => m.id === member.id);
      const asUser: PublicUser =
        fromGuild ??
        ({
          id: member.id,
          username: member.displayName.toLowerCase().replace(/\s+/g, ''),
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          status: 'ONLINE',
          isBot: member.isBot,
        } as PublicUser);
      openProfileForUser(asUser, { joinedAt: member.joinedAt });
    },
    [members, openProfileForUser],
  );

  const showVoiceMemberMenu = useCallback(
    (member: VoiceMemberSummary, channel?: ChannelSummary) => {
      const fromGuild = members.find((m) => m.id === member.id);
      const asUser: PublicUser =
        fromGuild ??
        ({
          id: member.id,
          username: member.displayName.toLowerCase().replace(/\s+/g, ''),
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          status: 'ONLINE',
          isBot: member.isBot,
        } as PublicUser);
      openMemberMenu(asUser, {
        voiceChannelId: channel?.id,
        joinedAt: member.joinedAt,
      });
    },
    [members, openMemberMenu],
  );

  const reloadChannels = useCallback(() => {
    if (!guildId) return;
    void client
      .getGuildChannels(guildId)
      .then((chs) => {
        setChannels((prev) => {
          const prevById = new Map(prev.map((c) => [c.id, c]));
          return chs.map((ch) => {
            if (
              ch.type !== 'VOICE' &&
              ch.type !== 'GAME' &&
              ch.type !== 'WATCH_PARTY'
            ) {
              return ch;
            }
            const apiList = [...(ch.voiceMembers ?? [])];
            const prevList = prevById.get(ch.id)?.voiceMembers ?? [];
            const byId = new Map(apiList.map((m) => [m.id, m]));
            if (apiList.length === 0) {
              for (const m of prevList) byId.set(m.id, m);
            } else {
              for (const m of prevList) {
                const existing = byId.get(m.id);
                if (!existing) {
                  byId.set(m.id, m);
                  continue;
                }
                byId.set(m.id, {
                  ...existing,
                  ...m,
                  speaking: m.speaking ?? existing.speaking,
                });
              }
            }
            return { ...ch, voiceMembers: [...byId.values()] };
          });
        });
      })
      .catch(() => undefined);
  }, [client, guildId]);

  const voiceReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReloadChannels = useCallback(() => {
    if (voiceReloadTimer.current) clearTimeout(voiceReloadTimer.current);
    voiceReloadTimer.current = setTimeout(() => {
      voiceReloadTimer.current = null;
      reloadChannels();
    }, 280);
  }, [reloadChannels]);

  // Ses aktifliği — anında local merge + debounce API refresh + roster sync
  useEffect(() => {
    if (!guildId) return;
    const sock = client.connectSocket();
    client.requestVoiceSync(guildId);

    const applyRoster = (membersByChannel: Record<string, VoiceMemberSummary[]>) => {
      setChannels((prev) =>
        prev.map((ch) => {
          if (
            ch.type !== 'VOICE' &&
            ch.type !== 'GAME' &&
            ch.type !== 'WATCH_PARTY'
          ) {
            return ch;
          }
          // Bağlı kanalı LiveKit peers birleşimi korusun
          if (voice?.voiceChannelId === ch.id && voice?.voiceGuildId === guildId) {
            return ch;
          }
          const list = [...(membersByChannel[ch.id] ?? [])];
          const same =
            list.length === (ch.voiceMembers?.length ?? 0) &&
            list.every((m, i) => m.id === ch.voiceMembers?.[i]?.id);
          return same ? ch : { ...ch, voiceMembers: list };
        }),
      );
    };

    const onVoice = (payload: VoiceStatePayload) => {
      if (payload.guildId !== guildId) return;
      setChannels((prev) =>
        prev.map((ch) => {
          if (
            ch.type !== 'VOICE' &&
            ch.type !== 'GAME' &&
            ch.type !== 'WATCH_PARTY'
          ) {
            return ch;
          }
          let list = [...(ch.voiceMembers ?? [])].filter(
            (m) => m.id !== payload.user.id,
          );
          if (
            payload.action !== 'leave' &&
            payload.channelId &&
            ch.id === payload.channelId
          ) {
            list.push(payload.user);
          }
          const same =
            list.length === (ch.voiceMembers?.length ?? 0) &&
            list.every((m, i) => m.id === ch.voiceMembers?.[i]?.id);
          return same ? ch : { ...ch, voiceMembers: list };
        }),
      );
      scheduleReloadChannels();
    };

    const onSync = (payload: VoiceSyncPayload) => {
      if (payload.guildId !== guildId) return;
      applyRoster(payload.membersByChannel);
    };

    sock.on(SocketEvents.VOICE_STATE, onVoice);
    sock.on(SocketEvents.VOICE_SYNC, onSync);
    return () => {
      sock.off(SocketEvents.VOICE_STATE, onVoice);
      sock.off(SocketEvents.VOICE_SYNC, onSync);
      if (voiceReloadTimer.current) clearTimeout(voiceReloadTimer.current);
    };
  }, [
    client,
    guildId,
    scheduleReloadChannels,
    voice?.voiceChannelId,
    voice?.voiceGuildId,
  ]);

  // Periyodik REST roster — kanala girmeden kimler görünür
  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;
    const pull = () => {
      void client
        .getGuildVoiceRoster(guildId)
        .then((roster) => {
          if (cancelled) return;
          setChannels((prev) =>
            prev.map((ch) => {
              if (
                ch.type !== 'VOICE' &&
                ch.type !== 'GAME' &&
                ch.type !== 'WATCH_PARTY'
              ) {
                return ch;
              }
              if (voice?.voiceChannelId === ch.id && voice?.voiceGuildId === guildId) {
                return ch;
              }
              const list = [...(roster.membersByChannel[ch.id] ?? [])];
              const same =
                list.length === (ch.voiceMembers?.length ?? 0) &&
                list.every((m, i) => m.id === ch.voiceMembers?.[i]?.id);
              return same ? ch : { ...ch, voiceMembers: list };
            }),
          );
        })
        .catch(() => undefined);
    };
    pull();
    const id = setInterval(pull, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, guildId, voice?.voiceChannelId, voice?.voiceGuildId]);

  // Sesten çıkınca self’i anında listeden düş (API gecikse bile)
  useEffect(() => {
    if (!user?.id || !guildId) return;
    if (voice?.voiceChannelId) return;
    const aid = activity?.activityChannelId;
    setChannels((prev) => {
      let changed = false;
      const next = prev.map((ch) => {
        if (aid && ch.id === aid) return ch;
        if (
          (ch.type !== 'VOICE' &&
            ch.type !== 'GAME' &&
            ch.type !== 'WATCH_PARTY') ||
          !ch.voiceMembers?.some((m) => m.id === user.id)
        ) {
          return ch;
        }
        changed = true;
        return {
          ...ch,
          voiceMembers: ch.voiceMembers!.filter((m) => m.id !== user.id),
        };
      });
      return changed ? next : prev;
    });
    reloadChannels();
  }, [
    user?.id,
    guildId,
    voice?.voiceChannelId,
    activity?.activityChannelId,
    reloadChannels,
  ]);

  // Ses kanalına katılınca hemen yenile (oyun→ses geçişinde liste boş kalmasın)
  const lastVoiceRefreshKey = useRef<string | null>(null);
  useEffect(() => {
    if (!guildId) return;
    if (!voice?.voiceChannelId || voice.voiceGuildId !== guildId) {
      lastVoiceRefreshKey.current = null;
      return;
    }
    const key = `${voice.voiceChannelId}:${voice.connected ? '1' : '0'}`;
    if (lastVoiceRefreshKey.current === key) return;
    lastVoiceRefreshKey.current = key;
    reloadChannels();
    if (voice.connected) {
      const t = setTimeout(reloadChannels, 450);
      return () => clearTimeout(t);
    }
  }, [
    guildId,
    voice?.voiceChannelId,
    voice?.voiceGuildId,
    voice?.connected,
    reloadChannels,
  ]);

  // Nav açıkken veya seste/aktivitedeyken seyrek poll (simülatör yükünü düşür)
  useEffect(() => {
    if (!guildId) return;
    const needPoll =
      channelsOpen ||
      serversOpen ||
      Boolean(voice?.voiceChannelId && voice.voiceGuildId === guildId) ||
      Boolean(activity?.activityChannelId && activity.activityGuildId === guildId);
    if (!needPoll) return;
    const tick = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      reloadChannels();
    }, 45_000);
    return () => clearInterval(tick);
  }, [
    guildId,
    channelsOpen,
    serversOpen,
    voice?.voiceChannelId,
    voice?.voiceGuildId,
    activity?.activityChannelId,
    activity?.activityGuildId,
    reloadChannels,
  ]);

  // Üye presence — çevrimiçi/çevrimdışı anlık
  useEffect(() => {
    const sock = client.connectSocket();
    const onPresence = (payload: {
      userId: string;
      status: PresenceStatus;
      customStatus?: string | null;
    }) => {
      setMembers((prev) => {
        if (!prev.some((m) => m.id === payload.userId)) return prev;
        return prev.map((m) =>
          m.id === payload.userId
            ? {
                ...m,
                status: payload.status,
                customStatus:
                  payload.customStatus !== undefined
                    ? payload.customStatus
                    : m.customStatus,
              }
            : m,
        );
      });
    };
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    return () => {
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
    };
  }, [client]);

  // Aktivite üye listesi — overlay’de oyun/watch party katılımcıları
  useEffect(() => {
    const aid = activity?.activityChannelId;
    const agid = activity?.activityGuildId;
    if (!aid || !agid) return;
    client.connectSocket();
    client.joinChannel(aid);
    const sock = client.connectSocket();
    const refresh = () => {
      if (guildId === agid) scheduleReloadChannels();
    };
    refresh();
    sock.on(SocketEvents.ACTIVITY_UPSERT, refresh);
    sock.on(SocketEvents.ACTIVITY_LEAVE, refresh);
    return () => {
      sock.off(SocketEvents.ACTIVITY_UPSERT, refresh);
      sock.off(SocketEvents.ACTIVITY_LEAVE, refresh);
    };
  }, [
    client,
    guildId,
    activity?.activityChannelId,
    activity?.activityGuildId,
    activity?.activitySessionId,
    scheduleReloadChannels,
  ]);

  /** Overlay: aktivite + bağlı ses kanalında self/üyeleri birleştir */
  const channelsForList = useMemo(() => {
    const aid = activity?.activityChannelId;
    const agid = activity?.activityGuildId;
    const vid = voice?.voiceChannelId;
    const vgid = voice?.voiceGuildId;
    const participantIds = activity?.activityParticipantIds ?? [];

    return channels.map((ch) => {
      let membersList = ch.voiceMembers ?? [];
      let changed = false;

      // Bağlı olmadığımız ses / oyun / watch’tan self hayaleti temizle
      if (
        user &&
        (ch.type === 'VOICE' || ch.type === 'GAME' || ch.type === 'WATCH_PARTY') &&
        membersList.some((m) => m.id === user.id)
      ) {
        const liveHere =
          (vid != null && ch.id === vid) ||
          (aid != null && ch.id === aid && (!vid || vid === aid));
        if (!liveHere) {
          membersList = membersList.filter((m) => m.id !== user.id);
          changed = true;
        }
      }

      // Aktivite kanalı: katılımcıları göster (gerçek ses başka kanaldaysa self ekleme)
      if (aid && agid === guildId && ch.id === aid) {
        const byId = new Map(membersList.map((m) => [m.id, m]));
        for (const id of participantIds) {
          if (byId.has(id)) continue;
          const fromGuild = members.find((m) => m.id === id);
          if (fromGuild) {
            byId.set(id, {
              id: fromGuild.id,
              displayName: fromGuild.displayName,
              avatarUrl: fromGuild.avatarUrl,
              muted: false,
              deafened: false,
              isBot: Boolean(fromGuild.isBot),
            });
          } else if (user?.id === id) {
            byId.set(id, {
              id: user.id,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              muted: false,
              deafened: false,
              isBot: Boolean(user.isBot),
            });
          }
        }
        const selfOnThisVoice = !vid || vid === aid;
        if (user && !byId.has(user.id) && selfOnThisVoice) {
          byId.set(user.id, {
            id: user.id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            muted: false,
            deafened: false,
            isBot: Boolean(user.isBot),
            joinedAt: new Date().toISOString(),
          });
        } else if (user && byId.has(user.id) && vid && vid !== aid) {
          byId.delete(user.id);
        }
        return { ...ch, voiceMembers: [...byId.values()] };
      }

      // Bağlı ses kanalı: API + LiveKit peer’ları (oyun→ses geçişinde boş liste olmasın)
      if (vid && vgid === guildId && ch.id === vid) {
        const byId = new Map(membersList.map((m) => [m.id, m]));
        if (user && !byId.has(user.id)) {
          byId.set(user.id, {
            id: user.id,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            muted: Boolean(voice?.muted),
            deafened: Boolean(voice?.deafened),
            isBot: Boolean(user.isBot),
            joinedAt: new Date().toISOString(),
          });
        }
        for (const p of voice?.peers ?? []) {
          const peerId =
            p.id === 'self' || (user && p.id === user.id) ? user!.id : p.id;
          if (user && peerId === user.id) {
            const existing = byId.get(user.id);
            byId.set(user.id, {
              id: user.id,
              displayName: existing?.displayName ?? user.displayName,
              avatarUrl: existing?.avatarUrl ?? user.avatarUrl,
              muted: existing?.muted ?? Boolean(voice?.muted),
              deafened: existing?.deafened ?? Boolean(voice?.deafened),
              isBot: existing?.isBot ?? Boolean(user.isBot),
              joinedAt: existing?.joinedAt,
              speaking: p.speaking,
            });
            continue;
          }
          const existing = byId.get(peerId);
          if (existing) {
            byId.set(peerId, {
              ...existing,
              displayName: p.name,
              speaking: p.speaking,
            });
          } else {
            byId.set(peerId, {
              id: peerId,
              displayName: p.name,
              avatarUrl: null,
              speaking: p.speaking,
              muted: false,
              deafened: false,
            });
          }
        }
        return { ...ch, voiceMembers: [...byId.values()] };
      }

      return changed ? { ...ch, voiceMembers: membersList } : ch;
    });
  }, [
    channels,
    guildId,
    members,
    user,
    activity?.activityChannelId,
    activity?.activityGuildId,
    activity?.activityParticipantIds,
    voice?.voiceChannelId,
    voice?.voiceGuildId,
    voice?.muted,
    voice?.deafened,
    voice?.peers,
  ]);

  useEffect(() => {
    const tick = () => {
      if (AppState.currentState !== 'active') return;
      void client
        .notificationsUnreadCount()
        .then((r) => setNotificationCount(r.count))
        .catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [client]);

  // Route’tan aktif kanalı senkronla
  useEffect(() => {
    const m = pathname?.match(/\/(channels|voice|activity)\/([^/]+)\/([^/]+)/);
    if (m) {
      setGuildId(m[2]!);
      setActiveChannelId(m[3]!);
      setMode('guild');
    }
  }, [pathname]);

  const leaveGuild = () => {
    if (!guildId) return;
    void confirmDialog({
      title: 'Sunucudan ayrıl',
      message: 'Bu sunucudan ayrılmak istiyor musun?',
      confirmLabel: 'Ayrıl',
      destructive: true,
    }).then((ok) => {
      if (!ok) return;
      void client.leaveGuild(guildId).then(async () => {
        const g = await reloadGuilds();
        setServerMenuOpen(false);
        if (g[0]) void selectGuild(g[0].id);
        else goHome();
      });
    });
  };

  const createInvite = () => {
    if (!guildId) return;
    void client
      .createInvite(guildId)
      .then((inv) => {
        void noticeDialog('Davet kodu', inv.code);
        setServerMenuOpen(false);
      })
      .catch((e) =>
        void noticeDialog('Hata', e instanceof Error ? e.message : 'Davet oluşturulamadı'),
      );
  };

  const onStatusChange = (status: PresenceStatus, customStatus?: string | null) => {
    void client
      .updatePresence({ status, customStatus })
      .then(() => refreshUser())
      .catch(() => undefined);
  };

  const activeGuild = guilds.find((g) => g.id === guildId) ?? null;

  const value = useMemo<AppShellCtx>(
    () => ({
      mode,
      guilds,
      guildId,
      channels: channelsForList,
      categories,
      members,
      activeChannelId,
      notificationCount,
      serversOpen,
      channelsOpen,
      membersOpen,
      setServersOpen,
      setChannelsOpen,
      setMembersOpen,
      reloadGuilds,
      selectGuild,
      goHome,
      openChannel,
      setActiveChannelId,
      refreshMembers,
      openProfile: (u) => openProfileForUser(u),
      openVoiceMember,
      openVoiceMemberMenu: showVoiceMemberMenu,
      openCreateGuild: () => setCreateOpen(true),
      openJoinInvite: () => setJoinOpen(true),
      openServerMenu: () => setServerMenuOpen(true),
      guildPermissions,
    }),
    [
      mode,
      guilds,
      guildId,
      channelsForList,
      categories,
      members,
      activeChannelId,
      notificationCount,
      serversOpen,
      channelsOpen,
      membersOpen,
      reloadGuilds,
      selectGuild,
      goHome,
      openChannel,
      refreshMembers,
      openProfileForUser,
      openVoiceMember,
      showVoiceMemberMenu,
      guildPermissions,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>{children}</View>

      {/* Tek nav: dar sunucu rayı + kanal listesi (Discord mobil) */}
      <Drawer
        open={serversOpen || channelsOpen}
        onClose={closeNav}
        width={320}
        maxScreenRatio={0.82}
      >
        <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
          <ServerRail
            guilds={railGuilds}
            activeGuildId={guildId}
            homeActive={mode === 'home'}
            onHome={goHome}
            onSelectGuild={(id) => void selectGuild(id, { openFirst: false })}
            onToggleFavorite={(id) => {
              const isFav = favoriteGuildIds.includes(id);
              void confirmDialog({
                title: isFav ? 'Favorilerden çıkar' : 'Favorilere ekle',
                message: isFav
                  ? 'Bu sunucu favorilerden kaldırılsın mı?'
                  : 'Bu sunucu favorilere eklensin mi?',
                confirmLabel: isFav ? 'Çıkar' : 'Ekle',
              }).then((ok) => {
                if (ok) toggleFavoriteGuild(id);
              });
            }}
            onCreate={() => {
              closeNav();
              setCreateOpen(true);
            }}
            onJoin={() => {
              closeNav();
              setJoinOpen(true);
            }}
            onDiscover={() => {
              closeNav();
              router.push('/(app)/discover');
            }}
          />
          <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            {mode === 'guild' && guildId ? (
              <>
                <ChannelList
                  channels={channelsForList}
                  categories={categories}
                  activeChannelId={activeChannelId}
                  onOpenChannel={(c) => void openChannel(c)}
                  serverName={activeGuild?.name}
                  onOpenServerMenu={() => setServerMenuOpen(true)}
                  onOpenMembers={() => {
                    closeNav();
                    void refreshMembers();
                    setMembersOpen(true);
                  }}
                  selfUserId={user?.id}
                  activeVoiceChannelId={voice?.voiceChannelId}
                  activeActivityChannelId={activity?.activityChannelId}
                  onVoiceMemberPress={(m, ch) => {
                    closeNav();
                    openVoiceMember(m, ch);
                  }}
                  onVoiceMemberLongPress={(m, ch) => showVoiceMemberMenu(m, ch)}
                />
                <UserPanel
                  user={user}
                  onStatusChange={onStatusChange}
                  onOpenSettings={() => {
                    closeNav();
                    router.push('/(app)/settings');
                  }}
                  onOpenProfile={() => {
                    if (user) {
                      closeNav();
                      openProfileForUser(user);
                    }
                  }}
                />
              </>
            ) : (
              <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Ana sayfa</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
                  Soldan bir sunucu seç veya keşfet / oluştur ile yeni bir sunucuya katıl.
                </Text>
                <Pressable
                  onPress={() => {
                    closeNav();
                    router.push('/(app)/guilds');
                  }}
                  style={{
                    marginTop: 8,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>Arkadaşlar & DM</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Drawer>

      <MemberSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        members={members}
        onSelectMember={(m) => {
          setMembersOpen(false);
          openProfileForUser(m);
        }}
        onMemberLongPress={(m) => {
          setMembersOpen(false);
          openMemberMenu(m);
        }}
      />

      <ActionsSheet
        open={Boolean(memberMenu)}
        title={memberMenu?.title ?? ''}
        subtitle={memberMenu?.subtitle}
        actions={memberMenu?.actions ?? []}
        onClose={() => setMemberMenu(null)}
      />

      <ActionsSheet
        open={Boolean(moveTargetUser)}
        title="Ses kanalına taşı"
        subtitle={moveTargetUser ? moveTargetUser.displayName : undefined}
        actions={(() => {
          const voiceChannels = channels.filter(
            (c) => c.type === 'VOICE' || c.type === 'GAME' || c.type === 'WATCH_PARTY',
          );
          if (voiceChannels.length === 0) {
            return [
              {
                id: 'empty',
                icon: 'info',
                label: 'Taşınacak ses kanalı yok',
                muted: true,
                onSelect: () => undefined,
              },
            ];
          }
          return voiceChannels.map((c) => ({
            id: c.id,
            icon:
              c.type === 'GAME'
                ? 'sports_esports'
                : c.type === 'WATCH_PARTY'
                  ? 'movie'
                  : 'volume_up',
            label: c.name,
            onSelect: () => {
              const target = moveTargetUser;
              if (!target) return;
              void client
                .moveVoiceUser(target.id, c.id)
                .then(() => {
                  if (guildId) void client.getGuildChannels(guildId).then(setChannels);
                  void noticeDialog('Taşındı', `${target.displayName} → #${c.name}`);
                })
                .catch((e) =>
                  noticeDialog('Hata', e instanceof Error ? e.message : 'Taşınamadı'),
                );
            },
          }));
        })()}
        onClose={() => setMoveTargetUser(null)}
      />

      <ServerMenu
        open={serverMenuOpen}
        serverName={activeGuild?.name ?? 'Sunucu'}
        onClose={() => setServerMenuOpen(false)}
        favorite={Boolean(guildId && favoriteGuildIds.includes(guildId))}
        onFavorite={() => {
          if (!guildId) return;
          setServerMenuOpen(false);
          toggleFavoriteGuild(guildId);
        }}
        onInvite={createInvite}
        onEvents={() => {
          setServerMenuOpen(false);
          setExtrasTab('events');
          setExtrasOpen(true);
        }}
        onBoost={() => {
          setServerMenuOpen(false);
          setExtrasTab('boost');
          setExtrasOpen(true);
        }}
        onSettings={() => {
          setServerMenuOpen(false);
          if (guildId) router.push(`/(app)/guild-settings/${guildId}`);
        }}
        onLeave={leaveGuild}
      />

      <GuildExtrasSheet
        open={extrasOpen}
        onClose={() => setExtrasOpen(false)}
        guildId={guildId}
        guild={activeGuild}
        initialTab={extrasTab}
        onGuildUpdated={(g) => {
          setGuilds((prev) => prev.map((x) => (x.id === g.id ? { ...x, ...g } : x)));
        }}
      />

      <ProfileSheet
        user={profileUser}
        joinedAt={profileJoinedAt}
        actions={profileActions}
        onClose={() => {
          setProfileUser(null);
          setProfileJoinedAt(null);
          setProfileActions([]);
        }}
      />

      <CreateGuildModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => void selectGuild(id)}
      />
      <JoinInviteModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={(id) => void selectGuild(id)}
      />
    </Ctx.Provider>
  );
}

/** Ekran üstü TitleBar — web responsive hamburger menü */
export function ShellHeader({
  title,
  subtitle,
  showMembers,
}: {
  title?: string;
  subtitle?: string | null;
  /** @deprecated Aynı menüyü açıyordu — kaldırıldı */
  showChannels?: boolean;
  showMembers?: boolean;
}) {
  const shell = useAppShell();
  const router = useRouter();

  return (
    <TitleBar
      title={title}
      subtitle={subtitle}
      onMenu={() => shell.setServersOpen(true)}
      onMembers={
        showMembers && shell.mode === 'guild'
          ? () => {
              void shell.refreshMembers();
              shell.setMembersOpen(true);
            }
          : undefined
      }
      onSearch={() => router.push('/(app)/search')}
      onNotifications={() => router.push('/(app)/notifications')}
      notificationCount={shell.notificationCount}
    />
  );
}
