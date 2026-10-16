import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CategoryDto,
  ChannelSummary,
  ClientSettings,
  GuildSummary,
  PublicUser,
} from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useVoiceMembersByChannel } from '../hooks/useVoiceMembersByChannel';
import {
  Avatar,
  ChannelSidebar,
  ConfirmDialog,
  Modal,
  SearchableSelect,
  ServerRail,
  TitleBar,
  UserProfileCard,
  type MemberListAction,
  type ServerRailGuild,
  type ServerRailGuildAction,
  type TitleBarNavId,
} from '@dracord/ui';
import { useAuth } from '../auth';
import { buildSidebarCategories } from '../lib/channels';
import {
  loadLocalPrefs,
  mergeClientSettings,
  saveLocalPrefs,
} from '../lib/client-settings';
import { readGuildLastChannel, readLastChannel, rememberChannel } from '../lib/lastChannel';
import { useVoiceSession } from '../voice/VoiceSession';
import { ChatPanel } from '../views/ChatPanel';
import { VoicePanel } from '../views/VoicePanel';
import { ActivityPanel } from '../views/ActivityPanel';
import { DmPanel } from '../views/DmPanel';
import { DmSidebar } from '../views/DmSidebar';
import { AppTour } from '../components/AppTour';
import { DracoEmpty } from '../components/Draco';
import { DiscoverPage } from '../views/DiscoverPage';
import { SettingsPage } from '../views/SettingsPage';
import { FriendsHubView } from '../views/FriendsHub';
import { SearchOverlay } from '../views/SearchOverlay';
import { NotificationsPanel } from '../views/NotificationsPanel';
import { GuildSettingsPage } from '../views/GuildSettingsPage';
import { GuildEventsModal } from '../views/GuildEventsModal';
import { GuildBoostPage } from '../views/GuildBoostPage';
import { MemberPanel } from '../views/MemberPanel';
import { NotificationBell } from '../views/NotificationBell';

type View =
  | { kind: 'home' }
  | { kind: 'dms'; channelId: string }
  | { kind: 'friends' }
  | { kind: 'discover' }
  | { kind: 'settings'; tab?: string }
  | { kind: 'notifications' }
  | { kind: 'guild-settings'; guildId: string }
  | { kind: 'guild-boost'; guildId: string }
  | { kind: 'channel'; guildId: string; channelId: string };

const COLLAPSED_KEY = 'dracord.desktop.collapsedCats';

export function Shell() {
  const { client, user, logout, updatePresence } = useAuth();
  const voice = useVoiceSession();
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [guildCategories, setGuildCategories] = useState<CategoryDto[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<View>({ kind: 'home' });
  const [showMembers, setShowMembers] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [jumpAroundId, setJumpAroundId] = useState<string | null>(null);
  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);
  const [findChatOpen, setFindChatOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<ServerRailGuild | null>(null);
  const [serverName, setServerName] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [discoverCategory, setDiscoverCategory] = useState('gaming');
  const [inviteCode, setInviteCode] = useState('');
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });
  const [prefs, setPrefs] = useState<ClientSettings>(loadLocalPrefs);
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [canManageGuild, setCanManageGuild] = useState(false);
  const [canManageChannels, setCanManageChannels] = useState(false);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [canMoveMembers, setCanMoveMembers] = useState(false);
  const [canKickMembers, setCanKickMembers] = useState(false);
  const [canBanMembers, setCanBanMembers] = useState(false);
  const [canModerateMembers, setCanModerateMembers] = useState(false);
  const [channelModal, setChannelModal] = useState<
    | null
    | { mode: 'create'; categoryId: string | null; type: ChannelSummary['type'] }
    | { mode: 'edit'; channel: ChannelSummary }
  >(null);
  const [channelNameDraft, setChannelNameDraft] = useState('');
  const [categoryModal, setCategoryModal] = useState<
    null | { mode: 'create' } | { mode: 'edit'; category: CategoryDto }
  >(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<
    null | { kind: 'channel'; channel: ChannelSummary } | { kind: 'category'; category: CategoryDto } | { kind: 'guild' }
  >(null);
  const [moveTargetUser, setMoveTargetUser] = useState<{ id: string; displayName: string } | null>(
    null,
  );
  const [voicePasswordPrompt, setVoicePasswordPrompt] = useState<ChannelSummary | null>(null);
  const [voicePassword, setVoicePassword] = useState('');
  const [rolePickerUser, setRolePickerUser] = useState<PublicUser | null>(null);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [voiceInviteChannel, setVoiceInviteChannel] = useState<ChannelSummary | null>(null);
  const [voiceInviteFriends, setVoiceInviteFriends] = useState<PublicUser[]>([]);
  const [voiceInviteBusyId, setVoiceInviteBusyId] = useState<string | null>(null);
  const [voiceInviteError, setVoiceInviteError] = useState<string | null>(null);
  const lastSpokeAtRef = useRef(Date.now());
  const afkMovingRef = useRef(false);

  const activeGuildId =
    view.kind === 'channel' ||
    view.kind === 'guild-settings' ||
    view.kind === 'guild-boost'
      ? view.guildId
      : null;
  const activeChannelId = view.kind === 'channel' ? view.channelId : null;
  const activeGuild = guilds.find((g) => g.id === activeGuildId) ?? null;
  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;
  const voiceChannel =
    channels.find((c) => c.id === voice.voiceChannelId) ??
    (voice.voiceChannelId
      ? ({ id: voice.voiceChannelId, name: voice.voiceChannelName ?? 'Ses', type: 'VOICE' } as ChannelSummary)
      : null);
  const inVoiceInThisGuild =
    Boolean(voice.voiceChannelId) && voice.voiceGuildId === activeGuildId;

  const voiceMembersByChannel = useVoiceMembersByChannel({
    client,
    user,
    guildId: activeGuildId,
    channels,
    members,
    voiceChannelId: voice.voiceChannelId,
    voiceGuildId: voice.voiceGuildId,
    peers: voice.peers,
    muted: voice.muted,
    deafened: voice.deafened,
    afkChannelId: activeGuild?.afkChannelId,
  });

  const platformAdminIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) {
      if (m.isPlatformAdmin) set.add(m.id);
    }
    return set;
  }, [members]);

  const titleNav: TitleBarNavId =
    view.kind === 'dms' || view.kind === 'friends' || view.kind === 'home'
      ? 'direct-messages'
      : view.kind === 'settings'
        ? 'settings'
        : activeChannel?.type === 'VOICE' ||
            (inVoiceInThisGuild && activeChannel?.type !== 'VOICE')
          ? 'voice'
          : 'servers';

  const reloadGuilds = () =>
    client.listGuilds().then((g) => {
      setGuilds(g);
      return g;
    });

  const openChannel = (guildId: string, channelId: string) => {
    rememberChannel(guildId, channelId);
    setView({ kind: 'channel', guildId, channelId });
  };

  const pickChannel = (guildId: string, chs: ChannelSummary[]) => {
    const preferId = readGuildLastChannel(guildId);
    const prefer = preferId ? chs.find((c) => c.id === preferId) : undefined;
    return (
      prefer ??
      chs.find((c) => c.type === 'TEXT') ??
      chs.find((c) => c.type === 'FORUM') ??
      chs.find((c) => c.type === 'VOICE') ??
      chs[0]
    );
  };

  const reloadChannels = useCallback(
    (guildId: string) => {
      void client.getGuildChannels(guildId).then(setChannels);
      void client
        .listGuildCategories(guildId)
        .then(setGuildCategories)
        .catch(() => setGuildCategories([]));
    },
    [client],
  );

  useEffect(() => {
    void reloadGuilds().then((g) => {
      if (!g.length) return;
      const last = readLastChannel();
      if (last && g.some((x) => x.id === last.guildId)) {
        setView({ kind: 'channel', guildId: last.guildId, channelId: last.channelId });
        return;
      }
      void client.getGuildChannels(g[0].id).then((chs) => {
        const first = pickChannel(g[0].id, chs);
        if (first) openChannel(g[0].id, first.id);
      });
    });
  }, [client]);

  useEffect(() => {
    if (!user) {
      setFriendIds(new Set());
      return;
    }
    const reloadFriends = () => {
      void client
        .getFriends()
        .then((list) => setFriendIds(new Set(list.map((f) => f.id))))
        .catch(() => undefined);
    };
    reloadFriends();
    const t = window.setInterval(reloadFriends, 60_000);
    return () => window.clearInterval(t);
  }, [client, user?.id]);

  useEffect(() => {
    if (!user) return;
    void client
      .getClientSettings()
      .then((remote) => {
        const merged = mergeClientSettings(remote as unknown as Record<string, unknown>);
        setPrefs(merged);
        saveLocalPrefs(merged);
      })
      .catch(() => undefined);
  }, [client, user?.id]);

  useEffect(() => {
    if (!activeGuildId) {
      setChannels([]);
      setGuildCategories([]);
      setMembers([]);
      return;
    }
    reloadChannels(activeGuildId);
    void client.getGuildMembers(activeGuildId).then(setMembers).catch(() => setMembers([]));
  }, [client, activeGuildId, reloadChannels]);

  useEffect(() => {
    if (!activeGuildId || !user) return;
    void client.getGuildPermissions(activeGuildId).then((p) => {
      const set = new Set(p.permissions);
      const god = Boolean(p.platformAdmin) || Boolean(user.isPlatformAdmin);
      setCanManageGuild(
        god || p.owner || set.has('MANAGE_GUILD') || set.has('ADMINISTRATOR'),
      );
      setCanManageChannels(
        god || p.owner || set.has('MANAGE_CHANNELS') || set.has('ADMINISTRATOR'),
      );
      setCanManageRoles(god || p.owner || set.has('MANAGE_ROLES') || set.has('ADMINISTRATOR'));
      setCanMoveMembers(
        god ||
          p.owner ||
          set.has('MOVE_MEMBERS') ||
          set.has('MANAGE_CHANNELS') ||
          set.has('ADMINISTRATOR'),
      );
      setCanKickMembers(god || p.owner || set.has('KICK_MEMBERS') || set.has('ADMINISTRATOR'));
      setCanBanMembers(god || p.owner || set.has('BAN_MEMBERS') || set.has('ADMINISTRATOR'));
      setCanModerateMembers(
        god || p.owner || set.has('MODERATE_MEMBERS') || set.has('ADMINISTRATOR'),
      );
    });
  }, [activeGuildId, client, user]);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onPresence = (payload: {
      userId: string;
      status: PublicUser['status'];
      customStatus?: string | null;
    }) => {
      if (
        payload.userId === user.id &&
        payload.status === 'OFFLINE' &&
        client.socket?.connected
      ) {
        return;
      }
      const inVoiceNow = voice.peers.some((p) => p.id === payload.userId);
      const nextStatus =
        inVoiceNow && payload.status === 'OFFLINE' ? ('ONLINE' as const) : payload.status;
      setMembers((prev) =>
        prev.map((m) =>
          m.id === payload.userId
            ? {
                ...m,
                status: nextStatus,
                customStatus:
                  payload.customStatus !== undefined ? payload.customStatus : m.customStatus,
              }
            : m,
        ),
      );
    };
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    return () => {
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
    };
  }, [client, user, voice.peers]);

  useEffect(() => {
    if (!user) return;
    const live =
      user.status === 'OFFLINE' && client.socket?.connected ? ('ONLINE' as const) : user.status;
    setMembers((prev) =>
      prev.map((m) =>
        m.id === user.id ? { ...m, status: live, customStatus: user.customStatus } : m,
      ),
    );
  }, [user?.id, user?.status, user?.customStatus, client]);

  const liveMemberStatus = useCallback(
    (memberId: string, fallback?: PublicUser['status'] | null): PublicUser['status'] => {
      const inVoiceNow = voice.peers.some((p) => p.id === memberId);
      if (user && memberId === user.id) {
        if (user.status === 'IDLE' || user.status === 'DND') return user.status;
        if (user.status === 'ONLINE') return 'ONLINE';
        if (client.socket?.connected || inVoiceNow) return 'ONLINE';
        return 'OFFLINE';
      }
      if (inVoiceNow) {
        if (fallback === 'IDLE' || fallback === 'DND' || fallback === 'ONLINE') return fallback;
        return 'ONLINE';
      }
      return fallback ?? 'OFFLINE';
    },
    [client.socket?.connected, user, voice.peers],
  );

  const createGuildInvite = async (guildId: string) => {
    setInviteBusy(true);
    try {
      const inv = await client.createInvite(guildId);
      const url = inv.url || `https://dracord.com.tr/invite/${inv.code}`;
      setCreatedInviteUrl(url);
      try {
        await navigator.clipboard?.writeText(url);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Davet oluşturulamadı');
    } finally {
      setInviteBusy(false);
    }
  };

  const joinVoiceChannel = useCallback(
    async (guildId: string, ch: ChannelSummary, password?: string) => {
      await voice.join(
        guildId,
        { id: ch.id, name: ch.name, type: ch.type },
        { password },
      );
      openChannel(guildId, ch.id);
    },
    [voice],
  );

  // AFK kanalı: zorla sessizlik (mic+kulaklık); çıkınca aç — web parity
  useEffect(() => {
    const guild =
      guilds.find((g) => g.id === voice.voiceGuildId) ??
      (activeGuildId ? guilds.find((g) => g.id === activeGuildId) : null);
    const afkId = guild?.afkChannelId;
    const inAfk = Boolean(
      afkId &&
        voice.connected &&
        voice.voiceGuildId === guild?.id &&
        voice.voiceChannelId === afkId,
    );
    voice.setAfkSilence(inAfk);
  }, [
    guilds,
    activeGuildId,
    voice.connected,
    voice.voiceChannelId,
    voice.voiceGuildId,
    voice.setAfkSilence,
  ]);

  // AFK otomatik taşıma — GAME / WATCH_PARTY hariç (web parity)
  useEffect(() => {
    const guild = guilds.find((g) => g.id === voice.voiceGuildId);
    const afkId = guild?.afkChannelId;
    const timeoutMin = guild?.afkTimeoutMinutes ?? 0;
    if (
      !afkId ||
      timeoutMin <= 0 ||
      !voice.voiceChannelId ||
      !voice.voiceGuildId ||
      !voice.connected ||
      !user
    ) {
      return;
    }

    const chType =
      voice.voiceChannelType ??
      channels.find((c) => c.id === voice.voiceChannelId)?.type ??
      'VOICE';
    if (chType === 'GAME' || chType === 'WATCH_PARTY') {
      lastSpokeAtRef.current = Date.now();
      return;
    }

    const self = voice.peers.find((p) => p.id === user.id);
    if (self?.speaking) {
      lastSpokeAtRef.current = Date.now();
    }

    const tick = window.setInterval(() => {
      if (afkMovingRef.current) return;
      if (voice.voiceChannelId === afkId) return;
      const typeNow =
        voice.voiceChannelType ??
        channels.find((c) => c.id === voice.voiceChannelId)?.type ??
        'VOICE';
      if (typeNow === 'GAME' || typeNow === 'WATCH_PARTY') {
        lastSpokeAtRef.current = Date.now();
        return;
      }
      const idleMs = Date.now() - lastSpokeAtRef.current;
      if (idleMs < timeoutMin * 60_000) return;
      afkMovingRef.current = true;
      const guildId = voice.voiceGuildId!;
      void (async () => {
        try {
          const chs =
            guildId === activeGuildId
              ? channels
              : await client.getGuildChannels(guildId);
          const afkCh = chs.find((c) => c.id === afkId);
          if (!afkCh) return;
          await joinVoiceChannel(guildId, afkCh);
        } finally {
          window.setTimeout(() => {
            afkMovingRef.current = false;
          }, 2000);
        }
      })();
    }, 5000);

    return () => window.clearInterval(tick);
  }, [
    guilds,
    voice.voiceChannelId,
    voice.voiceGuildId,
    voice.voiceChannelType,
    voice.connected,
    voice.peers,
    user,
    channels,
    activeGuildId,
    client,
    joinVoiceChannel,
  ]);

  const selectChannel = useCallback(
    (ch: ChannelSummary) => {
      if (!activeGuildId) return;
      if (ch.type === 'VOICE' || ch.type === 'GAME' || ch.type === 'WATCH_PARTY') {
        if (ch.locked && ch.hasPassword && !canManageChannels) {
          setVoicePasswordPrompt(ch);
          setVoicePassword('');
          return;
        }
        void joinVoiceChannel(activeGuildId, ch);
        return;
      }
      // Metin/forum: ses oturumunu bırakma
      openChannel(activeGuildId, ch.id);
    },
    [activeGuildId, canManageChannels, joinVoiceChannel],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        window.dispatchEvent(new Event('dracord:open-channel-search'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onJump = (e: Event) => {
      const detail = (e as CustomEvent<{
        guildId?: string | null;
        channelId?: string;
        around?: string;
        highlightId?: string;
      }>).detail;
      if (!detail?.channelId || !detail.around) return;
      if (detail.guildId) {
        openChannel(detail.guildId, detail.channelId);
        setJumpAroundId(detail.highlightId || detail.around);
      } else {
        setView({ kind: 'dms', channelId: detail.channelId });
      }
    };
    window.addEventListener('dracord:jump-message', onJump);
    return () => window.removeEventListener('dracord:jump-message', onJump);
  }, []);

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const buildMemberActions = useCallback(
    (target: PublicUser, voiceChId?: string | null): MemberListAction[] => {
      const isSelf = target.id === user?.id;
      if (!isSelf && (target.isPlatformAdmin || platformAdminIds.has(target.id))) {
        return [];
      }

      const actions: MemberListAction[] = [];
      const chId = voiceChId ?? voice.voiceChannelId;
      const inLocalVoice =
        Boolean(chId) &&
        voice.voiceChannelId === chId &&
        voice.peers.some((p) => p.id === target.id);

      if (inLocalVoice && !isSelf) {
        actions.push({
          id: 'local-mute',
          label: voice.isLocalMutedParticipant(target.id)
            ? 'Yerel susturmayı kaldır'
            : 'Yerel sustur',
          onSelect: () => voice.toggleLocalMuteParticipant(target.id),
        });
      }

      if (isSelf) {
        actions.push(
          {
            id: 'profile',
            label: 'Profil',
            onSelect: () => setView({ kind: 'settings', tab: 'profile' }),
          },
          {
            id: 'settings',
            label: 'Kullanıcı ayarları',
            onSelect: () => setView({ kind: 'settings' }),
          },
          {
            id: 'voice-settings',
            label: 'Ses ve görüntü ayarları',
            onSelect: () => setView({ kind: 'settings', tab: 'voice' }),
          },
          {
            id: 'copy-id',
            label: 'Kullanıcı ID’sini kopyala',
            onSelect: () => {
              void navigator.clipboard.writeText(target.id).catch(() => undefined);
            },
          },
        );
        return actions;
      }

      if (!target.isBot && target.id !== DRACORD_BOT_USER_ID) {
        actions.push({
          id: 'dm',
          label: 'Mesaj gönder',
          onSelect: () => {
            void client.openDm(target.id).then((ch) =>
              setView({ kind: 'dms', channelId: ch.id }),
            );
          },
        });
        if (!friendIds.has(target.id)) {
          actions.push({
            id: 'friend',
            label: 'Arkadaşlık isteği gönder',
            onSelect: () => {
              void client.sendFriendRequest(target.id).then(() => {
                setFriendIds((prev) => new Set([...prev, target.id]));
              });
            },
          });
        }
        actions.push({
          id: 'block',
          label: 'Kullanıcıyı engelle',
          danger: true,
          onSelect: () => {
            void client.blockUser(target.id);
          },
        });
      }
      if (canManageRoles && activeGuildId && !target.isBot) {
        actions.push({
          id: 'roles',
          label: 'Rolleri düzenle…',
          onSelect: () => {
            setRolePickerUser(target);
            void client.listGuildRoles(activeGuildId).then((list) =>
              setRoles(list.map((r) => ({ id: r.id, name: r.name }))),
            );
          },
        });
      }
      if (canManageChannels && chId) {
        const denied = (channels.find((c) => c.id === chId)?.deniedUserIds ?? []).includes(
          target.id,
        );
        if (denied) {
          actions.push({
            id: 'allow-voice',
            label: 'Ses odası engelini kaldır',
            onSelect: () => {
              void client.allowVoiceUser(chId, target.id).then((updated) => {
                setChannels((prev) =>
                  prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
                );
              });
            },
          });
        } else {
          actions.push({
            id: 'deny-voice',
            label: 'Ses odasından engelle',
            danger: true,
            onSelect: () => {
              void client.denyVoiceUser(chId, target.id).then((updated) => {
                setChannels((prev) =>
                  prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
                );
              });
            },
          });
        }
      }
      if (canMoveMembers && chId) {
        actions.push({
          id: 'move-voice',
          label: 'Ses kanalına taşı…',
          onSelect: () => setMoveTargetUser({ id: target.id, displayName: target.displayName }),
        });
        actions.push({
          id: 'disconnect-voice',
          label: 'Odadan ayır',
          onSelect: () => {
            void client.disconnectVoiceUser(chId, target.id);
          },
        });
      }
      if (!target.isBot && canKickMembers && activeGuildId) {
        actions.push({
          id: 'kick',
          label: 'Sunucudan at',
          danger: true,
          onSelect: () => {
            void client.kickGuildMember(activeGuildId, target.id).then(() =>
              client.getGuildMembers(activeGuildId).then(setMembers),
            );
          },
        });
      }
      if (!target.isBot && canBanMembers && activeGuildId) {
        actions.push({
          id: 'ban',
          label: 'Yasakla',
          danger: true,
          onSelect: () => {
            void client.banGuildMember(activeGuildId, target.id).then(() =>
              client.getGuildMembers(activeGuildId).then(setMembers),
            );
          },
        });
      }
      if (!target.isBot && canModerateMembers && activeGuildId) {
        actions.push({
          id: 'timeout',
          label: 'Timeout (10 dk)',
          danger: true,
          onSelect: () => {
            void client.timeoutGuildMember(activeGuildId, target.id, 10);
          },
        });
      }
      return actions;
    },
    [
      activeGuildId,
      canBanMembers,
      canKickMembers,
      canManageChannels,
      canManageRoles,
      canModerateMembers,
      canMoveMembers,
      channels,
      client,
      friendIds,
      platformAdminIds,
      user?.id,
      voice,
    ],
  );

  const categories = useMemo(
    () =>
      buildSidebarCategories(channels, activeChannelId ?? undefined, selectChannel, {
        selfUserId: user?.id,
        voiceMembersByChannel,
        platformAdminIds,
        guildCategories,
        collapsedCategoryIds: collapsed,
        onToggleCategory: toggleCollapsed,
        selfVoiceChannelId: inVoiceInThisGuild ? voice.voiceChannelId : null,
        selfActivityChannelIds:
          voiceChannel &&
          (voiceChannel.type === 'GAME' || voiceChannel.type === 'WATCH_PARTY') &&
          inVoiceInThisGuild
            ? new Set([voiceChannel.id])
            : undefined,
        onAddChannel: canManageChannels
          ? (categoryId) => {
              const type: ChannelSummary['type'] =
                categoryId === '__games__'
                  ? 'GAME'
                  : categoryId === '__watch__'
                    ? 'WATCH_PARTY'
                    : 'TEXT';
              const real =
                categoryId === '__games__' || categoryId === '__watch__' ? null : categoryId;
              setChannelNameDraft('');
              setChannelModal({ mode: 'create', categoryId: real, type });
            }
          : undefined,
        onEditChannel: canManageChannels
          ? (ch) => {
              setChannelNameDraft(ch.name);
              setChannelModal({ mode: 'edit', channel: ch });
            }
          : undefined,
        onDeleteChannel: canManageChannels
          ? (ch) => setConfirmDelete({ kind: 'channel', channel: ch })
          : undefined,
        onEditCategory: canManageChannels
          ? (cat) => {
              setCategoryNameDraft(cat.name);
              setCategoryModal({ mode: 'edit', category: cat });
            }
          : undefined,
        onDeleteCategory: canManageChannels
          ? (cat) => setConfirmDelete({ kind: 'category', category: cat })
          : undefined,
        onDropMember: (userId, channel) => {
          if (
            channel.type !== 'VOICE' &&
            channel.type !== 'GAME' &&
            channel.type !== 'WATCH_PARTY'
          ) {
            return;
          }
          const isSelf = Boolean(user?.id && userId === user.id);
          if (!isSelf && !canMoveMembers) return;
          if (isSelf && activeGuildId) {
            void joinVoiceChannel(activeGuildId, channel);
            return;
          }
          void client.moveVoiceUser(userId, channel.id);
        },
        canDragVoiceMembers: canMoveMembers,
        canDragSelf: Boolean(voice.voiceChannelId),
        onReorderChannels: canManageChannels
          ? (categoryId, orderedIds) => {
              if (!activeGuildId) return;
              void client
                .reorderGuildChannels(
                  activeGuildId,
                  orderedIds.map((id, position) => ({ id, position, categoryId })),
                )
                .then(() => reloadChannels(activeGuildId));
            }
          : undefined,
        enrichVoiceMember: (member, voiceChannelId) => {
          const gm = members.find((g) => g.id === member.id);
          const fake: PublicUser = {
            id: member.id,
            displayName: member.displayName,
            username: gm?.username ?? null,
            avatarUrl: member.avatarUrl ?? gm?.avatarUrl,
            status: gm?.status ?? 'ONLINE',
            isBot: member.isBot ?? gm?.isBot,
            isPlatformAdmin: gm?.isPlatformAdmin,
          } as PublicUser;
          const actions = buildMemberActions(fake, voiceChannelId);
          const inLocal =
            voice.voiceChannelId === voiceChannelId &&
            voice.peers.some((p) => p.id === member.id);
          return {
            contextActions: actions.length ? actions : undefined,
            ...(inLocal && member.id !== user?.id
              ? {
                  participantVolume: voice.participantVolumes[member.id] ?? 100,
                  onParticipantVolumeChange: (v: number) =>
                    voice.setParticipantVolume(member.id, v),
                }
              : {}),
          };
        },
        afkChannelId: activeGuild?.afkChannelId ?? null,
        onInviteChannel: (ch) => {
          setVoiceInviteChannel(ch);
          setVoiceInviteError(null);
          void client
            .getFriends()
            .then(setVoiceInviteFriends)
            .catch(() => setVoiceInviteFriends([]));
        },
        onOpenVoiceChat: (ch) => {
          if (activeGuildId) openChannel(activeGuildId, ch.id);
        },
      }),
    [
      channels,
      activeChannelId,
      selectChannel,
      user?.id,
      collapsed,
      guildCategories,
      inVoiceInThisGuild,
      voice.voiceChannelId,
      voice.peers,
      voice.participantVolumes,
      voice.setParticipantVolume,
      voiceMembersByChannel,
      platformAdminIds,
      voiceChannel,
      client,
      canManageChannels,
      canMoveMembers,
      activeGuildId,
      joinVoiceChannel,
      client,
      reloadChannels,
      members,
      buildMemberActions,
      activeGuild?.afkChannelId,
    ],
  );

  const patchAppearance = useCallback(
    (patch: Partial<ClientSettings['appearance']>) => {
      setPrefs((prev) => {
        const next = {
          ...prev,
          appearance: { ...prev.appearance, ...patch },
        };
        saveLocalPrefs(next);
        void client
          .updateClientSettings({ appearance: next.appearance })
          .catch(() => undefined);
        return next;
      });
    },
    [client],
  );

  const railGuilds: ServerRailGuild[] = useMemo(() => {
    const favSet = new Set(prefs.appearance.favoriteGuildIds ?? []);
    const order = prefs.appearance.guildOrderIds ?? [];
    const byId = new Map(
      guilds.map((g) => [
        g.id,
        {
          id: g.id,
          name: g.name,
          iconUrl: g.iconUrl,
          ownerId: g.ownerId,
          favorite: favSet.has(g.id),
        } satisfies ServerRailGuild,
      ]),
    );
    const ordered: ServerRailGuild[] = [];
    for (const id of order) {
      const g = byId.get(id);
      if (g) {
        ordered.push(g);
        byId.delete(id);
      }
    }
    for (const g of byId.values()) ordered.push(g);
    const favs = ordered.filter((g) => g.favorite);
    const rest = ordered.filter((g) => !g.favorite);
    return [...favs, ...rest];
  }, [guilds, prefs.appearance.favoriteGuildIds, prefs.appearance.guildOrderIds]);

  const getGuildActions = useCallback(
    (guild: ServerRailGuild): ServerRailGuildAction[] => {
      const isOwner = Boolean(user?.id && guild.ownerId && guild.ownerId === user.id);
      const isFav = (prefs.appearance.favoriteGuildIds ?? []).includes(guild.id);
      const actions: ServerRailGuildAction[] = [
        {
          id: 'favorite',
          label: isFav ? 'Favorilerden çıkar' : 'Favorilere ekle',
          onSelect: () => {
            const cur = prefs.appearance.favoriteGuildIds ?? [];
            const next = isFav
              ? cur.filter((id) => id !== guild.id)
              : [...cur, guild.id];
            patchAppearance({ favoriteGuildIds: next });
          },
        },
        {
          id: 'invite',
          label: 'İnsanları davet et',
          onSelect: () => {
            setCreatedInviteUrl(null);
            void createGuildInvite(guild.id);
          },
        },
        {
          id: 'settings',
          label: 'Sunucu ayarları',
          onSelect: () => setView({ kind: 'guild-settings', guildId: guild.id }),
        },
        {
          id: 'boost',
          label: 'Sunucu takviyeleri',
          onSelect: () => setView({ kind: 'guild-boost', guildId: guild.id }),
        },
      ];
      if (!isOwner) {
        actions.push({
          id: 'leave',
          label: 'Sunucudan ayrıl',
          danger: true,
          onSelect: () => setLeaveTarget(guild),
        });
      }
      return actions;
    },
    [
      user?.id,
      prefs.appearance.favoriteGuildIds,
      patchAppearance,
      createGuildInvite,
    ],
  );

  const isActivity =
    activeChannel?.type === 'GAME' || activeChannel?.type === 'WATCH_PARTY';

  const electronApi = (
    window as unknown as {
      electronAPI?: { minimize?: () => void; maximize?: () => void; close?: () => void };
    }
  ).electronAPI;

  const selfStatus = liveMemberStatus(user?.id ?? '', user?.status);

  return (
    <div className="flex flex-col h-dvh max-h-dvh w-screen overflow-hidden bg-surface">
      {voice.voiceOnOtherClient && voice.voiceChannelId && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[90] max-w-lg w-[min(100%-2rem,32rem)] rounded-xl bg-surface-container-high border border-primary-container/40 text-on-surface px-space-md py-space-sm shadow-float flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary-container text-[20px]">
            {voice.voiceElsewherePlatform === 'mobile' ? 'smartphone' : 'language'}
          </span>
          <p className="font-body-sm flex-1 min-w-0">
            {voice.voiceElsewherePlatform === 'mobile'
              ? 'Ses mobil uygulamada açık.'
              : voice.voiceElsewherePlatform === 'web'
                ? 'Ses web istemcisinde açık.'
                : 'Ses başka bir cihazda açık.'}{' '}
            Masaüstüne almak için tıkla.
          </p>
          <button
            type="button"
            className="h-8 px-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm shrink-0"
            onClick={() => {
              void voice.reclaimVoice();
            }}
          >
            Buraya al
          </button>
        </div>
      )}
      <TitleBar
        activeNav={titleNav}
        subtitle="Dracord"
        onNavClick={(id) => {
          if (id === 'direct-messages') setView({ kind: 'friends' });
          else if (id === 'settings') setView({ kind: 'settings' });
          else if (id === 'voice') {
            if (voice.voiceGuildId && voice.voiceChannelId) {
              openChannel(voice.voiceGuildId, voice.voiceChannelId);
            } else {
              const vch = channels.find((c) => c.type === 'VOICE');
              if (vch && activeGuildId) void joinVoiceChannel(activeGuildId, vch);
              else setView({ kind: 'home' });
            }
          } else if (guilds[0]) {
            void client.getGuildChannels(guilds[0].id).then((chs) => {
              const first = pickChannel(guilds[0].id, chs);
              if (first) openChannel(guilds[0].id, first.id);
            });
          } else setView({ kind: 'home' });
        }}
        trailing={
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Ara (Ctrl+K)"
              data-tour="search"
              onClick={() => setSearchOpen(true)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            <NotificationBell
              onOpenAll={() => setView({ kind: 'notifications' })}
              onOpenSettings={() => setView({ kind: 'settings', tab: 'notifications' })}
              onNavigateLink={(link) => {
                const path = link.split('?')[0] ?? link;
                const me = path.match(/^\/channels\/(?:@me|me)(?:\/([^/?#]+))?/);
                if (me) {
                  if (me[1]) setView({ kind: 'dms', channelId: me[1] });
                  else setView({ kind: 'friends' });
                  return;
                }
                const ch = path.match(/^\/channels\/([^/]+)\/([^/?#]+)/);
                if (ch) {
                  openChannel(ch[1]!, ch[2]!);
                  return;
                }
                if (path.startsWith('/notifications')) {
                  setView({ kind: 'notifications' });
                  return;
                }
                if (path.startsWith('/settings')) {
                  setView({ kind: 'settings', tab: 'notifications' });
                }
              }}
            />
          </div>
        }
        windowControls={
          electronApi
            ? {
                onMinimize: () => electronApi.minimize?.(),
                onMaximize: () => electronApi.maximize?.(),
                onClose: () => electronApi.close?.(),
              }
            : undefined
        }
      />

      <div className="flex flex-1 min-h-0 min-w-0 w-full overflow-hidden">
        <ServerRail
          className="h-full shrink-0"
          guilds={railGuilds}
          activeGuildId={activeGuildId}
          homeActive={view.kind === 'home' || view.kind === 'friends' || view.kind === 'dms'}
          onHomeClick={() => setView({ kind: 'friends' })}
          onGuildClick={(guildId) => {
            void client.getGuildChannels(guildId).then((chs) => {
              const first = pickChannel(guildId, chs);
              if (first) openChannel(guildId, first.id);
            });
          }}
          onAddClick={() => {
            setModalError(null);
            setCreateOpen(true);
          }}
          onExploreClick={() => setView({ kind: 'discover' })}
          getGuildActions={getGuildActions}
          onGuildReorder={(orderedIds) => patchAppearance({ guildOrderIds: orderedIds })}
        />

        {(view.kind === 'channel' ||
          view.kind === 'guild-settings' ||
          view.kind === 'guild-boost') &&
          activeGuild && (
            <ChannelSidebar
              className="h-full w-72 min-w-[18rem] shrink-0"
              serverName={activeGuild.name}
              serverBannerUrl={
                activeGuild.bannerUrl ||
                'https://dracord.com.tr/guild-banner-default.webp'
              }
              onServerHeaderClick={() => setServerMenuOpen(true)}
              onVoiceMemberClick={(userId) => {
                const m = members.find((g) => g.id === userId);
                if (m) {
                  setProfileUser({
                    ...m,
                    status: liveMemberStatus(m.id, m.status),
                  });
                  return;
                }
                const fromVoice = Object.values(voiceMembersByChannel)
                  .flat()
                  .find((v) => v.id === userId);
                if (fromVoice) {
                  setProfileUser({
                    id: fromVoice.id,
                    username: fromVoice.id.slice(0, 8),
                    displayName: fromVoice.displayName,
                    avatarUrl: fromVoice.avatarUrl,
                    isBot: fromVoice.isBot,
                    status: 'ONLINE',
                  } as PublicUser);
                }
              }}
              categories={categories}
              headerExtra={
                <div className="px-2 pb-2 space-y-1.5">
                  <button
                    type="button"
                    className="w-full h-8 rounded-lg bg-surface-container-high text-on-surface font-label-sm hover:bg-surface-bright transition-colors"
                    disabled={inviteBusy}
                    onClick={() => {
                      setCreatedInviteUrl(null);
                      void createGuildInvite(activeGuild.id);
                    }}
                  >
                    İnsanları davet et
                  </button>
                  <button
                    type="button"
                    className="w-full h-8 rounded-lg bg-surface-container-high text-on-surface font-label-sm hover:bg-surface-bright transition-colors flex items-center justify-center gap-1.5"
                    onClick={() => setEventsOpen(true)}
                  >
                    <span className="material-symbols-outlined text-[16px]">event</span>
                    Etkinlikler
                  </button>
                  <button
                    type="button"
                    className="w-full h-8 rounded-lg bg-surface-container-high text-on-surface font-label-sm hover:bg-surface-bright transition-colors flex items-center justify-center gap-1.5"
                    onClick={() => setView({ kind: 'guild-boost', guildId: activeGuild.id })}
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary-container">
                      diamond
                    </span>
                    Sunucu Takviyeleri
                  </button>
                </div>
              }
              userPanel={{
                displayName: user?.displayName ?? '…',
                username: user?.username,
                avatarUrl: user?.avatarUrl,
                status: selfStatus,
                customStatus: user?.customStatus,
                muted: inVoiceInThisGuild ? voice.muted : undefined,
                deafened: inVoiceInThisGuild ? voice.deafened : undefined,
                voiceConnected: inVoiceInThisGuild,
                voiceChannelName: inVoiceInThisGuild
                  ? voice.voiceChannelName ?? undefined
                  : undefined,
                voiceServerName: inVoiceInThisGuild ? activeGuild.name : undefined,
                voiceLatencyMs: inVoiceInThisGuild ? voice.latencyMs : null,
                serverLatencyMs: inVoiceInThisGuild ? voice.serverLatencyMs : null,
                cameraOn: inVoiceInThisGuild ? voice.cameraEnabled : false,
                screenSharing: inVoiceInThisGuild ? voice.screenSharing : false,
                noiseCancellation: voice.noiseCancellation,
                micVolume: voice.audioSettings.micVolume,
                outputVolume: voice.audioSettings.outputVolume,
                inputDeviceId: voice.audioSettings.inputDeviceId,
                outputDeviceId: voice.audioSettings.outputDeviceId,
                inputDevices: voice.audioInputDevices,
                outputDevices: voice.audioOutputDevices,
                onMicVolumeChange: (v) => voice.setMicVolume(v),
                onOutputVolumeChange: (v) => voice.setOutputVolume(v),
                onInputDeviceChange: (id) => void voice.setInputDevice(id),
                onOutputDeviceChange: (id) => void voice.setOutputDevice(id),
                onAudioMenuOpen: () => {
                  void voice.refreshAudioDevices(true);
                },
                onNoiseClick: inVoiceInThisGuild
                  ? () => voice.toggleNoiseCancellation()
                  : undefined,
                onToggleCamera: inVoiceInThisGuild
                  ? () => void voice.toggleCamera()
                  : undefined,
                onToggleScreenShare: inVoiceInThisGuild
                  ? () => void voice.toggleScreenShare()
                  : undefined,
                onActivitiesClick: inVoiceInThisGuild
                  ? () => {
                      const game = channels.find((c) => c.type === 'GAME');
                      if (game && activeGuildId) {
                        void joinVoiceChannel(activeGuildId, game);
                      }
                    }
                  : undefined,
                screenShareViewControl:
                  inVoiceInThisGuild &&
                  (Boolean(voice.activeScreenShare) || voice.screenShareViewPaused) &&
                  voice.screenShares.length > 0
                    ? {
                        paused: voice.screenShareViewPaused,
                        onToggle: () =>
                          voice.screenShareViewPaused
                            ? voice.resumeScreenShareView()
                            : voice.pauseScreenShareView(),
                      }
                    : null,
                onVoiceReturnClick: () => {
                  if (voice.voiceGuildId && voice.voiceChannelId) {
                    openChannel(voice.voiceGuildId, voice.voiceChannelId);
                  }
                },
                onVoiceDisconnectClick: () => {
                  void (async () => {
                    // Önce metin kanalına geç (VoicePanel unmount) — sonra leave;
                    // aksi halde panel effect'i tekrar join edebilirdi (eski bug).
                    const leftId = voice.voiceChannelId;
                    const guildForLeave = activeGuildId ?? voice.voiceGuildId;
                    if (guildForLeave) {
                      const text = channels.find((c) => c.type === 'TEXT');
                      if (text) openChannel(guildForLeave, text.id);
                    }
                    const id = await voice.leave();
                    const chId = id ?? leftId;
                    if (chId && guildForLeave) {
                      const ch = channels.find((c) => c.id === chId);
                      if (ch && (ch.type === 'GAME' || ch.type === 'WATCH_PARTY')) {
                        try {
                          const s = await client.getChannelActivity(guildForLeave, chId);
                          if (s && user) {
                            if (
                              s.playerIds.includes(user.id) ||
                              s.spectatorIds.includes(user.id)
                            ) {
                              await client.leaveActivity(s.id);
                            }
                          }
                        } catch {
                          /* ignore */
                        }
                      }
                    }
                  })();
                },
                onMicClick: inVoiceInThisGuild
                  ? () => voice.setMuted(!voice.muted)
                  : undefined,
                onHeadphonesClick: inVoiceInThisGuild
                  ? () => voice.setDeafened(!voice.deafened)
                  : undefined,
                onSettingsClick: () => setView({ kind: 'settings' }),
                onVoiceSettingsClick: () => setView({ kind: 'settings' }),
                onProfileClick: () => setView({ kind: 'settings' }),
                onStatusChange: (status, customStatus) => {
                  void updatePresence({ status, customStatus });
                },
                selfMenuActions: [
                  {
                    id: 'profile',
                    label: 'Profil',
                    onSelect: () => setView({ kind: 'settings' }),
                  },
                  {
                    id: 'settings',
                    label: 'Kullanıcı ayarları',
                    onSelect: () => setView({ kind: 'settings' }),
                  },
                  {
                    id: 'voice',
                    label: 'Ses ve görüntü ayarları',
                    onSelect: () => setView({ kind: 'settings' }),
                  },
                  {
                    id: 'copy-id',
                    label: 'Kullanıcı ID’sini kopyala',
                    onSelect: () => {
                      if (user) void navigator.clipboard.writeText(user.id);
                    },
                  },
                  {
                    id: 'friends',
                    label: 'Arkadaşlar',
                    onSelect: () => setView({ kind: 'friends' }),
                  },
                  {
                    id: 'logout',
                    label: 'Çıkış yap',
                    danger: true,
                    onSelect: () => logout(),
                  },
                ],
              }}
            />
          )}

        {(view.kind === 'home' || view.kind === 'friends' || view.kind === 'dms') && (
          <DmSidebar
            active={view.kind === 'dms' ? 'dms' : 'friends'}
            activeChannelId={view.kind === 'dms' ? view.channelId : null}
            onFriends={() => setView({ kind: 'friends' })}
            onOpenDmChannel={(channelId) => setView({ kind: 'dms', channelId })}
            onOpenSettingsTab={(tab) => setView({ kind: 'settings', tab })}
            onFindChat={() => {
              setView({ kind: 'friends' });
              setFindChatOpen(true);
            }}
          />
        )}

        <main className="flex-1 min-w-0 min-h-0 flex flex-col" data-tour="chat">
          {view.kind === 'channel' && activeChannel?.type === 'TEXT' && (
            <ChatPanel
              className="flex-1 min-h-0"
              guildId={view.guildId}
              channel={activeChannel}
              members={members}
              showMembersToggle={() => setShowMembers((v) => !v)}
              jumpAroundId={jumpAroundId}
              onJumpAroundConsumed={() => setJumpAroundId(null)}
            />
          )}
          {view.kind === 'channel' && activeChannel?.type === 'FORUM' && (
            <ChatPanel
              className="flex-1 min-h-0"
              guildId={view.guildId}
              channel={activeChannel}
              members={members}
              showMembersToggle={() => setShowMembers((v) => !v)}
              jumpAroundId={jumpAroundId}
              onJumpAroundConsumed={() => setJumpAroundId(null)}
            />
          )}
          {view.kind === 'channel' && activeChannel?.type === 'VOICE' && (
            <VoicePanel
              guildId={view.guildId}
              channel={activeChannel}
              members={members}
              textChannels={channels.filter((c) => c.type === 'TEXT')}
              buildActions={(m) => buildMemberActions(m, activeChannel.id)}
              onLeaveNavigate={() => {
                const text = channels.find((c) => c.type === 'TEXT');
                if (text) openChannel(view.guildId, text.id);
              }}
              onOpenChannels={() => {
                /* sidebar zaten açık */
              }}
            />
          )}
          {view.kind === 'channel' && isActivity && activeChannel && (
            <ActivityPanel
              guildId={view.guildId}
              channel={activeChannel}
              members={members}
              textChannels={channels.filter((c) => c.type === 'TEXT')}
            />
          )}
          {view.kind === 'channel' && !activeChannel && <Empty>Kanal yükleniyor…</Empty>}
          {view.kind === 'home' && (
            <FriendsHubView
              findChatOpen={findChatOpen}
              onFindChatOpenChange={setFindChatOpen}
              onOpenDm={(channelId) => setView({ kind: 'dms', channelId })}
            />
          )}
          {view.kind === 'friends' && (
            <FriendsHubView
              findChatOpen={findChatOpen}
              onFindChatOpenChange={setFindChatOpen}
              onOpenDm={(channelId) => setView({ kind: 'dms', channelId })}
            />
          )}
          {view.kind === 'dms' && (
            <DmPanel
              channelId={view.channelId}
              onBack={() => setView({ kind: 'friends' })}
            />
          )}
          {view.kind === 'discover' && (
            <DiscoverPage
              guilds={guilds}
              onOpenChannel={(guildId, channelId) => openChannel(guildId, channelId)}
              onJoined={(id) => {
                void reloadGuilds().then(() =>
                  client.getGuildChannels(id).then((chs) => {
                    const first = pickChannel(id, chs);
                    if (first) openChannel(id, first.id);
                  }),
                );
              }}
            />
          )}
          {view.kind === 'settings' && (
            <SettingsPage
              initialTab={
                (view.tab as
                  | 'account'
                  | 'notifications'
                  | 'voice'
                  | 'appearance'
                  | 'nitro'
                  | 'gifts'
                  | 'boost'
                  | undefined) ?? 'account'
              }
              onClose={() => setView({ kind: 'friends' })}
              onOpenChannel={(guildId, channelId) => openChannel(guildId, channelId)}
              onOpenDm={() => setView({ kind: 'friends' })}
            />
          )}
          {view.kind === 'notifications' && (
            <NotificationsPanel
              guildNames={Object.fromEntries(guilds.map((g) => [g.id, g.name]))}
              onOpenSettings={() => setView({ kind: 'settings', tab: 'notifications' })}
              onNavigateLink={(link) => {
                const path = link.split('?')[0] ?? link;
                const me = path.match(/^\/channels\/(?:@me|me)(?:\/([^/?#]+))?/);
                if (me) {
                  if (me[1]) setView({ kind: 'dms', channelId: me[1] });
                  else setView({ kind: 'friends' });
                  return;
                }
                const ch = path.match(/^\/channels\/([^/]+)\/([^/?#]+)/);
                if (ch) openChannel(ch[1]!, ch[2]!);
              }}
            />
          )}
          {view.kind === 'guild-boost' && (
            <GuildBoostPage
              guildId={view.guildId}
              onBack={() => {
                const ch = channels.find((c) => c.type === 'TEXT') ?? channels[0];
                if (ch) openChannel(view.guildId, ch.id);
                else setView({ kind: 'home' });
              }}
            />
          )}
          {view.kind === 'guild-settings' && (
            <GuildSettingsPage
              guildId={view.guildId}
              onBack={() => {
                const ch = channels.find((c) => c.type === 'TEXT') ?? channels[0];
                if (ch) openChannel(view.guildId, ch.id);
                else setView({ kind: 'home' });
              }}
              onChannelsChanged={() => {
                reloadChannels(view.guildId);
              }}
              onInviteCreated={(url) => setCreatedInviteUrl(url)}
            />
          )}
        </main>

        {view.kind === 'channel' &&
          showMembers &&
          (activeChannel?.type === 'TEXT' || activeChannel?.type === 'FORUM') && (
            <MemberPanel
              members={members.map((m) => ({
                ...m,
                status: liveMemberStatus(m.id, m.status),
              }))}
              voicePeers={voice.peers.map((p) => ({
                id: p.id,
                displayName: p.displayName,
                avatarUrl: p.avatarUrl,
                isBot: Boolean((p as { isBot?: boolean }).isBot),
              }))}
              inVoice={Boolean(voice.connected && voice.voiceChannelId)}
              friendIds={friendIds}
              roleColors={prefs.accessibility.roleColors !== false}
              buildActions={(m) => buildMemberActions(m, voice.voiceChannelId)}
              draggable={canMoveMembers || Boolean(voice.voiceChannelId)}
              onOpenDm={(userId) => {
                const m = members.find((x) => x.id === userId);
                if (m?.isBot || userId === DRACORD_BOT_USER_ID) return;
                void client.openDm(userId).then((ch) =>
                  setView({ kind: 'dms', channelId: ch.id }),
                );
              }}
            />
          )}
      </div>

      {activeGuildId && (
        <GuildEventsModal
          open={eventsOpen}
          onClose={() => setEventsOpen(false)}
          guildId={activeGuildId}
          channels={channels}
        />
      )}

      <Modal
        open={serverMenuOpen}
        title={activeGuild?.name ?? 'Sunucu'}
        onClose={() => setServerMenuOpen(false)}
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="h-10 px-3 rounded-lg text-left hover:bg-surface-container-high text-sm flex items-center gap-2"
            onClick={() => {
              setServerMenuOpen(false);
              if (activeGuildId) void createGuildInvite(activeGuildId);
            }}
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            İnsanları davet et
          </button>
          {canManageChannels && (
            <button
              type="button"
              className="h-10 px-3 rounded-lg text-left hover:bg-surface-container-high text-sm flex items-center gap-2"
              onClick={() => {
                setServerMenuOpen(false);
                setCategoryNameDraft('');
                setCategoryModal({ mode: 'create' });
              }}
            >
              <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
              Kategori oluştur
            </button>
          )}
          <button
            type="button"
            className="h-10 px-3 rounded-lg text-left hover:bg-surface-container-high text-sm flex items-center gap-2"
            onClick={() => {
              setServerMenuOpen(false);
              if (activeGuildId) setView({ kind: 'guild-boost', guildId: activeGuildId });
            }}
          >
            <span className="material-symbols-outlined text-[18px] text-primary-container">
              diamond
            </span>
            Sunucu Takviyeleri
          </button>
          <button
            type="button"
            className="h-10 px-3 rounded-lg text-left hover:bg-surface-container-high text-sm flex items-center gap-2 disabled:opacity-50"
            disabled={!canManageGuild}
            onClick={() => {
              setServerMenuOpen(false);
              if (activeGuildId) setView({ kind: 'guild-settings', guildId: activeGuildId });
            }}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Sunucu ayarları
          </button>
          {canManageGuild && (
            <button
              type="button"
              className="h-10 px-3 rounded-lg text-left hover:bg-error/10 text-error text-sm flex items-center gap-2"
              onClick={() => {
                setServerMenuOpen(false);
                setConfirmDelete({ kind: 'guild' });
              }}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Sunucuyu sil
            </button>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(channelModal)}
        title={channelModal?.mode === 'edit' ? 'Kanalı düzenle' : 'Kanal oluştur'}
        onClose={() => setChannelModal(null)}
      >
        <input
          value={channelNameDraft}
          onChange={(e) => setChannelNameDraft(e.target.value)}
          placeholder="Kanal adı"
          className="w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none mb-3"
        />
        <button
          type="button"
          disabled={!channelNameDraft.trim() || !activeGuildId}
          className="w-full h-10 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
          onClick={() => {
            if (!activeGuildId || !channelModal) return;
            if (channelModal.mode === 'create') {
              void client
                .createChannel(activeGuildId, {
                  name: channelNameDraft.trim(),
                  type: channelModal.type as 'TEXT' | 'VOICE' | 'FORUM' | 'GAME' | 'WATCH_PARTY',
                  categoryId: channelModal.categoryId,
                  gameKind: channelModal.type === 'GAME' ? 'billiards' : undefined,
                })
                .then(() => {
                  setChannelModal(null);
                  reloadChannels(activeGuildId);
                })
                .catch((e) => setModalError(e instanceof Error ? e.message : 'Hata'));
            } else {
              void client
                .updateChannel(channelModal.channel.id, { name: channelNameDraft.trim() })
                .then(() => {
                  setChannelModal(null);
                  reloadChannels(activeGuildId);
                });
            }
          }}
        >
          Kaydet
        </button>
      </Modal>

      <Modal
        open={Boolean(categoryModal)}
        title={categoryModal?.mode === 'edit' ? 'Kategori düzenle' : 'Kategori oluştur'}
        onClose={() => setCategoryModal(null)}
      >
        <input
          value={categoryNameDraft}
          onChange={(e) => setCategoryNameDraft(e.target.value)}
          placeholder="Kategori adı"
          className="w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none mb-3"
        />
        <button
          type="button"
          disabled={!categoryNameDraft.trim() || !activeGuildId}
          className="w-full h-10 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
          onClick={() => {
            if (!activeGuildId || !categoryModal) return;
            if (categoryModal.mode === 'create') {
              void client
                .createGuildCategory(activeGuildId, categoryNameDraft.trim())
                .then(() => {
                  setCategoryModal(null);
                  reloadChannels(activeGuildId);
                });
            } else {
              void client
                .updateGuildCategory(activeGuildId, categoryModal.category.id, {
                  name: categoryNameDraft.trim(),
                })
                .then(() => {
                  setCategoryModal(null);
                  reloadChannels(activeGuildId);
                });
            }
          }}
        >
          Kaydet
        </button>
      </Modal>

      <Modal
        open={Boolean(voicePasswordPrompt)}
        title="Ses kanalı şifresi"
        onClose={() => setVoicePasswordPrompt(null)}
      >
        <input
          type="password"
          value={voicePassword}
          onChange={(e) => setVoicePassword(e.target.value)}
          className="w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none mb-3"
          placeholder="Şifre"
        />
        <button
          type="button"
          className="w-full h-10 rounded-lg bg-primary-container text-on-primary-container font-bold"
          onClick={() => {
            if (!activeGuildId || !voicePasswordPrompt) return;
            const ch = voicePasswordPrompt;
            setVoicePasswordPrompt(null);
            void joinVoiceChannel(activeGuildId, ch, voicePassword);
          }}
        >
          Katıl
        </button>
      </Modal>

      <Modal
        open={Boolean(moveTargetUser)}
        title={`${moveTargetUser?.displayName ?? ''} — ses kanalına taşı`}
        onClose={() => setMoveTargetUser(null)}
      >
        <div className="flex flex-col gap-1 max-h-64 overflow-auto">
          {channels
            .filter(
              (c) => c.type === 'VOICE' || c.type === 'GAME' || c.type === 'WATCH_PARTY',
            )
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className="h-10 px-3 rounded-lg text-left hover:bg-surface-container-high text-sm"
                onClick={() => {
                  if (!moveTargetUser) return;
                  void client.moveVoiceUser(moveTargetUser.id, c.id).then(() =>
                    setMoveTargetUser(null),
                  );
                }}
              >
                {c.name}
              </button>
            ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(rolePickerUser)}
        title={`Roller — ${rolePickerUser?.displayName ?? ''}`}
        onClose={() => setRolePickerUser(null)}
      >
        <div className="flex flex-col gap-1 max-h-64 overflow-auto">
          {roles.map((r) => {
            const has = Boolean(rolePickerUser?.roles?.some((x) => x.id === r.id));
            return (
              <button
                key={r.id}
                type="button"
                className="h-10 px-3 rounded-lg text-left hover:bg-surface-container-high text-sm flex justify-between"
                onClick={() => {
                  if (!activeGuildId || !rolePickerUser) return;
                  const op = has
                    ? client.removeMemberRole(activeGuildId, rolePickerUser.id, r.id)
                    : client.addMemberRole(activeGuildId, rolePickerUser.id, r.id);
                  void op.then(() =>
                    client.getGuildMembers(activeGuildId).then((list) => {
                      setMembers(list);
                      setRolePickerUser(list.find((m) => m.id === rolePickerUser.id) ?? null);
                    }),
                  );
                }}
              >
                <span>{r.name}</span>
                <span className="text-on-surface-variant">{has ? 'Kaldır' : 'Ver'}</span>
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Sunucu oluştur">
        {modalError && <p className="text-error text-sm mb-2">{modalError}</p>}
        <label className="flex flex-col gap-1 mb-3">
          <span className="text-xs text-on-surface-variant">Sunucu adı</span>
          <input
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-highest text-on-surface outline-none focus:ring-1 focus:ring-primary-container"
          />
        </label>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={discoverable}
            onChange={(e) => setDiscoverable(e.target.checked)}
          />
          Keşfette göster
        </label>
        {discoverable && (
          <div className="mb-3">
            <SearchableSelect
              value={discoverCategory}
              onChange={setDiscoverCategory}
              options={[
                { value: 'gaming', label: 'Oyun' },
                { value: 'music', label: 'Müzik' },
                { value: 'entertainment', label: 'Eğlence' },
                { value: 'tech', label: 'Teknoloji' },
                { value: 'education', label: 'Eğitim' },
              ]}
              placeholder="Kategori"
            />
          </div>
        )}
        <button
          type="button"
          disabled={modalBusy || serverName.trim().length < 2}
          className="w-full h-10 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
          onClick={() => {
            setModalBusy(true);
            setModalError(null);
            void client
              .createGuild({
                name: serverName.trim(),
                discoverable,
                discoverCategory: discoverCategory as
                  | 'gaming'
                  | 'music'
                  | 'entertainment'
                  | 'tech'
                  | 'education',
              })
              .then((g) => {
                setCreateOpen(false);
                setServerName('');
                return reloadGuilds().then(() =>
                  client.getGuildChannels(g.id).then((chs) => {
                    const first = pickChannel(g.id, chs);
                    if (first) openChannel(g.id, first.id);
                  }),
                );
              })
              .catch((e) => setModalError(e instanceof Error ? e.message : 'Hata'))
              .finally(() => setModalBusy(false));
          }}
        >
          Oluştur
        </button>
        <button
          type="button"
          className="w-full mt-2 h-10 rounded-lg bg-surface-container-high text-on-surface"
          onClick={() => {
            setCreateOpen(false);
            setInviteOpen(true);
          }}
        >
          Davet ile katıl
        </button>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Davet ile katıl">
        {modalError && <p className="text-error text-sm mb-2">{modalError}</p>}
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Davet kodu veya link"
          className="w-full h-10 px-3 rounded-lg bg-surface-container-highest text-on-surface mb-3 outline-none"
        />
        <button
          type="button"
          disabled={modalBusy || !inviteCode.trim()}
          className="w-full h-10 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
          onClick={() => {
            setModalBusy(true);
            setModalError(null);
            const raw = inviteCode.trim();
            const code = raw.includes('/') ? raw.split('/').pop()! : raw;
            void client
              .joinInvite(code)
              .then((g) => {
                setInviteOpen(false);
                setInviteCode('');
                return reloadGuilds().then(() =>
                  client.getGuildChannels(g.id).then((chs) => {
                    const first = pickChannel(g.id, chs);
                    if (first) openChannel(g.id, first.id);
                  }),
                );
              })
              .catch((e) => setModalError(e instanceof Error ? e.message : 'Katılınamadı'))
              .finally(() => setModalBusy(false));
          }}
        >
          Katıl
        </button>
      </Modal>

      <Modal
        open={Boolean(createdInviteUrl)}
        onClose={() => setCreatedInviteUrl(null)}
        title="İnsanları davet et"
      >
        <p className="text-sm text-on-surface-variant mb-3">
          Bu linki paylaş — panoya kopyalandı.
        </p>
        <input
          readOnly
          value={createdInviteUrl ?? ''}
          className="w-full h-10 px-3 rounded-lg bg-surface-container-highest text-on-surface mb-3 outline-none select-all"
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="w-full h-10 rounded-lg bg-primary-container text-on-primary-container font-bold"
          onClick={() => {
            if (createdInviteUrl) void navigator.clipboard?.writeText(createdInviteUrl);
          }}
        >
          Tekrar kopyala
        </button>
      </Modal>

      <Modal
        open={Boolean(voiceInviteChannel)}
        title="Sesli Sohbete Davet et"
        onClose={() => {
          setVoiceInviteChannel(null);
          setVoiceInviteFriends([]);
          setVoiceInviteError(null);
        }}
      >
        <p className="text-sm text-on-surface-variant mb-3">
          {voiceInviteChannel
            ? `${voiceInviteChannel.name} kanalına arkadaşlarını davet et.`
            : ''}
        </p>
        {voiceInviteError && (
          <p className="text-sm text-error mb-2">{voiceInviteError}</p>
        )}
        <ul className="max-h-72 overflow-y-auto flex flex-col gap-1">
          {voiceInviteFriends.length === 0 && (
            <li>
              <DracoEmpty
                mood="peek"
                size={72}
                title="Arkadaş listesi boş"
                description="Önce arkadaş ekle, sonra buradan davet edebilirsin."
              />
            </li>
          )}
          {voiceInviteFriends.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-container"
            >
              <Avatar displayName={f.displayName} imageUrl={f.avatarUrl} size="md" />
              <span className="flex-1 text-sm text-on-surface truncate">{f.displayName}</span>
              <button
                type="button"
                disabled={voiceInviteBusyId === f.id}
                className="h-8 px-2.5 rounded-md bg-surface-container-high hover:bg-primary-container hover:text-on-primary-container text-sm flex items-center gap-1 disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    if (!voiceInviteChannel || !activeGuildId) return;
                    setVoiceInviteBusyId(f.id);
                    setVoiceInviteError(null);
                    try {
                      const invite = await client.createInvite(activeGuildId);
                      const url = invite.url || `https://dracord.com.tr/invite/${invite.code}`;
                      const dm = await client.openDm(f.id);
                      await client.sendMessage(
                        dm.id,
                        `Sesli sohbete davet: **${voiceInviteChannel.name}** — ${url}`,
                      );
                      setVoiceInviteChannel(null);
                      setVoiceInviteFriends([]);
                    } catch (err) {
                      setVoiceInviteError(
                        err instanceof Error ? err.message : 'Davet gönderilemedi',
                      );
                    } finally {
                      setVoiceInviteBusyId(null);
                    }
                  })();
                }}
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                Davet
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 w-full h-9 rounded-lg bg-surface-container-high text-sm text-on-surface-variant hover:text-on-surface"
          onClick={() => {
            if (activeGuildId) void createGuildInvite(activeGuildId);
            setVoiceInviteChannel(null);
            setVoiceInviteFriends([]);
          }}
        >
          Davet linki kopyala…
        </button>
      </Modal>

      <ConfirmDialog
        open={Boolean(leaveTarget)}
        title="Sunucudan ayrıl"
        description={`${leaveTarget?.name ?? ''} sunucusundan ayrılmak istiyor musun?`}
        confirmLabel="Ayrıl"
        danger
        onCancel={() => setLeaveTarget(null)}
        onConfirm={() => {
          if (!leaveTarget) return;
          void client.leaveGuild(leaveTarget.id).then(async () => {
            setLeaveTarget(null);
            const g = await reloadGuilds();
            if (g[0]) {
              const chs = await client.getGuildChannels(g[0].id);
              const first = pickChannel(g[0].id, chs);
              if (first) openChannel(g[0].id, first.id);
              else setView({ kind: 'home' });
            } else setView({ kind: 'home' });
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={
          confirmDelete?.kind === 'guild'
            ? 'Sunucuyu sil'
            : confirmDelete?.kind === 'category'
              ? 'Kategoriyi sil'
              : 'Kanalı sil'
        }
        description={
          confirmDelete?.kind === 'guild'
            ? `${activeGuild?.name ?? ''} kalıcı olarak silinecek.`
            : confirmDelete?.kind === 'category'
              ? `${confirmDelete.category.name} silinsin mi?`
              : `#${confirmDelete?.kind === 'channel' ? confirmDelete.channel.name : ''} silinsin mi?`
        }
        confirmLabel="Sil"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete || !activeGuildId) return;
          if (confirmDelete.kind === 'channel') {
            void client.deleteChannel(confirmDelete.channel.id).then(() => {
              setConfirmDelete(null);
              reloadChannels(activeGuildId);
            });
          } else if (confirmDelete.kind === 'category') {
            void client.deleteGuildCategory(activeGuildId, confirmDelete.category.id).then(() => {
              setConfirmDelete(null);
              reloadChannels(activeGuildId);
            });
          } else {
            void client.deleteGuild(activeGuildId).then(async () => {
              setConfirmDelete(null);
              const g = await reloadGuilds();
              if (g[0]) {
                const chs = await client.getGuildChannels(g[0].id);
                const first = pickChannel(g[0].id, chs);
                if (first) openChannel(g[0].id, first.id);
              } else setView({ kind: 'home' });
            });
          }
        }}
      />

      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        guildId={activeGuildId}
        channelId={activeChannelId}
        guilds={guilds}
        channels={channels}
        onOpenChannel={(guildId, channelId, opts) => {
          openChannel(guildId, channelId);
          if (opts?.around) setJumpAroundId(opts.around);
        }}
        onOpenDm={(channelId, opts) => {
          setView({ kind: 'dms', channelId });
          if (opts?.around) setJumpAroundId(opts.around);
        }}
      />

      <UserProfileCard
        open={Boolean(profileUser)}
        onClose={() => setProfileUser(null)}
        variant="popout"
        user={{
          id: profileUser?.id ?? '',
          displayName: profileUser?.displayName ?? '',
          username: profileUser?.username,
          avatarUrl: profileUser?.avatarUrl,
          bannerUrl: profileUser?.bannerUrl,
          bannerColor: profileUser?.bannerColor,
          bio: profileUser?.bio,
          status: profileUser?.status,
          customStatus: profileUser?.customStatus,
          isBot: profileUser?.isBot,
          roles: profileUser?.roles,
          socialLinks: profileUser?.socialLinks,
          accentColor: profileUser?.accentColor,
        }}
        actions={
          profileUser && profileUser.id !== user?.id
            ? [
                ...(profileUser.isBot || profileUser.id === DRACORD_BOT_USER_ID
                  ? []
                  : [
                      {
                        id: 'dm',
                        label: 'Mesaj gönder',
                        onClick: () => {
                          void client.openDm(profileUser.id).then((ch) => {
                            setProfileUser(null);
                            setView({ kind: 'dms', channelId: ch.id });
                          });
                        },
                      },
                      ...(!friendIds.has(profileUser.id)
                        ? [
                            {
                              id: 'friend',
                              label: 'Arkadaşlık isteği gönder',
                              onClick: () => {
                                void client.sendFriendRequest(profileUser.id).then(() => {
                                  setFriendIds((prev) => new Set([...prev, profileUser.id]));
                                });
                              },
                            },
                          ]
                        : []),
                      {
                        id: 'block',
                        label: 'Engelle',
                        danger: true,
                        onClick: () => {
                          void client.blockUser(profileUser.id);
                          setProfileUser(null);
                        },
                      },
                    ]),
              ]
            : []
        }
      />

      <AppTour />
    </div>
  );
}


function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid place-items-center h-full text-on-surface-variant">{children}</div>
  );
}
