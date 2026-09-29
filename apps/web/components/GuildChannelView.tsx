'use client';

import type { ChannelSummary, PublicUser, VoiceMemberSummary, VoiceStatePayload } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import {
  ChannelSidebar,
  ChatInput,
  ConfirmDialog,
  MemberList,
  MessageList,
  Modal,
  VoiceStage,
  type MemberListGroup,
} from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell, rememberChannel } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { DracoEmpty } from '@/components/Draco';
import { openMessageSearch } from '@/components/GlobalSearch';
import { MobileDrawer } from '@/components/MobileDrawer';
import { buildSidebarCategories } from '@/lib/channels';
import { useChatChannel } from '@/hooks/useChatChannel';
import { useGuildNav } from '@/hooks/useGuildNav';
import { useVoiceSession } from '@/components/VoiceSessionProvider';
import { useUserPreferences } from '@/lib/user-preferences';
import { MusicPlayerBar } from '@/components/MusicPlayerBar';

interface GuildChannelViewProps {
  guildId: string;
  channelId: string;
  aroundMessageId?: string | null;
}

type ConfirmState =
  | { kind: 'channel'; channel: ChannelSummary }
  | { kind: 'guild' }
  | null;

export function GuildChannelView({
  guildId,
  channelId,
  aroundMessageId,
}: GuildChannelViewProps) {
  const router = useRouter();
  const { user, client, setUser } = useAuth();
  const { guilds, guild, channels, loading, reload, patchGuild } = useGuildNav(guildId);
  const channel = channels.find((c) => c.id === channelId);
  const isVoiceView = channel?.type === 'VOICE';
  const channelPending = !channel && (loading || channels.length === 0);
  const channelMissing = !channel && !loading && channels.length > 0;

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
    error: chatError,
  } = useChatChannel(isVoiceView ? undefined : channelId, aroundMessageId);
  const voice = useVoiceSession();
  const { prefs } = useUserPreferences();

  const voiceChannel = channels.find((c) => c.id === voice.voiceChannelId);
  const inVoice = Boolean(voice.voiceChannelId);
  const showingVoiceStage = isVoiceView && voice.voiceChannelId === channelId;
  const isConnecting =
    isVoiceView && voice.voiceChannelId === channelId && !voice.connected && !voice.error;

  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceMembersByChannel, setVoiceMembersByChannel] = useState<
    Record<string, VoiceMemberSummary[]>
  >({});
  const [channelModal, setChannelModal] = useState<{
    mode: 'create' | 'edit';
    categoryId: string | null;
    channel?: ChannelSummary;
  } | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<'TEXT' | 'VOICE'>('TEXT');
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const [serverNameDraft, setServerNameDraft] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [canManageChannels, setCanManageChannels] = useState(false);
  const [canManageMessages, setCanManageMessages] = useState(false);
  const [canManageGuild, setCanManageGuild] = useState(false);
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
  const [pins, setPins] = useState<
    Array<{ id: string; content: string; authorName: string }>
  >([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [busy, setBusy] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [guildMembers, setGuildMembers] = useState<PublicUser[]>([]);
  const [voicePasswordPrompt, setVoicePasswordPrompt] = useState<{
    channel: ChannelSummary;
  } | null>(null);
  const [voicePasswordDraft, setVoicePasswordDraft] = useState('');
  const [channelLocked, setChannelLocked] = useState(false);
  const [channelPasswordDraft, setChannelPasswordDraft] = useState('');
  const [channelDeniedIds, setChannelDeniedIds] = useState<string[]>([]);
  const [dmError, setDmError] = useState<string | null>(null);

  const mentionNames = useMemo(() => {
    if (!user) return [] as string[];
    const names = [user.username, user.displayName].filter(Boolean);
    return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  }, [user]);

  const channelNames = useMemo(
    () => channels.filter((c) => c.type === 'TEXT').map((c) => c.name),
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
      .then(setGuildMembers)
      .catch(() => setGuildMembers([]));
  }, [client, guildId, user]);

  useEffect(() => {
    if (!guildId || !user) return;
    void client
      .getGuildPermissions(guildId)
      .then((p) => {
        const set = new Set(p.permissions);
        setCanManageGuild(p.owner || set.has('MANAGE_GUILD') || set.has('ADMINISTRATOR'));
        setCanManageChannels(
          p.owner || set.has('MANAGE_CHANNELS') || set.has('ADMINISTRATOR'),
        );
        setCanManageMessages(
          p.owner || set.has('MANAGE_MESSAGES') || set.has('ADMINISTRATOR'),
        );
      })
      .catch(() => {
        setCanManageGuild(false);
        setCanManageChannels(false);
        setCanManageMessages(false);
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
  }, [channelId, client, isVoiceView]);

  useEffect(() => {
    if (!pinsOpen || !channelId) return;
    void client
      .listPinnedMessages(channelId)
      .then((list) =>
        setPins(
          list.map((m) => ({
            id: m.id,
            content: m.content.slice(0, 100),
            authorName: m.author.displayName,
          })),
        ),
      )
      .catch(() => setPins([]));
  }, [pinsOpen, channelId, client]);

  useEffect(() => {
    const map: Record<string, VoiceMemberSummary[]> = {};
    for (const ch of channels) {
      if (ch.type !== 'VOICE') continue;
      let members = ch.voiceMembers ?? [];
      // Sunucudan gelen hayalet self kaydını daha en başta ele
      if (user && voice.voiceChannelId !== ch.id) {
        members = members.filter((m) => m.id !== user.id);
      }
      if (members.length) map[ch.id] = members;
    }
    setVoiceMembersByChannel((prev) => {
      const next = { ...map };
      if (voice.voiceChannelId && prev[voice.voiceChannelId]) {
        next[voice.voiceChannelId] = prev[voice.voiceChannelId]!;
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

  // Otomatik yeniden bağlanma yok: yalnızca kullanıcı ses kanalına tıklayınca / katıla basınca join.
  // (Önceki effect leave sonrası sayfada kalınca tekrar join ediyordu.)

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
      [voice.voiceChannelId!]: voice.participants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl ?? null,
        muted: p.muted,
        deafened: false,
      })),
    }));
  }, [voice.voiceChannelId, voice.participants, user]);

  const leaveVoiceAndMaybeNavigate = useCallback(() => {
    const leftId = voice.leave();
    if (user && leftId) {
      setVoiceMembersByChannel((prev) => ({
        ...prev,
        [leftId]: (prev[leftId] ?? []).filter((m) => m.id !== user.id),
      }));
    }
    if (isVoiceView || (leftId && channelId === leftId)) {
      const text = channels.find((c) => c.type === 'TEXT');
      if (text) router.push(`/channels/${guildId}/${text.id}`);
    }
  }, [voice, user, isVoiceView, channelId, channels, guildId, router]);

  const openEditChannel = useCallback((ch: ChannelSummary) => {
    setChannelName(ch.name);
    setChannelType(ch.type === 'VOICE' ? 'VOICE' : 'TEXT');
    setChannelLocked(Boolean(ch.locked));
    setChannelPasswordDraft('');
    setChannelDeniedIds(ch.deniedUserIds ?? []);
    setChannelModal({ mode: 'edit', categoryId: ch.categoryId, channel: ch });
  }, []);

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
        router.push(`/channels/me/${ch.id}`);
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'DM açılamadı');
      }
    },
    [client, router],
  );

  const joinVoiceChannel = useCallback(
    (ch: ChannelSummary, password?: string) => {
      voice.join(ch.id, guildId, password ? { password } : undefined);
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

  const categories = useMemo(
    () =>
      buildSidebarCategories(channels, channelId, selectChannel, {
        voiceMembersByChannel,
        selfUserId: user?.id,
        selfVoiceChannelId: voice.voiceChannelId,
        onAddChannel: canManageChannels
          ? (categoryId) => {
              setChannelName('');
              setChannelType('TEXT');
              setChannelLocked(false);
              setChannelPasswordDraft('');
              setChannelDeniedIds([]);
              setChannelModal({ mode: 'create', categoryId });
            }
          : undefined,
        onEditChannel: canManageChannels ? openEditChannel : undefined,
        onDeleteChannel: canManageChannels
          ? (ch) => setConfirm({ kind: 'channel', channel: ch })
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
      canManageChannels,
    ],
  );

  const denyFromVoice = useCallback(
    async (targetUserId: string) => {
      const chId = voice.voiceChannelId ?? (isVoiceView ? channelId : null);
      if (!chId || !canManageChannels) return;
      try {
        await client.denyVoiceUser(chId, targetUserId);
        await reload();
      } catch (err) {
        setDmError(err instanceof Error ? err.message : 'Engellenemedi');
      }
    },
    [voice.voiceChannelId, isVoiceView, channelId, canManageChannels, client, reload],
  );

  const memberGroups: MemberListGroup[] = useMemo(() => {
    const voiceList = inVoice
      ? voice.participants.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          status: 'ONLINE' as const,
          isBot: Boolean((p as { isBot?: boolean }).isBot),
          subtitle:
            canManageChannels && p.id !== user?.id ? 'Tıkla: DM · Sağ tık: engelle' : undefined,
          onClick: () => void openMemberDm(p.id, Boolean((p as { isBot?: boolean }).isBot)),
          onContextMenu: canManageChannels
            ? () => {
                if (p.id === user?.id) return;
                void denyFromVoice(p.id);
              }
            : undefined,
        }))
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
                    status: user.status,
                    isBot: Boolean(user.isBot),
                    subtitle: 'Notlarım / DM',
                    onClick: () => void openMemberDm(user.id, Boolean(user.isBot)),
                  },
                ]
              : [],
      },
      {
        id: 'members',
        label: 'Üyeler',
        members: guildMembers.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
          status: m.status,
          isBot: Boolean(m.isBot),
          subtitle: m.id === user?.id ? 'Notlarım' : 'Mesaj gönder',
          onClick: () => void openMemberDm(m.id, Boolean(m.isBot)),
        })),
      },
    ];
  }, [
    user,
    inVoice,
    voice.participants,
    guildMembers,
    openMemberDm,
    canManageChannels,
    denyFromVoice,
  ]);

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
      } else {
        await client.deleteGuild(guildId);
        setConfirm(null);
        router.push('/channels/@me');
      }
    } finally {
      setBusy(false);
    }
  }, [confirm, client, reload, channelId, channels, guildId, router]);

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
    onSend: (text: string, meta?: { replyToId?: string }) => {
      void sendMessage(
        text,
        undefined,
        meta?.replyToId ? { replyToId: meta.replyToId } : undefined,
      ).then(() => setReplyTo(null));
    },
    onAttachFiles: (files: FileList | File[]) => void sendWithAttachments(files),
    onSendMedia: (payload: Parameters<typeof sendMedia>[0]) => void sendMedia(payload),
    onPollClick: () => setPollOpen(true),
    onHeadingClick: () => {
      setHeadingText('');
      setHeadingOpen(true);
    },
    replyTo,
    onCancelReply: () => setReplyTo(null),
    searchGifs,
    loadFeaturedGifs,
    mentionUsers,
    mentionChannels,
    spellCheck: prefs.messaging.spellcheck,
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
        status: user?.status ?? 'ONLINE',
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
          void client
            .updatePresence({ status, customStatus })
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
          void voice.refreshAudioDevices();
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
          !isVoiceView && !showingVoiceStage && !channelPending && !channelMissing
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
          participants={voice.participants}
          localParticipantId={user?.id}
          participantVolumes={voice.participantVolumes}
          onParticipantVolumeChange={voice.setParticipantVolume}
          onCameraVideoRef={voice.setCameraVideoElement}
          rtcConnected={voice.connected}
          muted={voice.muted}
          deafened={voice.deafened}
          cameraEnabled={voice.cameraEnabled}
          screenSharing={voice.screenSharing}
          screenShare={
            voice.activeScreenShare
              ? {
                  displayName: voice.activeScreenShare.displayName,
                  isLocal: voice.activeScreenShare.isLocal,
                  videoRef: voice.setScreenVideoElement,
                }
              : null
          }
          participantsDrawerOpen={participantsOpen}
          chatDrawerOpen={chatOpen}
          onToggleMute={() => void voice.toggleMute()}
          onToggleDeafen={() => void voice.toggleDeafen()}
          onToggleCamera={() => void voice.toggleCamera()}
          onToggleScreenShare={() => void voice.toggleScreenShare()}
          onLeave={() => {
            leaveVoiceAndMaybeNavigate();
          }}
          onToggleParticipants={() => setParticipantsOpen((v) => !v)}
          onToggleChat={() => setChatOpen((v) => !v)}
          stageOverlay={
            voice.error ? (
              <div className="flex flex-col gap-space-sm px-space-md">
                <p className="text-error font-body-sm">{voice.error}</p>
              </div>
            ) : undefined
          }
          participantsPanel={
            participantsOpen ? (
              <div className="flex flex-col h-full min-h-0">
                <div className="px-space-md py-space-sm border-b border-surface-container-high">
                  <p className="font-label-sm text-outline uppercase tracking-wide">Sestekiler</p>
                </div>
                <ul className="flex-1 overflow-y-auto p-space-sm space-y-space-sm">
                  {voice.participants.map((p) => {
                    const isLocal = p.id === user?.id;
                    const vol = voice.participantVolumes[p.id] ?? 100;
                    return (
                      <li
                        key={p.id}
                        className="rounded-lg bg-surface-container px-space-sm py-space-sm"
                      >
                        <div className="flex items-center gap-space-sm min-w-0">
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
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={vol}
                              className="flex-1 accent-primary-container"
                              aria-label={`${p.displayName} ses`}
                              onChange={(e) =>
                                voice.setParticipantVolume(p.id, Number(e.target.value))
                              }
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
                <div className="border-t border-surface-container-high min-h-0 max-h-[40%] overflow-y-auto">
                  <MemberList groups={memberGroups} className="w-full" />
                </div>
              </div>
            ) : undefined
          }
          chatPanel={
            chatOpen ? (
              <div className="flex flex-col h-full min-h-0">
                <div className="flex-1 min-h-0 px-space-md py-space-sm">
                  <p className="font-body-sm text-on-surface-variant">
                    Metin sohbeti için bir metin kanalına geçebilirsin — ses bağlantın kopmaz.
                  </p>
                </div>
                <MusicPlayerBar
                  guildId={guildId}
                  textChannelId={channels.find((c) => c.type === 'TEXT')?.id ?? null}
                  variant="chat"
                />
              </div>
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
            <span className="text-outline font-headline-md">#</span>
            <span className="font-headline-md text-headline-md text-on-surface truncate">
              {channel?.name ?? 'kanal'}
            </span>
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
              messages={messages}
              mentionNames={mentionNames}
              channelNames={channelNames}
              censorLinkPreviews={Boolean(user?.censorLinkPreviews)}
              hideEmbeds={!prefs.messaging.autoEmbed}
              messageGrouping={
                prefs.accessibility.messageGrouping &&
                prefs.appearance.messageDensity !== 'compact'
              }
              hour24={prefs.language.hour24}
              locale={prefs.language.locale === 'en' ? 'en-US' : 'tr-TR'}
              messageActions={{
                currentUserId: user?.id,
                canManageMessages,
                guildId,
                developerMode: prefs.developer.developerMode,
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
                onReply: (m) =>
                  setReplyTo({
                    id: m.id,
                    authorName: m.author.displayName,
                    contentPreview: m.content.slice(0, 120) || 'Ek / medya',
                  }),
                onForward: (m) => {
                  setForwardTarget({ id: m.id, contentPreview: m.content.slice(0, 80) });
                  setForwardChannelId(channels.find((c) => c.type === 'TEXT' && c.id !== channelId)?.id ?? '');
                  setForwardNote('');
                },
                onPin: (m, pin) => void pinMessage(m.id, pin),
                onCreateHeading: (m) => {
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
                  title="Henüz mesaj yok"
                  description="Draco dinliyor — sohbeti sen başlat!"
                />
              }
            />
          )}
          <div className="relative shrink-0">
            {inVoice && (
              <MusicPlayerBar
                guildId={guildId}
                textChannelId={isVoiceView ? channels.find((c) => c.type === 'TEXT')?.id : channelId}
                variant="chat"
              />
            )}
            <ChatInput key={channelId} {...chatInputProps} />
          </div>
        </div>
      )}

      {!showingVoiceStage && (
        <>
          <MemberList groups={memberGroups} className="hidden lg:flex" />
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
              className={`flex-1 h-10 rounded-lg ${channelType === 'VOICE' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high'}`}
              onClick={() => setChannelType('VOICE')}
            >
              Ses
            </button>
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
                        className="font-label-sm text-primary-container hover:underline"
                        onClick={() =>
                          setChannelDeniedIds((prev) => prev.filter((x) => x !== id))
                        }
                      >
                        İzin ver
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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

      <ConfirmDialog
        open={Boolean(confirm)}
        danger
        busy={busy}
        title={
          confirm?.kind === 'guild'
            ? 'Sunucuyu sil?'
            : `#${confirm?.kind === 'channel' ? confirm.channel.name : ''} kanalını sil?`
        }
        description={
          confirm?.kind === 'guild' ? (
            <p>
              <strong>{serverName}</strong> kalıcı olarak silinecek. Tüm kanallar ve mesajlar
              kaybolur. Bu işlem geri alınamaz.
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
          <select
            value={forwardChannelId}
            onChange={(e) => setForwardChannelId(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          >
            <option value="">Kanal seç…</option>
            {channels
              .filter((c) => c.type === 'TEXT')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}
                </option>
              ))}
          </select>
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
    </AppShell>
  );
}
