import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import type {
  CategoryDto,
  ChannelSummary,
  GuildPermissionsDto,
  GuildSummary,
  PresenceStatus,
  PublicUser,
  VoiceMemberSummary,
  VoiceStatePayload,
} from '@dracord/types';
import { DRACORD_BOT_USER_ID, SocketEvents } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { rememberChannel, readGuildLastChannel, readLastChannel } from '../../lib/lastChannel';
import { CreateGuildModal, JoinInviteModal } from '../GuildModals';
import { MemberSheet } from '../MemberSheet';
import { Drawer } from './Drawer';
import { ServerRail } from './ServerRail';
import { ChannelList } from './ChannelList';
import { UserPanel } from './UserPanel';
import { ServerMenu } from './ServerMenu';
import {
  ProfileSheet,
  copyUserId,
  presentMemberActions,
  type ProfileAction,
} from './ProfileSheet';
import { GuildExtrasSheet } from './GuildExtrasSheet';
import { TitleBar } from './TitleBar';
import { useVoiceSessionOptional } from '../voice/VoiceSession';
import { useActivitySessionOptional } from '../activity/ActivitySession';

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

  const reloadGuilds = useCallback(async () => {
    const g = await client.listGuilds();
    setGuilds(g);
    return g;
  }, [client]);

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
        Alert.alert(
          'Ses kanalı değiştir',
          `"${voice.voiceChannelName ?? 'Mevcut kanal'}" odasından çıkıp bu kanala katılmak istiyor musun?`,
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Katıl', style: 'destructive', onPress: () => void go() },
          ],
        );
        return;
      }

      // Başka aktivitedeyken yeni oyun/watch party — onayla; menü gezinmesi bozulmasın
      if (
        (c.type === 'GAME' || c.type === 'WATCH_PARTY') &&
        activity?.activityChannelId &&
        activity.activityChannelId !== c.id
      ) {
        Alert.alert(
          'Aktivite değiştir',
          `"${activity.activityChannelName ?? 'Mevcut aktivite'}" odasından çıkıp bu kanala katılmak istiyor musun?`,
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Katıl',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  const sid = activity.activitySessionId;
                  if (sid) {
                    await client.leaveActivity(sid).catch(() => undefined);
                  }
                  activity.clearActiveActivity();
                  await go();
                })();
              },
            },
          ],
        );
        return;
      }

      await go();
    },
    [
      client,
      guildId,
      router,
      closeNav,
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
    void refreshMembers();
  }, [client, guildId, mode, refreshMembers]);

  const buildMemberActions = useCallback(
    (target: PublicUser, opts?: { voiceChannelId?: string | null; joinedAt?: string | null }) => {
      const actions: ProfileAction[] = [];
      const isSelf = target.id === user?.id;
      const isBot = Boolean(target.isBot) || target.id === DRACORD_BOT_USER_ID;
      const perms = guildPermissions?.permissions ?? [];
      const canKick =
        Boolean(guildPermissions?.owner || guildPermissions?.platformAdmin) ||
        perms.includes('KICK_MEMBERS');
      const canBan =
        Boolean(guildPermissions?.owner || guildPermissions?.platformAdmin) ||
        perms.includes('BAN_MEMBERS');
      const canModerate =
        Boolean(guildPermissions?.owner || guildPermissions?.platformAdmin) ||
        perms.includes('MODERATE_MEMBERS');

      if (isSelf) {
        actions.push(
          {
            id: 'settings-profile',
            label: 'Profil ayarları',
            onSelect: () => router.push('/(app)/settings'),
          },
          {
            id: 'copy-id',
            label: 'Kullanıcı ID’sini kopyala',
            onSelect: () => void copyUserId(target.id),
          },
        );
        return actions;
      }

      if (!isBot) {
        actions.push({
          id: 'dm',
          label: 'Mesaj gönder',
          onSelect: () => {
            void client.openDm(target.id).then(() => router.push('/(app)/dms'));
          },
        });
        actions.push({
          id: 'friend',
          label: 'Arkadaşlık isteği gönder',
          onSelect: () => {
            void client
              .sendFriendRequest(target.id)
              .then(() => Alert.alert('İstek gönderildi', `@${target.username}`))
              .catch((e) =>
                Alert.alert('Hata', e instanceof Error ? e.message : 'İstek gönderilemedi'),
              );
          },
        });
        actions.push({
          id: 'block',
          label: 'Kullanıcıyı engelle',
          danger: true,
          onSelect: () => {
            Alert.alert('Engelle', `@${target.username} engellensin mi?`, [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'Engelle',
                style: 'destructive',
                onPress: () =>
                  void client
                    .blockUser(target.id)
                    .then(() => Alert.alert('Engellendi', `@${target.username}`))
                    .catch((e) =>
                      Alert.alert('Hata', e instanceof Error ? e.message : 'Engellenemedi'),
                    ),
              },
            ]);
          },
        });
      }

      if (guildId && canKick && !isBot) {
        actions.push({
          id: 'kick',
          label: 'Sunucudan at',
          danger: true,
          onSelect: () => {
            Alert.alert('At', `${target.displayName} sunucudan atılsın mı?`, [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'At',
                style: 'destructive',
                onPress: () =>
                  void client
                    .kickGuildMember(guildId, target.id)
                    .then(() => void refreshMembers())
                    .catch((e) =>
                      Alert.alert('Hata', e instanceof Error ? e.message : 'Atılamadı'),
                    ),
              },
            ]);
          },
        });
      }
      if (guildId && canBan && !isBot) {
        actions.push({
          id: 'ban',
          label: 'Yasakla',
          danger: true,
          onSelect: () => {
            Alert.alert('Yasakla', `${target.displayName} yasaklansın mı?`, [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'Yasakla',
                style: 'destructive',
                onPress: () =>
                  void client
                    .banGuildMember(guildId, target.id)
                    .then(() => void refreshMembers())
                    .catch((e) =>
                      Alert.alert('Hata', e instanceof Error ? e.message : 'Yasaklanamadı'),
                    ),
              },
            ]);
          },
        });
      }
      if (guildId && canModerate && !isBot) {
        actions.push({
          id: 'timeout',
          label: 'Timeout (10 dk)',
          danger: true,
          onSelect: () => {
            void client
              .timeoutGuildMember(guildId, target.id, 10)
              .then(() => Alert.alert('Timeout', '10 dakika uygulandı'))
              .catch((e) =>
                Alert.alert('Hata', e instanceof Error ? e.message : 'Timeout uygulanamadı'),
              );
          },
        });
      }

      actions.push({
        id: 'copy-id',
        label: 'Kullanıcı ID’sini kopyala',
        onSelect: () => void copyUserId(target.id),
      });

      void opts;
      return actions;
    },
    [user?.id, guildPermissions, guildId, client, router, refreshMembers],
  );

  const openProfileForUser = useCallback(
    (u: PublicUser, opts?: { joinedAt?: string | null }) => {
      setProfileUser(u);
      setProfileJoinedAt(opts?.joinedAt ?? null);
      setProfileActions(buildMemberActions(u, { joinedAt: opts?.joinedAt }));
    },
    [buildMemberActions],
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
      const actions = buildMemberActions(asUser, { voiceChannelId: channel?.id });
      presentMemberActions(member.displayName, [
        {
          id: 'profile',
          label: 'Profili gör',
          onSelect: () => openVoiceMember(member, channel),
        },
        ...actions,
      ]);
    },
    [members, buildMemberActions, openVoiceMember],
  );

  // Ses aktifliği — kanal listesinde voiceMembers güncelle
  useEffect(() => {
    if (!guildId) return;
    const sock = client.connectSocket();
    const onVoice = (payload: VoiceStatePayload) => {
      if (payload.guildId !== guildId) return;
      void client.getGuildChannels(guildId).then(setChannels);
    };
    sock.on(SocketEvents.VOICE_STATE, onVoice);
    const tick = setInterval(() => {
      void client.getGuildChannels(guildId).then(setChannels).catch(() => undefined);
    }, 15_000);
    return () => {
      sock.off(SocketEvents.VOICE_STATE, onVoice);
      clearInterval(tick);
    };
  }, [client, guildId]);

  // Aktivite üye listesi — overlay’de oyun/watch party katılımcıları
  useEffect(() => {
    const aid = activity?.activityChannelId;
    const agid = activity?.activityGuildId;
    if (!aid || !agid) return;
    client.connectSocket();
    client.joinChannel(aid);
    const sock = client.connectSocket();
    const refresh = () => {
      void client.getGuildChannels(agid).then((chs) => {
        if (guildId === agid) setChannels(chs);
      }).catch(() => undefined);
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
  ]);

  /** Overlay kanal listesi: aktivite katılımcılarını voiceMembers’a birleştir */
  const channelsForList = useMemo(() => {
    const aid = activity?.activityChannelId;
    const agid = activity?.activityGuildId;
    if (!aid || !agid || agid !== guildId) return channels;

    const participantIds = activity.activityParticipantIds ?? [];
    return channels.map((ch) => {
      if (ch.id !== aid) {
        // Aktif aktivite dışındaki oyun/watch kanallarından self hayaletini temizle
        if (
          user &&
          (ch.type === 'GAME' || ch.type === 'WATCH_PARTY') &&
          (ch.voiceMembers ?? []).some((m) => m.id === user.id)
        ) {
          return {
            ...ch,
            voiceMembers: (ch.voiceMembers ?? []).filter((m) => m.id !== user.id),
          };
        }
        return ch;
      }

      const byId = new Map((ch.voiceMembers ?? []).map((m) => [m.id, m]));
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
      if (user && !byId.has(user.id)) {
        byId.set(user.id, {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          muted: false,
          deafened: false,
          isBot: Boolean(user.isBot),
          joinedAt: new Date().toISOString(),
        });
      }
      return { ...ch, voiceMembers: [...byId.values()] };
    });
  }, [
    channels,
    guildId,
    members,
    user,
    activity?.activityChannelId,
    activity?.activityGuildId,
    activity?.activityParticipantIds,
  ]);

  useEffect(() => {
    const tick = () => {
      void client
        .notificationsUnreadCount()
        .then((r) => setNotificationCount(r.count))
        .catch(() => undefined);
    };
    tick();
    const id = setInterval(tick, 30_000);
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
    Alert.alert('Sunucudan ayrıl', 'Bu sunucudan ayrılmak istiyor musun?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Ayrıl',
        style: 'destructive',
        onPress: () => {
          void client.leaveGuild(guildId).then(async () => {
            const g = await reloadGuilds();
            setServerMenuOpen(false);
            if (g[0]) void selectGuild(g[0].id);
            else goHome();
          });
        },
      },
    ]);
  };

  const createInvite = () => {
    if (!guildId) return;
    void client
      .createInvite(guildId)
      .then((inv) => {
        Alert.alert('Davet kodu', inv.code, [{ text: 'Tamam' }]);
        setServerMenuOpen(false);
      })
      .catch((e) => Alert.alert('Hata', e instanceof Error ? e.message : 'Davet oluşturulamadı'));
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
            guilds={guilds}
            activeGuildId={guildId}
            homeActive={mode === 'home'}
            onHome={goHome}
            onSelectGuild={(id) => void selectGuild(id, { openFirst: false })}
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
          presentMemberActions(m.displayName, [
            {
              id: 'profile',
              label: 'Profili gör',
              onSelect: () => {
                setMembersOpen(false);
                openProfileForUser(m);
              },
            },
            ...buildMemberActions(m),
          ]);
        }}
      />

      <ServerMenu
        open={serverMenuOpen}
        serverName={activeGuild?.name ?? 'Sunucu'}
        onClose={() => setServerMenuOpen(false)}
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
