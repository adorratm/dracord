'use client';

import type {
  CategoryDto,
  ChannelSummary,
  PublicUser,
  VoiceMemberSummary,
  VoiceStatePayload,
} from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import {
  Avatar,
  ChannelSidebar,
  ChatInput,
  ConfirmDialog,
  MemberList,
  MessageList,
  Modal,
  SearchableSelect,
  UserProfileCard,
  VoiceStage,
  VolumeSlider,
  presenceLabelTr,
  type MemberListGroup,
  type MemberListAction,
} from '@dracord/ui';
import type { RoleDto } from '@dracord/types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell, rememberChannel } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { DracoEmpty } from '@/components/Draco';
import { openMessageSearch } from '@/components/GlobalSearch';
import { MobileDrawer } from '@/components/MobileDrawer';
import { VoiceSideChat } from '@/components/VoiceSideChat';
import { buildSidebarCategories } from '@/lib/channels';
import {
  filterMessageContent,
  isSuspiciousUrl,
} from '@/lib/content-filter';
import {
  extractForumTags,
  sortForumMessages,
  type ForumSort,
} from '@/lib/forum';
import { useChatChannel } from '@/hooks/useChatChannel';
import { useGuildNav } from '@/hooks/useGuildNav';
import { useVoiceSession } from '@/components/VoiceSessionProvider';
import { useUserPreferences } from '@/lib/user-preferences';
import { MusicPlayerBar } from '@/components/MusicPlayerBar';
import { PinnedMessageBar } from '@/components/PinnedMessageBar';

interface GuildChannelViewProps {
  guildId: string;
  channelId: string;
  aroundMessageId?: string | null;
  /** Arama / deep-link ile thread aç */
  openThreadId?: string | null;
}

type ConfirmState =
  | { kind: 'channel'; channel: ChannelSummary }
  | { kind: 'category'; category: CategoryDto }
  | { kind: 'guild' }
  | null;

export function GuildChannelView({
  guildId,
  channelId,
  aroundMessageId,
  openThreadId,
}: GuildChannelViewProps) {
  const router = useRouter();
  const { user, client, setUser } = useAuth();
  const {
    guilds,
    guild,
    channels,
    categories: guildCategories,
    loading,
    error: navError,
    reload,
    patchGuild,
    patchChannelUnread,
  } = useGuildNav(guildId);
  const channel = channels.find((c) => c.id === channelId);
  const isVoiceView = channel?.type === 'VOICE';
  const isForumView = channel?.type === 'FORUM';
  const [forumSort, setForumSort] = useState<ForumSort>('newest');
  const [forumTag, setForumTag] = useState<string | null>(null);
  const channelPending = !channel && loading;
  const channelMissing = !channel && !loading && channels.length > 0;
  const channelsEmpty = !channel && !loading && channels.length === 0;

  const {
    messages,
    loading: chatLoading,
    loadingOlder,
    hasMore,
    pendingNewCount,
    setAtLiveEdge,
    loadOlder,
    jumpToPresent,
    sendMessage,
    sendWithAttachments,
    sendMedia,
    sendPoll,
    editMessage,
    deleteMessage,
    reactToMessage,
    votePoll,
    hideMessage,
    unhideMessage,
    pinMessage,
    bookmarkMessage,
    error: chatError,
    typingUsers,
    notifyTyping,
  } = useChatChannel(isVoiceView ? undefined : channelId, aroundMessageId);
  const voice = useVoiceSession();
  const { prefs } = useUserPreferences();
  const lastSpokeAtRef = useRef(Date.now());
  const afkMovingRef = useRef(false);
  const afkMuteAppliedRef = useRef(false);

  const voiceChannel = channels.find((c) => c.id === voice.voiceChannelId);
  const inVoice = Boolean(voice.voiceChannelId);
  const showingVoiceStage = isVoiceView && voice.voiceChannelId === channelId;
  const isConnecting =
    isVoiceView && voice.voiceChannelId === channelId && !voice.connected && !voice.error;

  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceChatChannelId, setVoiceChatChannelId] = useState<string | null>(null);
  const [voiceChatWidth, setVoiceChatWidth] = useState(340);
  const [voicePartsWidth, setVoicePartsWidth] = useState(288);
  const [voiceMembersByChannel, setVoiceMembersByChannel] = useState<
    Record<string, VoiceMemberSummary[]>
  >({});
  const [channelModal, setChannelModal] = useState<{
    mode: 'create' | 'edit';
    categoryId: string | null;
    channel?: ChannelSummary;
  } | null>(null);
  const [categoryModal, setCategoryModal] = useState<{
    mode: 'create' | 'edit';
    category?: CategoryDto;
  } | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'TEXT' | 'VOICE' | 'FORUM'>('TEXT');
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [serverNameDraft, setServerNameDraft] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [canManageChannels, setCanManageChannels] = useState(false);
  const [canManageMessages, setCanManageMessages] = useState(false);
  const [canManageGuild, setCanManageGuild] = useState(false);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [canMoveMembers, setCanMoveMembers] = useState(false);
  const [canKickMembers, setCanKickMembers] = useState(false);
  const [canBanMembers, setCanBanMembers] = useState(false);
  const [canModerateMembers, setCanModerateMembers] = useState(false);
  const [moveTargetUser, setMoveTargetUser] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(`dracord.collapsedCats.${guildId}`);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set();
    }
  });
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<{
    id: string;
    preview: string;
  } | null>(null);
  const [editMessageTarget, setEditMessageTarget] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState('Evet\nHayır');
  const [msgBusy, setMsgBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    authorName: string;
    contentPreview: string;
  } | null>(null);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [headingText, setHeadingText] = useState('');
  const [forwardTarget, setForwardTarget] = useState<{
    id: string;
    contentPreview: string;
  } | null>(null);
  const [forwardChannelId, setForwardChannelId] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [pinsOpen, setPinsOpen] = useState(false);
  const [threadRoot, setThreadRoot] = useState<import('@dracord/types').MessageDto | null>(
    null,
  );
  const [threadMessages, setThreadMessages] = useState<
    import('@dracord/types').MessageDto[]
  >([]);
  const [threadBusy, setThreadBusy] = useState(false);
  const [threadDraft, setThreadDraft] = useState('');
  const [botSlashCommands, setBotSlashCommands] = useState<
    Array<{ name: string; aliases?: string[]; description: string; usage: string }>
  >([]);
  const [pins, setPins] = useState<
    Array<{ id: string; content: string; authorName: string }>
  >([]);
  const [latestPin, setLatestPin] = useState<import('@dracord/types').MessageDto | null>(
    null,
  );
  const [pinCount, setPinCount] = useState(0);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const [threadSending, setThreadSending] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [busy, setBusy] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [guildMembers, setGuildMembers] = useState<PublicUser[]>([]);
  const [guildRoles, setGuildRoles] = useState<RoleDto[]>([]);
  const [profileUser, setProfileUser] = useState<PublicUser | null>(null);
  const [voicePasswordPrompt, setVoicePasswordPrompt] = useState<{
    channel: ChannelSummary;
  } | null>(null);
  const [voicePasswordDraft, setVoicePasswordDraft] = useState('');
  const [channelLocked, setChannelLocked] = useState(false);
  const [channelPasswordDraft, setChannelPasswordDraft] = useState('');
  const [channelDeniedIds, setChannelDeniedIds] = useState<string[]>([]);
  const [channelOverwrites, setChannelOverwrites] = useState<
    Array<{ id: string; type: 'role' | 'member'; allow: string[]; deny: string[] }>
  >([]);
  const [showOverwriteEditor, setShowOverwriteEditor] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);

  const mentionNames = useMemo(() => {
    if (!user) return [] as string[];
    const names = [user.username, user.displayName].filter(Boolean);
    return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  }, [user]);

  const channelNames = useMemo(
    () =>
      channels
        .filter((c) => c.type === 'TEXT' || c.type === 'FORUM')
        .map((c) => c.name),
    [channels],
  );

  const mentionUsers = useMemo(
    () =>
      guildMembers.map((m) => ({
        id: m.id,
        username: m.username,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
      })),
    [guildMembers],
  );

  const mentionChannels = useMemo(
    () =>
      channels
        .filter((c) => c.type === 'TEXT' || c.type === 'VOICE')
        .map((c) => ({ id: c.id, name: c.name, type: c.type })),
    [channels],
  );

  useEffect(() => {
    setChannelsOpen(false);
    setMembersOpen(false);
  }, [guildId, channelId]);

  useEffect(() => {
    if (!guildId || !user) return;
    void client
      .getGuildMembers(guildId)
      .then((members) => {
        setGuildMembers(
          members.map((m) => {
            if (m.id !== user.id) return m;
            // Sayfa geçişinde API hâlâ OFFLINE dönebilir; oturum açıkken kendini çevrimdışı gösterme
            const live =
              user.status === 'IDLE' || user.status === 'DND' || user.status === 'ONLINE'
                ? user.status
                : 'ONLINE';
            return {
              ...m,
              status: live,
              customStatus: user.customStatus ?? m.customStatus,
            };
          }),
        );
      })
      .catch(() => setGuildMembers([]));
    void client
      .listGuildRoles(guildId)
      .then(setGuildRoles)
      .catch(() => setGuildRoles([]));
  }, [client, guildId, user]);

  // Canlı presence: sayfa geçişlerinde stale OFFLINE kalmasın
  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onPresence = (payload: {
      userId: string;
      status: PublicUser['status'];
      customStatus?: string | null;
    }) => {
      // Kendi oturumun bağlıyken gelen OFFLINE (reconnect grace) yok say
      if (
        payload.userId === user.id &&
        payload.status === 'OFFLINE' &&
        client.socket?.connected
      ) {
        return;
      }
      // Seste görünen biri OFFLINE gelirse çevrimiçi tut
      const inVoiceNow = voice.participants.some((p) => p.id === payload.userId);
      const nextStatus =
        inVoiceNow && payload.status === 'OFFLINE' ? ('ONLINE' as const) : payload.status;

      setGuildMembers((prev) =>
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
  }, [client, user, voice.participants]);

  // Kendi status'umuzu üye listesinde canlı tut
  useEffect(() => {
    if (!user) return;
    const live =
      user.status === 'OFFLINE' && client.socket?.connected
        ? ('ONLINE' as const)
        : user.status;
    setGuildMembers((prev) =>
      prev.map((m) =>
        m.id === user.id
          ? { ...m, status: live, customStatus: user.customStatus }
          : m,
      ),
    );
  }, [user?.id, user?.status, user?.customStatus, client]);

  /** API OFFLINE döndürse bile: ses kanalındaysa veya kendi oturumun açıksa canlı durum */
  const liveMemberStatus = useCallback(
    (memberId: string, fallback?: PublicUser['status'] | null): PublicUser['status'] => {
      const inVoiceNow = voice.participants.some((p) => p.id === memberId);
      if (user && memberId === user.id) {
        if (user.status === 'IDLE' || user.status === 'DND') return user.status;
        if (user.status === 'ONLINE') return 'ONLINE';
        // OFFLINE / eksik: socket veya seste ise online göster
        if (client.socket?.connected || inVoiceNow) return 'ONLINE';
        return 'OFFLINE';
      }
      if (inVoiceNow) {
        if (fallback === 'IDLE' || fallback === 'DND' || fallback === 'ONLINE') return fallback;
        return 'ONLINE';
      }
      return fallback ?? 'OFFLINE';
    },
    [user, voice.participants, client],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dracord.collapsedCats.${guildId}`);
      setCollapsedCats(raw ? new Set(JSON.parse(raw) as string[]) : new Set());
    } catch {
      setCollapsedCats(new Set());
    }
  }, [guildId]);

  const toggleCategoryCollapse = useCallback(
    (categoryId: string) => {
      setCollapsedCats((prev) => {
        const next = new Set(prev);
        if (next.has(categoryId)) next.delete(categoryId);
        else next.add(categoryId);
        try {
          localStorage.setItem(
            `dracord.collapsedCats.${guildId}`,
            JSON.stringify([...next]),
          );
        } catch {
          // ignore
        }
        return next;
      });
    },
    [guildId],
  );

  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);

  useEffect(() => {
    if (!guildId || !user) return;
    void client
      .getGuildPermissions(guildId)
      .then((p) => {
        const set = new Set(p.permissions);
        const god = Boolean(p.platformAdmin) || Boolean(user.isPlatformAdmin);
        setCanManageGuild(
          god || p.owner || set.has('MANAGE_GUILD') || set.has('ADMINISTRATOR'),
        );
        setCanManageChannels(
          god || p.owner || set.has('MANAGE_CHANNELS') || set.has('ADMINISTRATOR'),
        );
        setCanManageMessages(
          god || p.owner || set.has('MANAGE_MESSAGES') || set.has('ADMINISTRATOR'),
        );
        setCanManageRoles(
          god || p.owner || set.has('MANAGE_ROLES') || set.has('ADMINISTRATOR'),
        );
        setCanMoveMembers(
          god ||
            p.owner ||
            set.has('MOVE_MEMBERS') ||
            set.has('MANAGE_CHANNELS') ||
            set.has('ADMINISTRATOR'),
        );
        setCanKickMembers(
          god || p.owner || set.has('KICK_MEMBERS') || set.has('ADMINISTRATOR'),
        );
        setCanBanMembers(
          god || p.owner || set.has('BAN_MEMBERS') || set.has('ADMINISTRATOR'),
        );
        setCanModerateMembers(
          god || p.owner || set.has('MODERATE_MEMBERS') || set.has('ADMINISTRATOR'),
        );
      })
      .catch(() => {
        setCanManageGuild(false);
        setCanManageChannels(false);
        setCanManageMessages(false);
        setCanManageRoles(false);
        setCanMoveMembers(false);
        setCanKickMembers(false);
        setCanBanMembers(false);
        setCanModerateMembers(false);
      });
  }, [client, guildId, user]);

  useEffect(() => {
    rememberChannel(guildId, channelId);
  }, [guildId, channelId]);

  useEffect(() => {
    setReplyTo(null);
    setPinsOpen(false);
    if (!channelId || isVoiceView) return;
    void client.markChannelRead(channelId).catch(() => undefined);
    patchChannelUnread(channelId, 0, true);
  }, [channelId, client, isVoiceView, patchChannelUnread]);

  const refreshPins = useCallback(async () => {
    if (!channelId || isVoiceView) {
      setLatestPin(null);
      setPinCount(0);
      setPins([]);
      return;
    }
    try {
      const list = await client.listPinnedMessages(channelId);
      setPinCount(list.length);
      setLatestPin(list[0] ?? null);
      setPins(
        list.map((m) => ({
          id: m.id,
          content: m.content.slice(0, 100),
          authorName: m.author.displayName,
        })),
      );
    } catch {
      setLatestPin(null);
      setPinCount(0);
      setPins([]);
    }
  }, [channelId, client, isVoiceView]);

  useEffect(() => {
    void refreshPins();
  }, [refreshPins]);

  useEffect(() => {
    if (!channelId) return;
    const sock = client.connectSocket();
    const onUpdate = (message: import('@dracord/types').MessageDto) => {
      if (message.channelId !== channelId) return;
      if (message.pinnedAt || latestPin?.id === message.id) {
        void refreshPins();
      }
    };
    const onDelete = (payload: { id: string; channelId: string }) => {
      if (payload.channelId !== channelId) return;
      if (latestPin?.id === payload.id) void refreshPins();
    };
    sock.on(SocketEvents.MESSAGE_UPDATE, onUpdate);
    sock.on(SocketEvents.MESSAGE_DELETE, onDelete);
    return () => {
      sock.off(SocketEvents.MESSAGE_UPDATE, onUpdate);
      sock.off(SocketEvents.MESSAGE_DELETE, onDelete);
    };
  }, [channelId, client, refreshPins, latestPin?.id]);

  useEffect(() => {
    if (!pinsOpen || !channelId) return;
    void refreshPins();
  }, [pinsOpen, channelId, refreshPins]);

  // Kanal değişince thread kapat
  useEffect(() => {
    setThreadRoot(null);
    setThreadDraft('');
  }, [channelId]);

  // Arama deep-link: ?thread= kök id
  useEffect(() => {
    if (!openThreadId) return;
    let cancelled = false;
    void client
      .getMessageThread(openThreadId)
      .then((page) => {
        if (cancelled) return;
        const items = page.items ?? [];
        const root = items.find((m) => m.id === openThreadId) ?? items[0];
        if (root) {
          setThreadRoot(root);
          setThreadMessages(items.length ? items : [root]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [openThreadId, client, channelId]);

  useEffect(() => {
    if (!threadRoot) {
      setThreadMessages([]);
      return;
    }
    setThreadBusy(true);
    void client
      .getMessageThread(threadRoot.id)
      .then((page) => setThreadMessages(page.items))
      .catch(() => setThreadMessages([threadRoot]))
      .finally(() => setThreadBusy(false));
  }, [threadRoot, client]);

  useEffect(() => {
    if (!threadRoot) return;
    const sock = client.connectSocket();
    const onCreate = (message: import('@dracord/types').MessageDto) => {
      if (message.threadRootId !== threadRoot.id && message.id !== threadRoot.id) return;
      setThreadMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };
    sock.on(SocketEvents.MESSAGE_CREATE, onCreate);
    return () => {
      sock.off(SocketEvents.MESSAGE_CREATE, onCreate);
    };
  }, [threadRoot, client]);

  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [threadMessages.length, threadRoot?.id]);

  useEffect(() => {
    void client
      .listBotCommands(guildId)
      .then((res) => setBotSlashCommands(res.commands ?? []))
      .catch(() => setBotSlashCommands([]));
  }, [client, guildId]);

  useEffect(() => {
    const map: Record<string, VoiceMemberSummary[]> = {};
    for (const ch of channels) {
      if (ch.type !== 'VOICE') continue;
      let members = [...(ch.voiceMembers ?? [])];
      // Sunucudan gelen hayalet self kaydını daha en başta ele
      if (user && voice.voiceChannelId !== ch.id) {
        members = members.filter((m) => m.id !== user.id);
      }
      // Anahtarı her zaman yaz — boş dizi API fallback’ini engeller (hayalet ikon)
      map[ch.id] = members;
    }
    setVoiceMembersByChannel((prev) => {
      const next = { ...map };
      if (voice.voiceChannelId && prev[voice.voiceChannelId]) {
        const local = prev[voice.voiceChannelId]!;
        const api = next[voice.voiceChannelId] ?? [];
        const byId = new Map(api.map((m) => [m.id, m]));
        for (const m of local) byId.set(m.id, m);
        next[voice.voiceChannelId] = [...byId.values()];
      }
      if (user && !voice.voiceChannelId) {
        for (const key of Object.keys(next)) {
          next[key] = (next[key] ?? []).filter((m) => m.id !== user.id);
        }
      }
      return next;
    });
  }, [channels, voice.voiceChannelId, user]);

  useEffect(() => {
    if (!user) return;
    client.connectSocket();
    client.joinChannel(guildId);

    const onVoice = (payload: VoiceStatePayload) => {
      if (payload.guildId !== guildId) return;
      // Uzaktan gelen self join: yalnızca gerçekten o kanaldayken kabul et
      if (
        payload.user.id === user.id &&
        payload.action !== 'leave' &&
        payload.channelId &&
        voice.voiceChannelId !== payload.channelId
      ) {
        return;
      }
      setVoiceMembersByChannel((prev) => {
        const next = { ...prev };
        if (payload.action === 'leave' || !payload.channelId) {
          for (const key of Object.keys(next)) {
            next[key] = (next[key] ?? []).filter((m) => m.id !== payload.user.id);
          }
          return next;
        }
        for (const key of Object.keys(next)) {
          next[key] = (next[key] ?? []).filter((m) => m.id !== payload.user.id);
        }
        const list = [...(next[payload.channelId] ?? []).filter((m) => m.id !== payload.user.id)];
        list.push(payload.user);
        next[payload.channelId] = list;
        return next;
      });
    };

    client.socket?.on(SocketEvents.VOICE_STATE, onVoice);
    return () => {
      client.socket?.off(SocketEvents.VOICE_STATE, onVoice);
    };
  }, [client, guildId, user, voice.voiceChannelId]);

  // Tüm metin kanallarına join + okunmamış sayaç (aktif kanal hariç)
  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const textIds = channels.filter((c) => c.type === 'TEXT').map((c) => c.id);
    for (const id of textIds) client.joinChannel(id);

    const onCreate = (msg: { channelId: string; author?: { id?: string } }) => {
      if (!msg?.channelId) return;
      if (msg.channelId === channelId) return;
      if (msg.author?.id === user.id) return;
      if (!textIds.includes(msg.channelId)) return;
      patchChannelUnread(msg.channelId, 1);
    };
    sock.on(SocketEvents.MESSAGE_CREATE, onCreate);
    return () => {
      sock.off(SocketEvents.MESSAGE_CREATE, onCreate);
    };
  }, [client, user, channels, channelId, patchChannelUnread]);

  // AFK kanalı: konuşma yoksa süre dolunca AFK’ya taşı (mute girişte uygulanır)
  useEffect(() => {
    const afkId = guild?.afkChannelId;
    const timeoutMin = guild?.afkTimeoutMinutes ?? 0;
    if (!afkId || timeoutMin <= 0 || !voice.voiceChannelId || !voice.connected || !user) {
      return;
    }

    const self = voice.participants.find((p) => p.id === user.id);
    if (self?.speaking) {
      lastSpokeAtRef.current = Date.now();
    }

    const tick = window.setInterval(() => {
      if (afkMovingRef.current) return;
      if (voice.voiceChannelId === afkId) return;
      const idleMs = Date.now() - lastSpokeAtRef.current;
      if (idleMs < timeoutMin * 60_000) return;
      afkMovingRef.current = true;
      void (async () => {
        try {
          await voice.join(afkId, guildId);
          router.push(`/channels/${guildId}/${afkId}`);
        } finally {
          window.setTimeout(() => {
            afkMovingRef.current = false;
          }, 2000);
        }
      })();
    }, 5000);

    return () => window.clearInterval(tick);
  }, [
    guild?.afkChannelId,
    guild?.afkTimeoutMinutes,
    voice,
    user,
    guildId,
    router,
  ]);

  // AFK kanalına her girişte (elle veya otomatik) mic + kulaklık mute
  useEffect(() => {
    const afkId = guild?.afkChannelId;
    if (!afkId || !voice.connected || voice.voiceChannelId !== afkId) {
      afkMuteAppliedRef.current = false;
      return;
    }
    if (afkMuteAppliedRef.current) return;
    afkMuteAppliedRef.current = true;
    sessionStorage.setItem('dracord:was-afk', '1');
    void (async () => {
      if (!voice.muted) await voice.toggleMute();
      if (!voice.deafened) await voice.toggleDeafen();
    })();
  }, [guild?.afkChannelId, voice.voiceChannelId, voice.connected, voice]);

  // AFK’dan başka kanala geçince mute/deafen kaldır
  useEffect(() => {
    const afkId = guild?.afkChannelId;
    if (!afkId || !voice.voiceChannelId || !voice.connected) return;
    if (voice.voiceChannelId === afkId) return;
    const prev = sessionStorage.getItem('dracord:was-afk');
    if (prev === '1') {
      sessionStorage.removeItem('dracord:was-afk');
      void (async () => {
        if (voice.muted) await voice.toggleMute();
        if (voice.deafened) await voice.toggleDeafen();
      })();
    }
  }, [guild?.afkChannelId, voice.voiceChannelId, voice.connected, voice]);

  useEffect(() => {
    if (!voice.voiceChannelId) {
      // Aktif ses yoksa kendimizi tüm lokal listelerden çıkar.
      if (!user) return;
      setVoiceMembersByChannel((prev) => {
        let changed = false;
        const next: Record<string, VoiceMemberSummary[]> = {};
        for (const [id, list] of Object.entries(prev)) {
          const filtered = list.filter((m) => m.id !== user.id);
          if (filtered.length !== list.length) changed = true;
          next[id] = filtered;
        }
        return changed ? next : prev;
      });
      return;
    }
    setVoiceMembersByChannel((prev) => ({
      ...prev,
      [voice.voiceChannelId!]: voice.participants.map((p) => {
        const m = guildMembers.find((g) => g.id === p.id);
        return {
          id: p.id,
          displayName: p.displayName || m?.displayName || p.id,
          avatarUrl: p.avatarUrl || m?.avatarUrl || null,
          muted: p.muted,
          deafened: false,
          speaking: Boolean(p.speaking),
          isBot: Boolean((p as { isBot?: boolean }).isBot || m?.isBot),
        };
      }),
    }));
  }, [voice.voiceChannelId, voice.participants, user, guildMembers]);

  const leaveVoiceAndMaybeNavigate = useCallback(() => {
    const leftId = voice.leave();
    if (user) {
      setVoiceMembersByChannel((prev) => {
        const next: Record<string, VoiceMemberSummary[]> = {};
        for (const [id, list] of Object.entries(prev)) {
          next[id] = list.filter((m) => m.id !== user.id);
        }
        if (leftId && !(leftId in next)) next[leftId] = [];
        return next;
      });
    }
    if (isVoiceView || (leftId && channelId === leftId)) {
      const text =
        channels.find((c) => c.type === 'TEXT') ??
        channels.find((c) => c.type === 'FORUM');
      if (text) router.push(`/channels/${guildId}/${text.id}`);
    }
  }, [voice, user, isVoiceView, channelId, channels, guildId, router]);

  const openEditChannel = useCallback((ch: ChannelSummary) => {
    setChannelName(ch.name);
    setChannelType(
      ch.type === 'VOICE' ? 'VOICE' : ch.type === 'FORUM' ? 'FORUM' : 'TEXT',
    );
    setChannelLocked(Boolean(ch.locked));
    setChannelPasswordDraft('');
    setChannelDeniedIds(ch.deniedUserIds ?? []);
    setChannelOverwrites(
      (ch.permissionOverwrites ?? []).map((o) => ({
        id: o.id,
        type: o.type,
        allow: [...(o.allow ?? [])],
        deny: [...(o.deny ?? [])],
      })),
    );
    setShowOverwriteEditor(false);
    setChannelModal({ mode: 'edit', categoryId: ch.categoryId, channel: ch });
  }, []);

  const setOverwritePerm = useCallback(
    (
      targetId: string,
      targetType: 'role' | 'member',
      perm: string,
      mode: 'inherit' | 'allow' | 'deny',
    ) => {
      setChannelOverwrites((prev) => {
        const idx = prev.findIndex((o) => o.id === targetId && o.type === targetType);
        const base =
          idx >= 0
            ? { ...prev[idx], allow: [...prev[idx].allow], deny: [...prev[idx].deny] }
            : { id: targetId, type: targetType, allow: [] as string[], deny: [] as string[] };
        base.allow = base.allow.filter((p) => p !== perm);
        base.deny = base.deny.filter((p) => p !== perm);
        if (mode === 'allow') base.allow.push(perm);
        if (mode === 'deny') base.deny.push(perm);
        const empty = base.allow.length === 0 && base.deny.length === 0;
        if (idx < 0) {
          return empty ? prev : [...prev, base];
        }
        if (empty) return prev.filter((_, i) => i !== idx);
        const next = [...prev];
        next[idx] = base;
        return next;
      });
    },
    [],
  );

  const openMemberDm = useCallback(
    async (memberId: string, isBot?: boolean) => {
      if (isBot) {
        setDmError('Bot’a DM açılamaz');
        return;
      }
      setDmError(null);
      try {
        const ch = await client.openDm(memberId);
        setMembersOpen(false);
        if (isVoiceView && voice.voiceChannelId === channelId) {
          setChatOpen(true);
          setVoiceChatChannelId(ch.id);
          return;
        }
        router.push(`/channels/me/${ch.id}`);
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'DM açılamadı');
      }
    },
    [client, router, isVoiceView, voice.voiceChannelId, channelId],
  );

  const joinVoiceChannel = useCallback(
    async (ch: ChannelSummary, password?: string) => {
      try {
        // iOS: mikrofon izni router.push öncesinde (jest içinde) alınmalı
        await voice.join(ch.id, guildId, password ? { password } : undefined);
      } catch {
        return;
      }
      setChannelsOpen(false);
      router.push(`/channels/${guildId}/${ch.id}`);
    },
    [voice, guildId, router],
  );

  const selectChannel = useCallback(
    (ch: ChannelSummary) => {
      if (ch.type === 'VOICE') {
        if (ch.locked && ch.hasPassword && !canManageChannels) {
          setVoicePasswordDraft('');
          setVoicePasswordPrompt({ channel: ch });
          return;
        }
        joinVoiceChannel(ch);
        return;
      }
      setChannelsOpen(false);
      router.push(`/channels/${guildId}/${ch.id}`);
    },
    [joinVoiceChannel, guildId, router, canManageChannels],
  );

  const disconnectFromVoice = useCallback(
    async (targetUserId: string) => {
      const chId = voice.voiceChannelId ?? (isVoiceView ? channelId : null);
      if (!chId || !canMoveMembers) return;
      try {
        await client.disconnectVoiceUser(chId, targetUserId);
        await reload();
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Odadan ayrılamadı');
      }
    },
    [voice.voiceChannelId, isVoiceView, channelId, canMoveMembers, client, reload],
  );

  const platformAdminIds = useMemo(() => {
    const ids = new Set<string>();
    for (const m of guildMembers) {
      if (m.isPlatformAdmin) ids.add(m.id);
    }
    if (user?.isPlatformAdmin && user.id) ids.add(user.id);
    return ids;
  }, [guildMembers, user?.id, user?.isPlatformAdmin]);

  const moveToVoiceChannel = useCallback(
    async (targetUserId: string, targetChannelId: string) => {
      const isSelf = Boolean(user?.id && targetUserId === user.id);
      if (!isSelf && !canMoveMembers) return;
      if (!isSelf && platformAdminIds.has(targetUserId)) {
        setDmError('Süper admin başka kanala taşınamaz');
        return;
      }
      try {
        if (isSelf) {
          const ch = channels.find((c) => c.id === targetChannelId);
          if (!ch || ch.type !== 'VOICE') return;
          if (ch.locked && ch.hasPassword && !canManageChannels && !isPlatformAdmin) {
            setVoicePasswordDraft('');
            setVoicePasswordPrompt({ channel: ch });
            return;
          }
          await joinVoiceChannel(ch);
        } else {
          await client.moveVoiceUser(targetUserId, targetChannelId);
          await reload();
        }
        setMoveTargetUser(null);
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Taşıma başarısız');
      }
    },
    [
      canMoveMembers,
      canManageChannels,
      isPlatformAdmin,
      platformAdminIds,
      user?.id,
      channels,
      client,
      reload,
      joinVoiceChannel,
    ],
  );

  const categories = useMemo(
    () =>
      buildSidebarCategories(channels, channelId, selectChannel, {
        voiceMembersByChannel,
        selfUserId: user?.id,
        selfVoiceChannelId: voice.voiceChannelId,
        platformAdminIds,
        guildCategories,
        onAddChannel: canManageChannels
          ? (categoryId) => {
              setChannelName('');
              setChannelType('TEXT');
              setChannelLocked(false);
              setChannelPasswordDraft('');
              setChannelDeniedIds([]);
              setChannelOverwrites([]);
              setShowOverwriteEditor(false);
              setChannelModal({ mode: 'create', categoryId });
            }
          : undefined,
        onEditChannel: canManageChannels ? openEditChannel : undefined,
        onDeleteChannel: canManageChannels
          ? (ch) => setConfirm({ kind: 'channel', channel: ch })
          : undefined,
        onEditCategory: canManageChannels
          ? (cat) => {
              setCategoryName(cat.name);
              setCategoryModal({ mode: 'edit', category: cat });
            }
          : undefined,
        onDeleteCategory: canManageChannels
          ? (cat) => setConfirm({ kind: 'category', category: cat })
          : undefined,
        onDropMember: (userId, channel) => {
          if (channel.type !== 'VOICE') return;
          const isSelf = Boolean(user?.id && userId === user.id);
          if (!isSelf && !canMoveMembers) return;
          void moveToVoiceChannel(userId, channel.id);
        },
        canDragVoiceMembers: canMoveMembers,
        canDragSelf: Boolean(voice.voiceChannelId),
        collapsedCategoryIds: collapsedCats,
        onToggleCategory: toggleCategoryCollapse,
        onReorderChannels: canManageChannels
          ? (categoryId, orderedIds) => {
              void (async () => {
                try {
                  await client.reorderGuildChannels(
                    guildId,
                    orderedIds.map((id, position) => ({
                      id,
                      position,
                      categoryId,
                    })),
                  );
                  await reload();
                } catch (err) {
                  setDmError(err instanceof Error ? err.message : 'Sıralama kaydedilemedi');
                }
              })();
            }
          : undefined,
      }),
    [
      channels,
      channelId,
      selectChannel,
      voiceMembersByChannel,
      openEditChannel,
      user?.id,
      voice.voiceChannelId,
      platformAdminIds,
      guildCategories,
      canManageChannels,
      canMoveMembers,
      moveToVoiceChannel,
      collapsedCats,
      toggleCategoryCollapse,
      client,
      guildId,
      reload,
    ],
  );

  const denyFromVoice = useCallback(
    async (targetUserId: string) => {
      const chId = voice.voiceChannelId ?? (isVoiceView ? channelId : null);
      if (!chId || !canManageChannels) return;
      try {
        const updated = await client.denyVoiceUser(chId, targetUserId);
        setChannelDeniedIds(updated.deniedUserIds ?? []);
        await reload();
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Oda engeli eklenemedi');
      }
    },
    [voice.voiceChannelId, isVoiceView, channelId, canManageChannels, client, reload],
  );

  /** Ses odası engelini kaldır — API hemen uygulanır */
  const allowFromVoice = useCallback(
    async (targetUserId: string, channelOverrideId?: string) => {
      const chId =
        channelOverrideId ??
        voice.voiceChannelId ??
        (isVoiceView ? channelId : null) ??
        channelModal?.channel?.id ??
        null;
      if (!chId || !canManageChannels) return;
      try {
        const updated = await client.allowVoiceUser(chId, targetUserId);
        setChannelDeniedIds(updated.deniedUserIds ?? []);
        await reload();
        setDmError(null);
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Engel kaldırılamadı');
      }
    },
    [
      voice.voiceChannelId,
      isVoiceView,
      channelId,
      channelModal?.channel?.id,
      canManageChannels,
      client,
      reload,
    ],
  );

  const blockMember = useCallback(
    async (targetUserId: string) => {
      if (!user || targetUserId === user.id) return;
      try {
        await client.blockUser(targetUserId);
        setDmError(null);
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Engellenemedi');
      }
    },
    [user, client],
  );

  const sendFriendRequest = useCallback(
    async (targetUserId: string) => {
      if (!user || targetUserId === user.id) return;
      try {
        await client.sendFriendRequest(targetUserId);
        setDmError(null);
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'İstek gönderilemedi');
      }
    },
    [user, client],
  );

  const toggleMemberRole = useCallback(
    async (targetUserId: string, roleId: string, hasRole: boolean) => {
      try {
        if (hasRole) await client.removeMemberRole(guildId, targetUserId, roleId);
        else await client.addMemberRole(guildId, targetUserId, roleId);
        const members = await client.getGuildMembers(guildId);
        setGuildMembers(
          members.map((m) => {
            if (m.id !== user?.id) return m;
            const live =
              user.status === 'IDLE' || user.status === 'DND' || user.status === 'ONLINE'
                ? user.status
                : 'ONLINE';
            return { ...m, status: live, customStatus: user.customStatus ?? m.customStatus };
          }),
        );
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Rol güncellenemedi');
      }
    },
    [client, guildId, user],
  );

  const kickMember = useCallback(
    async (targetUserId: string) => {
      if (!canKickMembers) return;
      try {
        await client.kickGuildMember(guildId, targetUserId);
        setGuildMembers((prev) => prev.filter((m) => m.id !== targetUserId));
        await reload();
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Üye atılamadı');
      }
    },
    [canKickMembers, client, guildId, reload],
  );

  const banMember = useCallback(
    async (targetUserId: string) => {
      if (!canBanMembers) return;
      try {
        await client.banGuildMember(guildId, targetUserId);
        setGuildMembers((prev) => prev.filter((m) => m.id !== targetUserId));
        await reload();
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Yasaklama başarısız');
      }
    },
    [canBanMembers, client, guildId, reload],
  );

  const timeoutMember = useCallback(
    async (targetUserId: string, minutes: number) => {
      if (!canModerateMembers) return;
      try {
        await client.timeoutGuildMember(guildId, targetUserId, minutes);
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Timeout uygulanamadı');
      }
    },
    [canModerateMembers, client, guildId],
  );

  /** Aktif ses kanalındaki oda engelleri (yetkiliye görünür) */
  const activeVoiceDeniedIds = useMemo(() => {
    const chId = voice.voiceChannelId ?? (isVoiceView ? channelId : null);
    if (!chId) return channelDeniedIds;
    const ch = channels.find((c) => c.id === chId);
    return ch?.deniedUserIds ?? channelDeniedIds;
  }, [voice.voiceChannelId, isVoiceView, channelId, channels, channelDeniedIds]);

  const memberGroups: MemberListGroup[] = useMemo(() => {
    const voiceList = inVoice
      ? voice.participants.map((p) => {
          const isSelf = p.id === user?.id;
          const isBot = Boolean((p as { isBot?: boolean }).isBot);
          const actions: MemberListAction[] = [];
          if (!isSelf) {
            actions.push({
              id: 'dm',
              label: 'Mesaj gönder',
              onSelect: () => void openMemberDm(p.id, isBot),
            });
          }
          if (!isSelf && !isBot) {
            actions.push({
              id: 'block',
              label: 'Kullanıcıyı engelle',
              danger: true,
              onSelect: () => void blockMember(p.id),
            });
          }
          if (!isSelf && canManageChannels) {
            if (activeVoiceDeniedIds.includes(p.id)) {
              actions.push({
                id: 'allow-voice',
                label: 'Ses odası engelini kaldır',
                onSelect: () => void allowFromVoice(p.id),
              });
            } else {
              actions.push({
                id: 'deny-voice',
                label: 'Ses odasından engelle',
                danger: true,
                onSelect: () => void denyFromVoice(p.id),
              });
            }
          }
          return {
            id: p.id,
            displayName: p.displayName,
            username: guildMembers.find((g) => g.id === p.id)?.username,
            avatarUrl:
              p.avatarUrl ||
              guildMembers.find((g) => g.id === p.id)?.avatarUrl ||
              (p.id === user?.id ? user.avatarUrl : null),
            bannerUrl: guildMembers.find((g) => g.id === p.id)?.bannerUrl,
            bannerColor: guildMembers.find((g) => g.id === p.id)?.bannerColor,
            bio: guildMembers.find((g) => g.id === p.id)?.bio,
            socialLinks: guildMembers.find((g) => g.id === p.id)?.socialLinks,
            roles: guildMembers.find((g) => g.id === p.id)?.roles,
            status: liveMemberStatus(
              p.id,
              guildMembers.find((g) => g.id === p.id)?.status,
            ),
            customStatus: guildMembers.find((g) => g.id === p.id)?.customStatus,
            isBot,
            subtitle: presenceLabelTr(
              liveMemberStatus(p.id, guildMembers.find((g) => g.id === p.id)?.status),
              guildMembers.find((g) => g.id === p.id)?.customStatus,
            ),
            onClick: () => void openMemberDm(p.id, isBot),
            contextActions: actions.length ? actions : undefined,
          };
        })
      : [];

    const deniedOnlyMembers: MemberListGroup['members'] =
      canManageChannels && activeVoiceDeniedIds.length > 0
        ? activeVoiceDeniedIds
            .filter((id) => !voice.participants.some((p) => p.id === id))
            .map((id) => {
              const m = guildMembers.find((g) => g.id === id);
              return {
                id,
                displayName: m?.displayName ?? `Kullanıcı ${id.slice(0, 6)}`,
                avatarUrl: m?.avatarUrl,
                status: (m?.status ?? 'OFFLINE') as MemberListGroup['members'][number]['status'],
                customStatus: m?.customStatus,
                isBot: Boolean(m?.isBot),
                subtitle: m
                  ? presenceLabelTr(m.status, m.customStatus)
                  : 'Odaya girişi engelli',
                contextActions: [
                  {
                    id: 'allow-voice',
                    label: 'Ses odası engelini kaldır',
                    onSelect: () => void allowFromVoice(id),
                  },
                  ...(m && !m.isBot
                    ? [
                        {
                          id: 'dm',
                          label: 'Mesaj gönder',
                          onSelect: () => void openMemberDm(id, Boolean(m.isBot)),
                        } satisfies MemberListAction,
                      ]
                    : []),
                ],
              };
            })
        : [];

    return [
      {
        id: 'voice',
        label: inVoice ? 'Seste' : 'Çevrimiçi',
        members:
          voiceList.length > 0
            ? voiceList
            : user
              ? [
                  {
                    id: user.id,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    status: liveMemberStatus(user.id, user.status),
                    customStatus: user.customStatus,
                    isBot: Boolean(user.isBot),
                    subtitle: presenceLabelTr(
                      liveMemberStatus(user.id, user.status),
                      user.customStatus,
                    ),
                    onClick: () => void openMemberDm(user.id, Boolean(user.isBot)),
                  },
                ]
              : [],
      },
      ...(deniedOnlyMembers.length > 0
        ? [
            {
              id: 'voice-denied',
              label: 'Odadan engellenenler',
              members: deniedOnlyMembers,
            } satisfies MemberListGroup,
          ]
        : []),
      {
        id: 'members',
        label: 'Üyeler',
        members: guildMembers.map((m) => {
          const isSelf = m.id === user?.id;
          const isBot = Boolean(m.isBot);
          const denied = activeVoiceDeniedIds.includes(m.id);
          const topRole = (m.roles ?? [])
            .filter((r) => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)[0];
          const actions: MemberListAction[] = [];
          actions.push({
            id: 'profile',
            label: 'Profili gör',
            onSelect: () => setProfileUser(m),
          });
          if (!isSelf) {
            actions.push({
              id: 'dm',
              label: 'Mesaj gönder',
              onSelect: () => void openMemberDm(m.id, isBot),
            });
          }
          if (!isSelf && !isBot) {
            actions.push({
              id: 'friend',
              label: 'Arkadaşlık isteği gönder',
              onSelect: () => void sendFriendRequest(m.id),
            });
            actions.push({
              id: 'block',
              label: 'Kullanıcıyı engelle',
              danger: true,
              onSelect: () => void blockMember(m.id),
            });
          }
          if (!isSelf && canManageChannels && (inVoice || isVoiceView)) {
            if (denied) {
              actions.push({
                id: 'allow-voice',
                label: 'Ses odası engelini kaldır',
                onSelect: () => void allowFromVoice(m.id),
              });
            } else {
              actions.push({
                id: 'deny-voice',
                label: 'Ses odasından engelle',
                danger: true,
                onSelect: () => void denyFromVoice(m.id),
              });
            }
          }
          if (!isSelf && canMoveMembers) {
            actions.push({
              id: 'move-voice',
              label: 'Ses kanalına taşı…',
              onSelect: () =>
                setMoveTargetUser({ id: m.id, displayName: m.displayName }),
            });
            if (inVoice || isVoiceView) {
              actions.push({
                id: 'disconnect-voice',
                label: 'Odadan ayır',
                onSelect: () => void disconnectFromVoice(m.id),
              });
            }
          }
          if (!isSelf && !isBot && canKickMembers) {
            actions.push({
              id: 'kick',
              label: 'Sunucudan at',
              danger: true,
              onSelect: () => void kickMember(m.id),
            });
          }
          if (!isSelf && !isBot && canBanMembers) {
            actions.push({
              id: 'ban',
              label: 'Yasakla',
              danger: true,
              onSelect: () => void banMember(m.id),
            });
          }
          if (!isSelf && !isBot && canModerateMembers) {
            actions.push({
              id: 'timeout',
              label: 'Timeout (10 dk)',
              danger: true,
              onSelect: () => void timeoutMember(m.id, 10),
            });
          }
          if (canManageRoles && !isBot) {
            for (const role of guildRoles.filter((r) => r.name !== '@everyone')) {
              const has = (m.roles ?? []).some((r) => r.id === role.id);
              actions.push({
                id: `role-${role.id}`,
                label: has ? `Rol kaldır: ${role.name}` : `Rol ver: ${role.name}`,
                onSelect: () => void toggleMemberRole(m.id, role.id, has),
              });
            }
          }
          return {
            id: m.id,
            displayName: m.displayName,
            username: m.username,
            avatarUrl: m.avatarUrl,
            bannerUrl: m.bannerUrl,
            bannerColor: m.bannerColor,
            bio: m.bio,
            socialLinks: m.socialLinks,
            roles: m.roles,
            status: liveMemberStatus(m.id, m.status),
            customStatus: m.customStatus,
            isBot,
            roleColor: prefs.accessibility.roleColors ? topRole?.color : undefined,
            badges: (m.roles ?? [])
              .filter((r) => r.badgeKey && r.badgeKey !== 'none')
              .map((r) => ({
                id: r.id,
                badgeKey: r.badgeKey,
                color: r.color,
                label: r.name,
              })),
            subtitle: denied
              ? `Engelli · ${presenceLabelTr(liveMemberStatus(m.id, m.status), m.customStatus)}`
              : presenceLabelTr(liveMemberStatus(m.id, m.status), m.customStatus),
            onClick: () => setProfileUser(m),
            draggable:
              (isSelf && inVoice) ||
              (canMoveMembers && !isSelf && !m.isPlatformAdmin && !isBot),
            contextActions: actions.length ? actions : undefined,
          };
        }),
      },
    ];
  }, [
    user,
    inVoice,
    isVoiceView,
    voice.participants,
    guildMembers,
    guildRoles,
    openMemberDm,
    canManageChannels,
    canManageRoles,
    denyFromVoice,
    allowFromVoice,
    blockMember,
    sendFriendRequest,
    toggleMemberRole,
    disconnectFromVoice,
    canMoveMembers,
    canKickMembers,
    canBanMembers,
    canModerateMembers,
    kickMember,
    banMember,
    timeoutMember,
    activeVoiceDeniedIds,
    liveMemberStatus,
    prefs.accessibility.roleColors,
  ]);

  const messagesWithRoleColors = useMemo(() => {
    let list = messages;
    if (prefs.accessibility.roleColors) {
      list = list.map((msg) => {
        const m = guildMembers.find((g) => g.id === msg.author.id);
        const topRole = (m?.roles ?? [])
          .filter((r) => r.name !== '@everyone')
          .sort((a, b) => b.position - a.position)[0];
        if (!topRole?.color) return msg;
        return {
          ...msg,
          author: { ...msg.author, bannerColor: topRole.color },
        };
      });
    }
    if (prefs.messaging.filterExplicit) {
      list = list.map((msg) => {
        const content = filterMessageContent(msg.content, true);
        const embeds = msg.embeds?.filter((e) => {
          const probe = [e.url, e.imageUrl, e.title, e.description]
            .filter(Boolean)
            .join(' ');
          return !isSuspiciousUrl(probe);
        });
        if (content === msg.content && embeds?.length === (msg.embeds?.length ?? 0)) {
          return msg;
        }
        return { ...msg, content, embeds };
      });
    }
    if (isForumView) {
      list = sortForumMessages(list, forumSort, forumTag);
    }
    return list;
  }, [
    messages,
    guildMembers,
    prefs.accessibility.roleColors,
    prefs.messaging.filterExplicit,
    isForumView,
    forumSort,
    forumTag,
  ]);

  const forumTags = useMemo(() => {
    if (!isForumView) return [] as string[];
    const set = new Set<string>();
    for (const m of messages) {
      for (const t of extractForumTags(m.content)) set.add(t);
    }
    return [...set].sort();
  }, [isForumView, messages]);

  const saveChannel = useCallback(async () => {
    if (!channelModal) return;
    setBusy(true);
    try {
      if (channelModal.mode === 'create') {
        const created = await client.createChannel(guildId, {
          name: channelName,
          type: channelType,
          categoryId: channelModal.categoryId,
        });
        if (channelType === 'VOICE' && (channelLocked || channelPasswordDraft.trim())) {
          await client.updateChannel(created.id, {
            locked: channelLocked || Boolean(channelPasswordDraft.trim()),
            password: channelPasswordDraft.trim() || null,
          });
        }
        await reload();
        setChannelModal(null);
        router.push(`/channels/${guildId}/${created.id}`);
      } else if (channelModal.channel) {
        const patch: {
          name: string;
          locked?: boolean;
          password?: string | null;
          deniedUserIds?: string[];
          permissionOverwrites?: Array<{
            id: string;
            type: 'role' | 'member';
            allow: string[];
            deny: string[];
          }> | null;
        } = { name: channelName };
        if (channelModal.channel.type === 'VOICE') {
          patch.locked = channelLocked;
          if (channelPasswordDraft.trim()) {
            patch.password = channelPasswordDraft.trim();
          } else if (!channelLocked) {
            patch.password = null;
          }
          patch.deniedUserIds = channelDeniedIds;
        }
        patch.permissionOverwrites =
          channelOverwrites.length > 0 ? channelOverwrites : null;
        await client.updateChannel(channelModal.channel.id, patch);
        await reload();
        setChannelModal(null);
      }
    } finally {
      setBusy(false);
    }
  }, [
    channelModal,
    channelName,
    channelType,
    channelLocked,
    channelPasswordDraft,
    channelDeniedIds,
    channelOverwrites,
    client,
    guildId,
    reload,
    router,
  ]);

  const saveServerSettings = useCallback(async () => {
    if (!serverNameDraft.trim()) {
      setServerError('Sunucu adı boş olamaz');
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      const updated = await client.updateGuild(guildId, { name: serverNameDraft.trim() });
      patchGuild(updated);
      setServerSettingsOpen(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Sunucu kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }, [client, guildId, patchGuild, serverNameDraft]);

  const uploadGuildImage = useCallback(
    async (file: File, kind: 'icon' | 'banner') => {
      setBusy(true);
      setServerError(null);
      try {
        const uploaded = await client.uploadFile(file, kind === 'icon' ? 'avatars' : 'banners');
        const updated = await client.updateGuild(
          guildId,
          kind === 'icon' ? { iconUrl: uploaded.url } : { bannerUrl: uploaded.url },
        );
        patchGuild(updated);
      } catch (err) {
        setServerError(err instanceof Error ? err.message : 'Görsel yüklenemedi');
      } finally {
        setBusy(false);
      }
    },
    [client, guildId, patchGuild],
  );
  const createInvite = useCallback(async () => {
    const invite = await client.createInvite(guildId);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setInviteUrl(`${origin}/invite/${invite.code}`);
    setServerMenuOpen(false);
  }, [client, guildId]);

  const runConfirm = useCallback(async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === 'channel') {
        const deletingId = confirm.channel.id;
        await client.deleteChannel(deletingId);
        setConfirm(null);
        setChannelModal(null);
        await reload();
        if (deletingId === channelId) {
          const fallback = channels.find((c) => c.id !== deletingId && c.type !== 'CATEGORY');
          if (fallback) router.push(`/channels/${guildId}/${fallback.id}`);
          else router.push('/channels/@me');
        }
      } else if (confirm.kind === 'category') {
        await client.deleteGuildCategory(guildId, confirm.category.id);
        setConfirm(null);
        setCategoryModal(null);
        await reload();
      } else {
        await client.deleteGuild(guildId);
        setConfirm(null);
        router.push('/channels/@me');
      }
    } finally {
      setBusy(false);
    }
  }, [confirm, client, reload, channelId, channels, guildId, router]);

  const saveCategory = useCallback(async () => {
    if (!categoryModal || !categoryName.trim()) return;
    setBusy(true);
    try {
      if (categoryModal.mode === 'create') {
        await client.createGuildCategory(guildId, categoryName.trim());
      } else if (categoryModal.category) {
        await client.updateGuildCategory(guildId, categoryModal.category.id, {
          name: categoryName.trim(),
        });
      }
      setCategoryModal(null);
      await reload();
    } catch (err) {
      setDmError(err instanceof Error ? err.message : 'Kategori kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }, [categoryModal, categoryName, client, guildId, reload]);

  const searchGifs = useCallback(
    async (query: string) => {
      const list = await client.searchGifs(query);
      return list.map((g) => ({
        id: g.id,
        url: g.url,
        previewUrl: g.previewUrl,
        label: g.label,
      }));
    },
    [client],
  );

  const loadFeaturedGifs = useCallback(async () => {
    const list = await client.featuredGifs();
    return list.map((g) => ({
      id: g.id,
      url: g.url,
      previewUrl: g.previewUrl,
      label: g.label,
    }));
  }, [client]);

  const chatInputProps = {
    channelName: channel?.name,
    placeholder: isForumView
      ? `Yeni gönderi · #${channel?.name ?? 'forum'}`
      : undefined,
    onSend: (text: string, meta?: { replyToId?: string }) => {
      void sendMessage(
        text,
        undefined,
        meta?.replyToId ? { replyToId: meta.replyToId } : undefined,
      ).then((msg) => {
        setReplyTo(null);
        if (isForumView && msg && !meta?.replyToId) {
          setThreadRoot(msg);
          setThreadDraft('');
        }
      });
    },
    onAttachFiles: (files: FileList | File[]) => void sendWithAttachments(files),
    onSendMedia: (payload: Parameters<typeof sendMedia>[0]) => void sendMedia(payload),
    onPollClick: () => setPollOpen(true),
    onHeadingClick: isForumView
      ? undefined
      : () => {
          setHeadingText('');
          setHeadingOpen(true);
        },
    onTyping: notifyTyping,
    replyTo: isForumView ? null : replyTo,
    onCancelReply: () => setReplyTo(null),
    searchGifs,
    loadFeaturedGifs,
    mentionUsers,
    mentionChannels,
    botSlashCommands: botSlashCommands.length ? botSlashCommands : undefined,
    spellCheck: prefs.messaging.spellcheck,
    uploadStickerFile: async (file: File) => {
      const uploaded = await client.uploadFile(file, 'stickers');
      return { url: uploaded.url, contentType: uploaded.contentType };
    },
  };

  if (loading && !guild) {
    return (
      <AppShell guilds={guilds} activeGuildId={guildId} onGuildsChanged={() => void reload()}>
        <div className="flex flex-1 items-center justify-center text-outline">Sunucu yükleniyor…</div>
      </AppShell>
    );
  }

  const serverName = guild?.name ?? 'Sunucu';

  const renderSidebar = () => (
    <ChannelSidebar
      serverName={serverName}
      serverBannerUrl={guild?.bannerUrl}
      categories={categories}
      onServerHeaderClick={() => setServerMenuOpen(true)}
      className="h-full w-full md:w-72"
      userPanel={{
        displayName: user?.displayName ?? 'Kullanıcı',
        username: user?.username ?? null,
        avatarUrl: user?.avatarUrl,
        status: liveMemberStatus(user?.id ?? '', user?.status) || user?.status || 'ONLINE',
        customStatus: user?.customStatus ?? null,
        muted: inVoice ? voice.muted : undefined,
        deafened: inVoice ? voice.deafened : undefined,
        noiseCancellation: voice.noiseCancellation,
        noiseNote: voice.noiseNote,
        voiceConnected: inVoice,
        voiceChannelName: voiceChannel?.name ?? null,
        voiceLatencyMs: inVoice ? voice.latencyMs : null,
        micVolume: voice.audioSettings.micVolume,
        outputVolume: voice.audioSettings.outputVolume,
        inputDeviceId: voice.audioSettings.inputDeviceId,
        outputDeviceId: voice.audioSettings.outputDeviceId,
        inputDevices: voice.audioInputDevices.map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Mikrofon (${d.deviceId.slice(0, 8)})`,
        })),
        outputDevices: voice.audioOutputDevices.map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Hoparlör (${d.deviceId.slice(0, 8)})`,
        })),
        onSettingsClick: () => router.push('/settings'),
        onVoiceSettingsClick: () => router.push('/settings/voice'),
        onProfileClick: () => router.push('/settings/profile'),
        onStatusChange: (status, customStatus) => {
          const share =
            prefs.privacy.shareActivityStatus !== false &&
            prefs.activity.displayActivity !== false;
          void client
            .updatePresence({
              status,
              customStatus: share ? customStatus : null,
            })
            .then((me) => setUser(me))
            .catch(() => undefined);
        },
        onMicClick: inVoice ? () => void voice.toggleMute() : undefined,
        onHeadphonesClick: inVoice ? () => void voice.toggleDeafen() : undefined,
        onNoiseClick: inVoice ? () => void voice.toggleNoiseCancellation() : undefined,
        onMicVolumeChange: (v) => voice.setMicVolume(v),
        onOutputVolumeChange: (v) => voice.setOutputVolume(v),
        onInputDeviceChange: (id) => void voice.setInputDevice(id),
        onOutputDeviceChange: (id) => void voice.setOutputDevice(id),
        onAudioMenuOpen: () => {
          void voice.refreshAudioDevices(true);
        },
        onVoiceReturnClick: () => {
          if (voice.voiceChannelId) {
            router.push(`/channels/${guildId}/${voice.voiceChannelId}`);
          }
        },
        onVoiceDisconnectClick: () => {
          leaveVoiceAndMaybeNavigate();
        },
      }}
      headerExtra={
        <div className="px-space-sm pb-space-sm">
          <button
            type="button"
            className="w-full h-8 rounded-lg bg-surface-container-high text-on-surface font-label-sm hover:bg-surface-bright transition-colors"
            onClick={() => void createInvite()}
          >
            İnsanları davet et
          </button>
        </div>
      }
    />
  );

  return (
    <AppShell
      guilds={guilds}
      activeGuildId={guildId}
      onGuildsChanged={() => void reload()}
    >
      {dmError && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[90] max-w-md w-[min(100%-2rem,28rem)] rounded-xl bg-error/15 border border-error/40 text-error px-space-md py-space-sm shadow-float flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
          <p className="font-body-sm flex-1 min-w-0">{dmError}</p>
          <button
            type="button"
            className="font-label-sm underline shrink-0"
            onClick={() => setDmError(null)}
          >
            Kapat
          </button>
        </div>
      )}
      {voice.error && !voice.voiceChannelId && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[90] max-w-md w-[min(100%-2rem,28rem)] rounded-xl bg-error/15 border border-error/40 text-error px-space-md py-space-sm shadow-float flex items-start gap-space-sm">
          <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">mic_off</span>
          <p className="font-body-sm flex-1 min-w-0">{voice.error}</p>
        </div>
      )}
      {voice.voiceOnOtherTab && voice.voiceChannelId && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[90] max-w-lg w-[min(100%-2rem,32rem)] rounded-xl bg-surface-container-high border border-primary-container/40 text-on-surface px-space-md py-space-sm shadow-float flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-primary-container text-[20px]">tab</span>
          <p className="font-body-sm flex-1 min-w-0">
            Ses başka sekmede açık. Bu sekmeye almak için tıkla.
          </p>
          <button
            type="button"
            className="h-8 px-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm shrink-0"
            onClick={() => {
              if (voice.voiceChannelId && voice.voiceGuildId) {
                void voice.join(voice.voiceChannelId, voice.voiceGuildId);
              }
            }}
          >
            Bu sekmeye al
          </button>
        </div>
      )}
      <div className="hidden md:flex h-full min-h-0 shrink-0 overflow-visible relative z-20">
        {renderSidebar()}
      </div>

      <MobileDrawer
        open={channelsOpen}
        onClose={() => setChannelsOpen(false)}
        side="left"
        title={serverName}
      >
        {renderSidebar()}
      </MobileDrawer>

      <button
        type="button"
        className="md:hidden fixed bottom-20 left-3 z-40 h-11 w-11 rounded-full bg-surface-container-high text-on-surface shadow-float flex items-center justify-center border border-surface-container-highest"
        aria-label="Kanallar"
        onClick={() => setChannelsOpen(true)}
        style={
          channelsOpen ||
          showingVoiceStage ||
          (!isVoiceView && !channelPending && !channelMissing)
            ? { display: 'none' }
            : undefined
        }
      >
        <span className="material-symbols-outlined text-[22px]">tag</span>
      </button>

      {showingVoiceStage ? (
        <div className="flex flex-1 min-w-0 min-h-0 flex-col">
          <VoiceStage
          channelName={channel?.name ?? voiceChannel?.name ?? 'Ses'}
          participants={voice.participants.map((p) => {
            const m = guildMembers.find((g) => g.id === p.id);
            return {
              ...p,
              avatarUrl:
                p.avatarUrl || m?.avatarUrl || (p.id === user?.id ? user.avatarUrl : null),
              displayName: p.displayName || m?.displayName || p.id,
              isBot: Boolean(p.isBot || m?.isBot),
            };
          })}
          localParticipantId={user?.id}
          participantVolumes={voice.participantVolumes}
          onParticipantVolumeChange={voice.setParticipantVolume}
          screenShareVolumes={voice.screenShareVolumes}
          onScreenShareVolumeChange={voice.setScreenShareVolume}
          onCameraVideoRef={voice.setCameraVideoElement}
          rtcConnected={voice.connected}
          muted={voice.muted}
          deafened={voice.deafened}
          cameraEnabled={voice.cameraEnabled}
          screenSharing={voice.screenSharing}
          screenShare={
            voice.activeScreenShare
              ? {
                  identity: voice.activeScreenShare.identity,
                  displayName: voice.activeScreenShare.displayName,
                  isLocal: voice.activeScreenShare.isLocal,
                  videoRef: voice.setScreenVideoElement,
                }
              : null
          }
          screenShares={voice.availableScreenShares}
          onFocusScreenShare={voice.focusScreenShare}
          participantsDrawerOpen={participantsOpen}
          chatDrawerOpen={chatOpen}
          chatPanelWidth={voiceChatWidth}
          onChatPanelWidthChange={setVoiceChatWidth}
          participantsPanelWidth={voicePartsWidth}
          onParticipantsPanelWidthChange={setVoicePartsWidth}
          onToggleMute={() => void voice.toggleMute()}
          onToggleDeafen={() => void voice.toggleDeafen()}
          onToggleCamera={() => void voice.toggleCamera()}
          onToggleScreenShare={() => void voice.toggleScreenShare()}
          onLeave={() => {
            leaveVoiceAndMaybeNavigate();
          }}
          onToggleParticipants={() => {
            setParticipantsOpen((v) => {
              const next = !v;
              if (next && typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
                setChatOpen(false);
              }
              return next;
            });
          }}
          onToggleChat={() => {
            setChatOpen((v) => {
              const next = !v;
              if (next) {
                if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
                  setParticipantsOpen(false);
                }
                if (!voiceChatChannelId) {
                  const text = channels.find((c) => c.type === 'TEXT');
                  if (text) setVoiceChatChannelId(text.id);
                }
              }
              return next;
            });
          }}
          stageOverlay={
            voice.error || voice.audioPlaybackBlocked ? (
              <div className="flex flex-col gap-space-sm px-space-md items-center">
                {voice.error && <p className="text-error font-body-sm">{voice.error}</p>}
                {voice.audioPlaybackBlocked && (
                  <button
                    type="button"
                    onClick={() => void voice.unlockAudio()}
                    className="h-10 px-space-md rounded-xl bg-primary-container text-on-primary-container font-label-md"
                  >
                    Ses için dokun
                  </button>
                )}
              </div>
            ) : undefined
          }
          participantsPanel={
            participantsOpen ? (
              <div className="flex flex-col h-full min-h-0">
                <div className="px-space-md py-space-sm border-b border-surface-container-high flex items-center justify-between gap-2">
                  <p className="font-label-sm text-outline uppercase tracking-wide">Sestekiler</p>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
                    aria-label="Üyeleri kapat"
                    onClick={() => setParticipantsOpen(false)}
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
                <ul className="flex-1 overflow-y-auto p-space-sm space-y-space-sm">
                  {voice.participants.map((p) => {
                    const isLocal = p.id === user?.id;
                    const m = guildMembers.find((g) => g.id === p.id);
                    const avatarUrl =
                      p.avatarUrl || m?.avatarUrl || (isLocal ? user?.avatarUrl : null);
                    const vol = voice.participantVolumes[p.id] ?? 100;
                    return (
                      <li
                        key={p.id}
                        className="w-full rounded-lg bg-surface-container px-space-sm py-space-sm box-border"
                      >
                        <div className="flex items-center gap-space-sm min-w-0">
                          <Avatar
                            displayName={p.displayName}
                            imageUrl={avatarUrl}
                            size="sm"
                            statusRing={false}
                          />
                          <span className="font-body-sm text-on-surface truncate flex-1">
                            {p.displayName}
                            {isLocal ? ' (sen)' : ''}
                          </span>
                          {p.muted && (
                            <span className="material-symbols-outlined text-[16px] text-error">
                              mic_off
                            </span>
                          )}
                          {p.camera && (
                            <span className="material-symbols-outlined text-[16px] text-primary-container">
                              videocam
                            </span>
                          )}
                        </div>
                        {!isLocal && (
                          <label className="mt-space-xs flex items-center gap-space-xs">
                            <span className="material-symbols-outlined text-[16px] text-outline">
                              {vol === 0 ? 'volume_off' : 'volume_up'}
                            </span>
                            <VolumeSlider
                              value={vol}
                              aria-label={`${p.displayName} ses`}
                              onChange={(v) => voice.setParticipantVolume(p.id, v)}
                            />
                            <span className="font-label-sm text-outline w-7 text-right tabular-nums">
                              {vol}
                            </span>
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-surface-container-high min-h-0 max-h-[45%] overflow-y-auto">
                  <MemberList groups={memberGroups} className="w-full" />
                </div>
              </div>
            ) : undefined
          }
          chatPanel={
            chatOpen ? (
              <VoiceSideChat
                guildId={guildId}
                textChannels={channels.filter((c) => c.type === 'TEXT')}
                channelId={voiceChatChannelId}
                onChannelIdChange={setVoiceChatChannelId}
                onClose={() => setChatOpen(false)}
                onOpenDm={() => {
                  setParticipantsOpen(true);
                  setDmError('Üye listesinden birine tıklayarak DM aç');
                }}
              />
            ) : undefined
          }
        />
          <MusicPlayerBar
            guildId={guildId}
            textChannelId={channels.find((c) => c.type === 'TEXT')?.id ?? null}
            variant="stage"
          />
        </div>
      ) : channelPending ? (
        <div className="flex flex-1 min-w-0 min-h-0 items-center justify-center bg-surface text-outline font-body-md">
          Kanal yükleniyor…
        </div>
      ) : channelsEmpty || navError ? (
        <div className="flex flex-1 min-w-0 min-h-0 flex-col items-center justify-center gap-3 bg-surface px-4 text-center">
          <p className="font-body-md text-outline">
            {navError ?? 'Bu sunucuda görüntülenebilir kanal yok.'}
          </p>
          <button
            type="button"
            className="h-9 px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-md"
            onClick={() => void reload()}
          >
            Yeniden dene
          </button>
        </div>
      ) : channelMissing ? (
        <div className="flex flex-1 min-w-0 min-h-0 items-center justify-center bg-surface text-outline font-body-md">
          Kanal bulunamadı.
        </div>
      ) : isVoiceView ? (
        <div className="flex flex-1 min-w-0 min-h-0 flex-col bg-surface items-center justify-center gap-space-md p-space-lg">
          <span className="material-symbols-outlined text-[48px] text-primary-container">volume_up</span>
          <p className="font-headline-md text-on-surface">{channel?.name}</p>
          <p className="font-body-sm text-on-surface-variant text-center max-w-sm">
            {isConnecting
              ? 'Bu ses kanalına bağlanıyorsun…'
              : inVoice && voice.voiceChannelId !== channelId
                ? `Şu an #${voiceChannel?.name ?? 'başka bir kanal'}da bağlısın. Bu kanala geçmek için katıl.`
                : 'Bu ses kanalına katılmak için aşağıdaki butonu kullan.'}
          </p>
          {voice.error && <p className="text-error font-body-sm">{voice.error}</p>}
          {dmError && <p className="text-error font-body-sm">{dmError}</p>}
          {!isConnecting && channel && (
            <button
              type="button"
              className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary-container"
              onClick={() => selectChannel(channel)}
            >
              {inVoice && voice.voiceChannelId !== channelId ? 'Bu kanala geç' : 'Kanala katıl'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-1 min-w-0 min-h-0 flex-col bg-surface">
          <header className="h-12 px-space-md flex items-center gap-space-sm border-b border-surface-container-high shadow-bar shrink-0">
            <button
              type="button"
              className="md:hidden h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface"
              aria-label="Kanallar"
              onClick={() => setChannelsOpen(true)}
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <span
              className={
                isForumView
                  ? 'material-symbols-outlined text-[20px] text-outline'
                  : 'text-outline font-headline-md'
              }
            >
              {isForumView ? 'forum' : '#'}
            </span>
            <span className="font-headline-md text-headline-md text-on-surface truncate">
              {channel?.name ?? 'kanal'}
            </span>
            {isForumView && (
              <span className="font-label-sm text-outline shrink-0">Forum</span>
            )}
            {isForumView && (
              <div className="flex items-center gap-1 ml-2 min-w-0">
                <SearchableSelect
                  value={forumSort}
                  onChange={(v) => setForumSort(v as ForumSort)}
                  aria-label="Sıralama"
                  className="!min-w-[8rem] sm:!min-w-[9rem]"
                  options={[
                    { value: 'newest', label: 'En yeni' },
                    { value: 'oldest', label: 'En eski' },
                    { value: 'pinned', label: 'Sabitlenenler önce' },
                  ]}
                />
                <SearchableSelect
                  value={forumTag ?? ''}
                  onChange={(v) => setForumTag(v || null)}
                  aria-label="Etiket"
                  className="!min-w-[7rem] sm:!min-w-[9rem] max-w-[10rem]"
                  options={[
                    { value: '', label: 'Tüm etiketler' },
                    ...forumTags.map((tag) => ({ value: tag, label: `#${tag}` })),
                  ]}
                />
              </div>
            )}
            {prefs.developer.developerMode && (
              <>
                <button
                  type="button"
                  title="Kanal ID kopyala"
                  className="h-8 px-2 rounded-lg text-outline hover:bg-surface-container font-label-sm"
                  onClick={() => void navigator.clipboard.writeText(channelId)}
                >
                  #ID
                </button>
                <button
                  type="button"
                  title="Sunucu ID kopyala"
                  className="h-8 px-2 rounded-lg text-outline hover:bg-surface-container font-label-sm"
                  onClick={() => void navigator.clipboard.writeText(guildId)}
                >
                  G-ID
                </button>
              </>
            )}
            {prefs.billing.nitroPlan !== 'none' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-container/30 text-primary-container font-label-sm">
                NITRO
              </span>
            )}
            <button
              type="button"
              className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface"
              aria-label="Mesajlarda ara (Ctrl+F)"
              onClick={() => openMessageSearch()}
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface"
              aria-label="Sabitlenen mesajlar"
              onClick={() => setPinsOpen((v) => !v)}
            >
              <span className="material-symbols-outlined text-[18px]">push_pin</span>
            </button>
            {channel && canManageChannels && (
              <button
                type="button"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface"
                aria-label="Kanalı düzenle"
                onClick={() => openEditChannel(channel)}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            )}
            <button
              type="button"
              className="lg:hidden h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface shrink-0"
              aria-label="Üyeler"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMembersOpen(true);
              }}
            >
              <span className="material-symbols-outlined text-[18px] leading-none">group</span>
            </button>
          </header>
          {latestPin && !isVoiceView && (
            <PinnedMessageBar
              message={latestPin}
              pinCount={pinCount}
              onJump={() => {
                router.replace(
                  `/channels/${guildId}/${channelId}?messageId=${latestPin.id}`,
                  { scroll: false },
                );
              }}
              onViewAll={() => setPinsOpen(true)}
            />
          )}
          {chatError && (
            <p className="px-space-md py-space-sm text-error font-body-sm">{chatError}</p>
          )}
          {chatLoading && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-outline font-body-md">
              Mesajlar yükleniyor…
            </div>
          ) : (
            <MessageList
              scrollKey={channelId}
              messages={messagesWithRoleColors}
              mentionNames={mentionNames}
              channelNames={channelNames}
              censorLinkPreviews={Boolean(user?.censorLinkPreviews)}
              hideEmbeds={!prefs.messaging.autoEmbed}
              messageGrouping={
                prefs.accessibility.messageGrouping &&
                prefs.appearance.messageDensity !== 'compact'
              }
              dense={prefs.appearance.messageDensity === 'compact'}
              hour24={prefs.language.hour24}
              locale={prefs.language.locale === 'en' ? 'en-US' : 'tr-TR'}
              messageActions={{
                currentUserId: user?.id,
                canManageMessages,
                guildId,
                developerMode: prefs.developer.developerMode,
                onAuthorClick: (author) => {
                  const m = guildMembers.find((g) => g.id === author.id);
                  setProfileUser(m ?? author);
                },
                onEdit: (m) => setEditMessageTarget({ id: m.id, content: m.content }),
                onDelete: (m) =>
                  setDeleteMessageTarget({
                    id: m.id,
                    preview: m.content.slice(0, 80) || 'Bu mesaj',
                  }),
                onReact: (m, emoji) => void reactToMessage(m.id, emoji),
                onHide: (m, permanent) => void hideMessage(m.id, permanent),
                onUnhide: (m) => void unhideMessage(m.id),
                onReport: (m) => {
                  void hideMessage(m.id, true);
                },
                onBlockAuthor: (m) => {
                  void client.blockUser(m.author.id).then(() => hideMessage(m.id, true));
                },
                onVotePoll: (m, optionId) => void votePoll(m.id, optionId),
                onReply: isForumView
                  ? (m) => {
                      setThreadRoot(m);
                      setThreadDraft('');
                    }
                  : (m) =>
                      setReplyTo({
                        id: m.id,
                        authorName: m.author.displayName,
                        contentPreview: m.content.slice(0, 120) || 'Ek / medya',
                      }),
                onForward: (m) => {
                  setForwardTarget({ id: m.id, contentPreview: m.content.slice(0, 80) });
                  setForwardChannelId(
                    channels.find(
                      (c) =>
                        (c.type === 'TEXT' || c.type === 'FORUM') && c.id !== channelId,
                    )?.id ?? '',
                  );
                  setForwardNote('');
                },
                onPin: (m, pin) => {
                  void pinMessage(m.id, pin).then(() => void refreshPins());
                },
                onBookmark: (m, bookmark) => void bookmarkMessage(m.id, bookmark),
                onOpenThread: (m) => {
                  setThreadRoot(m);
                  setThreadDraft('');
                },
                onCreateHeading: isForumView
                  ? undefined
                  : (m) => {
                      setHeadingText(m.content.slice(0, 120));
                      setHeadingOpen(true);
                    },
                onMarkUnread: (m) => {
                  void client
                    .markChannelRead(channelId, { messageId: m.id, unreadFrom: true })
                    .then(() => void reload())
                    .catch(() => undefined);
                },
                onJumpToMessage: (id) => {
                  router.replace(`/channels/${guildId}/${channelId}?messageId=${id}`, {
                    scroll: false,
                  });
                },
              }}
              hasMore={hasMore}
              loadingOlder={loadingOlder}
              pendingNewCount={pendingNewCount}
              highlightMessageId={aroundMessageId}
              onLoadOlder={() => void loadOlder()}
              onJumpToPresent={() => void jumpToPresent()}
              onLiveEdgeChange={setAtLiveEdge}
              onHighlightSettled={() => {
                if (!aroundMessageId) return;
                router.replace(`/channels/${guildId}/${channelId}`, { scroll: false });
              }}
              emptyState={
                <DracoEmpty
                  mood="idle"
                  size={120}
                  title={isForumView ? 'Henüz gönderi yok' : 'Henüz mesaj yok'}
                  description={
                    isForumView
                      ? 'İlk konuyu aç — yanıtlar thread panelinde toplanır.'
                      : 'Draco dinliyor — sohbeti sen başlat!'
                  }
                />
              }
            />
          )}
          <div className="relative shrink-0 z-[100]">
            {typingUsers.length > 0 && (
              <p className="px-space-md pb-1 font-label-sm text-outline truncate">
                {typingUsers.length === 1
                  ? `${typingUsers[0]!.username} yazıyor…`
                  : typingUsers.length === 2
                    ? `${typingUsers[0]!.username} ve ${typingUsers[1]!.username} yazıyor…`
                    : `${typingUsers.length} kişi yazıyor…`}
              </p>
            )}
            {inVoice && (
              <MusicPlayerBar
                guildId={guildId}
                textChannelId={
                  isVoiceView
                    ? channels.find((c) => c.type === 'TEXT' || c.type === 'FORUM')?.id
                    : channelId
                }
                variant="chat"
              />
            )}
            <ChatInput key={channelId} {...chatInputProps} />
          </div>
        </div>
      )}

      {!showingVoiceStage && (
        <>
          <MemberList groups={memberGroups} className="hidden lg:flex lg:w-64" />
          <MobileDrawer
            open={membersOpen}
            onClose={() => setMembersOpen(false)}
            side="right"
            title="Üyeler"
            until="lg"
          >
            <MemberList groups={memberGroups} className="w-full h-full" />
          </MobileDrawer>
        </>
      )}

      <Modal
        open={serverMenuOpen}
        title={serverName}
        onClose={() => setServerMenuOpen(false)}
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="h-10 px-space-sm rounded-lg text-left hover:bg-surface-container-high font-body-sm flex items-center gap-space-sm"
            onClick={() => void createInvite()}
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            İnsanları davet et
          </button>
          {canManageChannels && (
            <button
              type="button"
              className="h-10 px-space-sm rounded-lg text-left hover:bg-surface-container-high font-body-sm flex items-center gap-space-sm"
              onClick={() => {
                setServerMenuOpen(false);
                setCategoryName('');
                setCategoryModal({ mode: 'create' });
              }}
            >
              <span className="material-symbols-outlined text-[18px]">create_new_folder</span>
              Kategori oluştur
            </button>
          )}
          <button
            type="button"
            className="h-10 px-space-sm rounded-lg text-left hover:bg-surface-container-high font-body-sm flex items-center gap-space-sm"
            onClick={() => {
              setServerMenuOpen(false);
              router.push(`/guilds/${guildId}/settings`);
            }}
            disabled={!canManageGuild}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Sunucu ayarları
          </button>
          {canManageGuild && (
            <button
              type="button"
              className="h-10 px-space-sm rounded-lg text-left hover:bg-error/10 text-error font-body-sm flex items-center gap-space-sm"
              onClick={() => {
                setServerMenuOpen(false);
                setConfirm({ kind: 'guild' });
              }}
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Sunucuyu sil
            </button>
          )}
        </div>
      </Modal>

      <Modal
        open={serverSettingsOpen}
        title="Sunucu ayarları"
        onClose={() => setServerSettingsOpen(false)}
        footer={
          <button
            type="button"
            disabled={busy || !serverNameDraft.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => void saveServerSettings()}
          >
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        }
      >
        <div className="space-y-space-md">
          {serverError && (
            <p className="font-body-sm text-error bg-error/10 rounded-lg px-space-sm py-space-xs">
              {serverError}
            </p>
          )}

          <div className="relative h-28 rounded-xl overflow-hidden bg-surface-container-highest border border-surface-container-high">
            {guild?.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={guild.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-outline font-label-sm">
                Kapak görseli yok
              </div>
            )}
            <label className="absolute right-2 bottom-2 h-8 px-space-sm rounded-lg bg-black/60 text-white font-label-sm flex items-center gap-1 cursor-pointer hover:bg-black/75">
              <span className="material-symbols-outlined text-[16px]">image</span>
              Kapak
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void uploadGuildImage(file, 'banner');
                }}
              />
            </label>
            {guild?.bannerUrl && (
              <button
                type="button"
                disabled={busy}
                className="absolute left-2 bottom-2 h-8 px-space-sm rounded-lg bg-black/60 text-white font-label-sm hover:bg-black/75 disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setServerError(null);
                    try {
                      const updated = await client.updateGuild(guildId, { bannerUrl: null });
                      patchGuild(updated);
                    } catch (err) {
                      setServerError(err instanceof Error ? err.message : 'Kaldırılamadı');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Kaldır
              </button>
            )}
          </div>

          <div className="flex items-center gap-space-md">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-surface-container-highest border border-surface-container-high shrink-0">
              {guild?.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={guild.iconUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-headline-md text-on-surface">
                  {serverName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-space-xs min-w-0">
              <p className="font-label-sm text-on-surface-variant">Sunucu ikonu</p>
              <label className="h-8 px-space-sm rounded-lg bg-surface-container-high font-label-sm inline-flex items-center gap-1 cursor-pointer hover:bg-surface-bright w-fit">
                <span className="material-symbols-outlined text-[16px]">upload</span>
                Yükle
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void uploadGuildImage(file, 'icon');
                  }}
                />
              </label>
            </div>
          </div>

          <label className="flex flex-col gap-space-xs">
            <span className="font-label-sm text-on-surface-variant">Sunucu adı</span>
            <input
              value={serverNameDraft}
              onChange={(e) => setServerNameDraft(e.target.value)}
              className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveServerSettings();
              }}
            />
          </label>
        </div>
      </Modal>
      <Modal
        open={Boolean(channelModal)}
        title={channelModal?.mode === 'edit' ? 'Kanalı düzenle' : 'Kanal oluştur'}
        onClose={() => setChannelModal(null)}
        footer={
          <div className="flex w-full items-center justify-between gap-space-sm">
            {channelModal?.mode === 'edit' && channelModal.channel ? (
              <button
                type="button"
                className="px-space-md py-space-sm rounded-lg text-error hover:bg-error/10 font-body-sm"
                onClick={() => {
                  if (channelModal.channel) {
                    setConfirm({ kind: 'channel', channel: channelModal.channel });
                  }
                }}
              >
                Kanalı sil
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={busy || !channelName.trim()}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
              onClick={() => void saveChannel()}
            >
              Kaydet
            </button>
          </div>
        }
      >
        <label className="flex flex-col gap-space-xs mb-space-md">
          <span className="font-label-sm text-on-surface-variant">Kanal adı</span>
          <input
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          />
        </label>
        {channelModal?.mode === 'create' && (
          <div className="flex gap-space-sm">
            <button
              type="button"
              className={`flex-1 h-10 rounded-lg ${channelType === 'TEXT' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high'}`}
              onClick={() => setChannelType('TEXT')}
            >
              Metin
            </button>
            <button
              type="button"
              className={`flex-1 h-10 rounded-lg ${channelType === 'FORUM' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high'}`}
              onClick={() => setChannelType('FORUM')}
            >
              Forum
            </button>
            <button
              type="button"
              className={`flex-1 h-10 rounded-lg ${channelType === 'VOICE' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high'}`}
              onClick={() => setChannelType('VOICE')}
            >
              Ses
            </button>
          </div>
        )}
        {channelModal?.mode === 'edit' && canManageChannels && (
          <div className="mt-space-md space-y-space-sm">
            <button
              type="button"
              className="font-label-sm text-primary-container hover:underline"
              onClick={() => setShowOverwriteEditor((v) => !v)}
            >
              {showOverwriteEditor ? 'İzinleri gizle' : 'Kanal izinleri (rol)'}
            </button>
            {showOverwriteEditor && (
              <div className="space-y-space-sm max-h-64 overflow-y-auto rounded-lg bg-surface-container-highest p-space-sm">
                <p className="font-body-sm text-outline">
                  İzin: Varsayılan / İzin ver / Reddet
                </p>
                {(
                  [
                    { id: 'VIEW_CHANNEL', label: 'Kanalı gör' },
                    { id: 'SEND_MESSAGES', label: 'Mesaj gönder' },
                    { id: 'CONNECT', label: 'Sese bağlan' },
                    { id: 'SPEAK', label: 'Konuş' },
                  ] as const
                ).map((perm) => (
                  <div key={perm.id} className="space-y-space-xs">
                    <p className="font-label-sm text-on-surface-variant">{perm.label}</p>
                    {guildRoles.map((role) => {
                      const ow = channelOverwrites.find(
                        (o) => o.type === 'role' && o.id === role.id,
                      );
                      const mode = ow?.deny.includes(perm.id)
                        ? 'deny'
                        : ow?.allow.includes(perm.id)
                          ? 'allow'
                          : 'inherit';
                      return (
                        <div
                          key={`${perm.id}-${role.id}`}
                          className="flex items-center justify-between gap-space-sm"
                        >
                          <span
                            className="font-body-sm truncate"
                            style={role.color ? { color: role.color } : undefined}
                          >
                            {role.name}
                          </span>
                          <SearchableSelect
                            className="!min-w-[7.5rem]"
                            value={mode}
                            onChange={(v) =>
                              setOverwritePerm(
                                role.id,
                                'role',
                                perm.id,
                                v as 'inherit' | 'allow' | 'deny',
                              )
                            }
                            options={[
                              { value: 'inherit', label: 'Varsayılan' },
                              { value: 'allow', label: 'İzin ver' },
                              { value: 'deny', label: 'Reddet' },
                            ]}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {(channelType === 'VOICE' || channelModal?.channel?.type === 'VOICE') && (
          <div className="mt-space-md space-y-space-sm">
            <label className="flex items-center gap-space-sm font-body-sm text-on-surface">
              <input
                type="checkbox"
                checked={channelLocked}
                onChange={(e) => setChannelLocked(e.target.checked)}
              />
              Odayı kilitle (şifre ile giriş)
            </label>
            <label className="flex flex-col gap-space-xs">
              <span className="font-label-sm text-on-surface-variant">
                Oda şifresi {channelModal?.mode === 'edit' ? '(boş bırak = değiştirme)' : ''}
              </span>
              <input
                type="password"
                value={channelPasswordDraft}
                onChange={(e) => setChannelPasswordDraft(e.target.value)}
                placeholder={channelLocked ? 'Şifre' : 'İsteğe bağlı'}
                className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
              />
            </label>
            {channelModal?.mode === 'edit' && channelDeniedIds.length > 0 && (
              <div className="space-y-space-xs">
                <p className="font-label-sm text-on-surface-variant">Engellenen kullanıcılar</p>
                {channelDeniedIds.map((id) => {
                  const m = guildMembers.find((g) => g.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-highest px-space-sm py-space-xs"
                    >
                      <span className="font-body-sm truncate">
                        {m?.displayName ?? id.slice(0, 8)}
                      </span>
                      <button
                        type="button"
                        className="font-label-sm text-primary-container hover:underline shrink-0"
                        onClick={() =>
                          void allowFromVoice(id, channelModal.channel?.id)
                        }
                      >
                        İzin ver
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {channelModal?.mode === 'edit' &&
              channelModal.channel?.type === 'VOICE' &&
              channelDeniedIds.length === 0 && (
                <p className="font-body-sm text-outline">
                  Bu odadan engellenmiş kullanıcı yok.
                </p>
              )}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(categoryModal)}
        title={categoryModal?.mode === 'edit' ? 'Kategoriyi düzenle' : 'Kategori oluştur'}
        onClose={() => setCategoryModal(null)}
        footer={
          <div className="flex w-full items-center justify-between gap-space-sm">
            {categoryModal?.mode === 'edit' && categoryModal.category ? (
              <button
                type="button"
                className="px-space-md py-space-sm rounded-lg text-error hover:bg-error/10 font-body-sm"
                onClick={() => {
                  if (categoryModal.category) {
                    setConfirm({ kind: 'category', category: categoryModal.category });
                  }
                }}
              >
                Kategoriyi sil
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              disabled={busy || !categoryName.trim()}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
              onClick={() => void saveCategory()}
            >
              Kaydet
            </button>
          </div>
        }
      >
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-sm text-on-surface-variant">Kategori adı</span>
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && categoryName.trim()) void saveCategory();
            }}
          />
        </label>
      </Modal>

      <Modal
        open={Boolean(voicePasswordPrompt)}
        title="Kilitli ses odası"
        onClose={() => setVoicePasswordPrompt(null)}
        footer={
          <button
            type="button"
            disabled={!voicePasswordDraft.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              if (!voicePasswordPrompt) return;
              const ch = voicePasswordPrompt.channel;
              const pwd = voicePasswordDraft.trim();
              setVoicePasswordPrompt(null);
              joinVoiceChannel(ch, pwd);
            }}
          >
            Katıl
          </button>
        }
      >
        <p className="font-body-sm text-on-surface-variant mb-space-sm">
          <strong>{voicePasswordPrompt?.channel.name}</strong> kilitli. Şifreyi gir.
        </p>
        <input
          type="password"
          value={voicePasswordDraft}
          onChange={(e) => setVoicePasswordDraft(e.target.value)}
          className="w-full h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && voicePasswordPrompt && voicePasswordDraft.trim()) {
              const ch = voicePasswordPrompt.channel;
              const pwd = voicePasswordDraft.trim();
              setVoicePasswordPrompt(null);
              joinVoiceChannel(ch, pwd);
            }
          }}
          autoFocus
        />
      </Modal>

      <Modal open={Boolean(inviteUrl)} title="Davet linki" onClose={() => setInviteUrl(null)}>
        <p className="font-body-sm text-on-surface-variant mb-space-sm">
          Bu linki paylaşarak sunucuya davet edebilirsin.
        </p>
        <input
          readOnly
          value={inviteUrl ?? ''}
          className="w-full h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          onFocus={(e) => e.target.select()}
        />
        <button
          type="button"
          className="mt-space-md w-full h-10 rounded-lg bg-primary-container text-on-primary-container"
          onClick={() => {
            if (inviteUrl) void navigator.clipboard.writeText(inviteUrl);
          }}
        >
          Kopyala
        </button>
      </Modal>

      <Modal
        open={Boolean(moveTargetUser)}
        title={
          moveTargetUser
            ? `${moveTargetUser.displayName} — ses kanalına taşı`
            : 'Ses kanalına taşı'
        }
        onClose={() => setMoveTargetUser(null)}
      >
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {channels
            .filter((c) => c.type === 'VOICE')
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className="h-10 px-space-sm rounded-lg text-left hover:bg-surface-container-high font-body-sm flex items-center gap-space-sm"
                onClick={() => {
                  if (!moveTargetUser) return;
                  void moveToVoiceChannel(moveTargetUser.id, c.id);
                }}
              >
                <span className="material-symbols-outlined text-[18px] text-outline">
                  volume_up
                </span>
                {c.name}
              </button>
            ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        danger
        busy={busy}
        title={
          confirm?.kind === 'guild'
            ? 'Sunucuyu sil?'
            : confirm?.kind === 'category'
              ? `"${confirm.category.name}" kategorisini sil?`
              : confirm?.kind === 'channel'
                ? `#${confirm.channel.name} kanalını sil?`
                : 'Sil?'
        }
        description={
          confirm?.kind === 'guild' ? (
            <p>
              <strong>{serverName}</strong> kalıcı olarak silinecek. Tüm kanallar ve mesajlar
              kaybolur. Bu işlem geri alınamaz.
            </p>
          ) : confirm?.kind === 'category' ? (
            <p>
              Kategori silinecek; içindeki kanallar kategorisiz kalır (silinmez).
            </p>
          ) : (
            <p>
              Bu kanal ve içindeki tüm mesajlar kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
          )
        }
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirm()}
      />

      <ConfirmDialog
        open={Boolean(deleteMessageTarget)}
        danger
        busy={msgBusy}
        title="Mesajı sil?"
        description={
          <p>
            <span className="text-on-surface-variant">
              {deleteMessageTarget?.preview}
            </span>{' '}
            kalıcı olarak silinecek.
          </p>
        }
        confirmLabel="Sil"
        cancelLabel="Vazgeç"
        onCancel={() => setDeleteMessageTarget(null)}
        onConfirm={() => {
          if (!deleteMessageTarget) return;
          setMsgBusy(true);
          void deleteMessage(deleteMessageTarget.id)
            .then(() => setDeleteMessageTarget(null))
            .finally(() => setMsgBusy(false));
        }}
      />

      <Modal
        open={Boolean(editMessageTarget)}
        title="Mesajı düzenle"
        onClose={() => setEditMessageTarget(null)}
        footer={
          <button
            type="button"
            disabled={msgBusy || !editMessageTarget?.content.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              if (!editMessageTarget) return;
              setMsgBusy(true);
              void editMessage(editMessageTarget.id, editMessageTarget.content)
                .then(() => setEditMessageTarget(null))
                .finally(() => setMsgBusy(false));
            }}
          >
            Kaydet
          </button>
        }
      >
        <textarea
          value={editMessageTarget?.content ?? ''}
          onChange={(e) =>
            setEditMessageTarget((prev) =>
              prev ? { ...prev, content: e.target.value } : prev,
            )
          }
          rows={4}
          className="w-full rounded-lg bg-surface-container-highest px-space-sm py-space-sm outline-none font-body-md"
        />
      </Modal>

      <Modal
        open={pollOpen}
        title="Anket oluştur"
        onClose={() => setPollOpen(false)}
        footer={
          <button
            type="button"
            disabled={msgBusy || !pollQuestion.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              const options = pollOptions
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
              if (options.length < 2) return;
              setMsgBusy(true);
              void sendPoll(pollQuestion.trim(), options)
                .then(() => {
                  setPollOpen(false);
                  setPollQuestion('');
                  setPollOptions('Evet\nHayır');
                })
                .finally(() => setMsgBusy(false));
            }}
          >
            Gönder
          </button>
        }
      >
        <label className="flex flex-col gap-space-xs mb-space-md">
          <span className="font-label-sm text-on-surface-variant">Soru</span>
          <input
            value={pollQuestion}
            onChange={(e) => setPollQuestion(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          />
        </label>
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-sm text-on-surface-variant">Seçenekler (her satır bir seçenek)</span>
          <textarea
            value={pollOptions}
            onChange={(e) => setPollOptions(e.target.value)}
            rows={4}
            className="w-full rounded-lg bg-surface-container-highest px-space-sm py-space-sm outline-none"
          />
        </label>
      </Modal>

      <Modal
        open={headingOpen}
        title="Bölüm başlığı"
        onClose={() => setHeadingOpen(false)}
        footer={
          <button
            type="button"
            disabled={msgBusy || !headingText.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              const text = headingText.trim();
              if (!text) return;
              setMsgBusy(true);
              void sendMessage(text, undefined, { type: 'heading' })
                .then(() => {
                  setHeadingOpen(false);
                  setHeadingText('');
                })
                .finally(() => setMsgBusy(false));
            }}
          >
            Oluştur
          </button>
        }
      >
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-sm text-on-surface-variant">Başlık</span>
          <input
            value={headingText}
            onChange={(e) => setHeadingText(e.target.value.slice(0, 120))}
            maxLength={120}
            placeholder="Örn. Duyurular"
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
            autoFocus
          />
        </label>
      </Modal>

      <Modal
        open={Boolean(forwardTarget)}
        title="Mesajı ilet"
        onClose={() => setForwardTarget(null)}
        footer={
          <button
            type="button"
            disabled={msgBusy || !forwardTarget || !forwardChannelId}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              if (!forwardTarget || !forwardChannelId) return;
              setMsgBusy(true);
              void client
                .forwardMessage(
                  forwardTarget.id,
                  forwardChannelId,
                  forwardNote.trim() || undefined,
                )
                .then(() => {
                  setForwardTarget(null);
                  router.push(`/channels/${guildId}/${forwardChannelId}`);
                })
                .catch(() => undefined)
                .finally(() => setMsgBusy(false));
            }}
          >
            İlet
          </button>
        }
      >
        {forwardTarget && (
          <p className="font-body-sm text-outline mb-space-md truncate">
            {forwardTarget.contentPreview || 'Ek / medya'}
          </p>
        )}
        <label className="flex flex-col gap-space-xs mb-space-md">
          <span className="font-label-sm text-on-surface-variant">Hedef kanal</span>
          <SearchableSelect
            fullWidth
            value={forwardChannelId}
            onChange={setForwardChannelId}
            placeholder="Kanal seç…"
            options={[
              { value: '', label: 'Kanal seç…' },
              ...channels
                .filter((c) => c.type === 'TEXT' || c.type === 'FORUM')
                .map((c) => ({
                  value: c.id,
                  label: `${c.type === 'FORUM' ? 'forum: ' : '#'}${c.name}`,
                })),
            ]}
          />
        </label>
        <label className="flex flex-col gap-space-xs">
          <span className="font-label-sm text-on-surface-variant">Not (isteğe bağlı)</span>
          <textarea
            value={forwardNote}
            onChange={(e) => setForwardNote(e.target.value)}
            rows={2}
            className="w-full rounded-lg bg-surface-container-highest px-space-sm py-space-sm outline-none"
          />
        </label>
      </Modal>

      <Modal
        open={pinsOpen}
        title="Sabitlenen mesajlar"
        onClose={() => setPinsOpen(false)}
      >
        {pins.length === 0 ? (
          <p className="font-body-sm text-outline">Bu kanalda sabitlenmiş mesaj yok.</p>
        ) : (
          <ul className="flex flex-col gap-space-sm max-h-80 overflow-y-auto">
            {pins.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full text-left rounded-lg px-space-sm py-space-sm hover:bg-surface-container-high"
                  onClick={() => {
                    setPinsOpen(false);
                    router.replace(
                      `/channels/${guildId}/${channelId}?messageId=${p.id}`,
                      { scroll: false },
                    );
                  }}
                >
                  <span className="block font-label-sm text-primary-container truncate">
                    {p.authorName}
                  </span>
                  <span className="block font-body-sm text-on-surface truncate">
                    {p.content || 'Ek / medya'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={Boolean(threadRoot)}
        title={
          threadRoot
            ? `${isForumView ? 'Gönderi' : 'Thread'} · ${threadRoot.author.displayName}`
            : isForumView
              ? 'Gönderi'
              : 'Thread'
        }
        onClose={() => {
          setThreadRoot(null);
          setThreadDraft('');
        }}
      >
        {threadRoot && (
          <p className="font-body-sm text-outline mb-space-sm line-clamp-2">
            {threadRoot.content.trim() || 'Ek / medya'}
          </p>
        )}
        {threadBusy && <p className="font-body-sm text-outline mb-space-sm">Yükleniyor…</p>}
        <div
          ref={threadScrollRef}
          className="max-h-72 overflow-y-auto space-y-space-sm mb-space-md"
        >
          {threadMessages.map((m, idx) => {
            const isRoot = idx === 0 && m.id === threadRoot?.id;
            return (
              <div
                key={m.id}
                className={
                  isRoot
                    ? 'rounded-lg border border-primary-container/40 bg-primary-container/10 px-space-sm py-space-xs'
                    : 'rounded-lg bg-surface-container-highest px-space-sm py-space-xs'
                }
              >
                <p className="font-label-sm text-primary-container truncate flex items-center gap-1">
                  {m.author.displayName}
                  {isRoot && (
                    <span className="text-outline font-normal">· başlangıç</span>
                  )}
                </p>
                <p className="font-body-sm text-on-surface whitespace-pre-wrap break-words">
                  {m.content || 'Ek / medya'}
                </p>
              </div>
            );
          })}
          {!threadBusy && threadMessages.length === 0 && (
            <p className="font-body-sm text-outline">Henüz yanıt yok — ilk yanıtı sen yaz.</p>
          )}
        </div>
        <div className="flex gap-space-sm">
          <input
            value={threadDraft}
            onChange={(e) => setThreadDraft(e.target.value)}
            placeholder="Thread’e yanıt yaz…"
            disabled={threadSending}
            className="flex-1 h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && threadDraft.trim() && threadRoot && !threadSending) {
                e.preventDefault();
                setThreadSending(true);
                void sendMessage(threadDraft.trim(), undefined, {
                  threadRootId: threadRoot.id,
                })
                  .then(() => setThreadDraft(''))
                  .finally(() => setThreadSending(false));
              }
            }}
          />
          <button
            type="button"
            disabled={!threadDraft.trim() || !threadRoot || threadSending}
            className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
            onClick={() => {
              if (!threadRoot || !threadDraft.trim() || threadSending) return;
              setThreadSending(true);
              void sendMessage(threadDraft.trim(), undefined, {
                threadRootId: threadRoot.id,
              })
                .then(() => setThreadDraft(''))
                .finally(() => setThreadSending(false));
            }}
          >
            Gönder
          </button>
        </div>
      </Modal>

      <UserProfileCard
        open={Boolean(profileUser)}
        onClose={() => setProfileUser(null)}
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
                {
                  id: 'dm',
                  label: 'Mesaj gönder',
                  onClick: () => void openMemberDm(profileUser.id, Boolean(profileUser.isBot)),
                },
                ...(profileUser.isBot
                  ? []
                  : [
                      {
                        id: 'friend',
                        label: 'Arkadaşlık isteği gönder',
                        onClick: () => void sendFriendRequest(profileUser.id),
                      },
                      {
                        id: 'block',
                        label: 'Engelle',
                        danger: true,
                        onClick: () => void blockMember(profileUser.id),
                      },
                    ]),
              ]
            : []
        }
      />
    </AppShell>
  );
}
