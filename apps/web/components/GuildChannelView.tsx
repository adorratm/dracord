'use client';

import type { ChannelSummary, VoiceMemberSummary, VoiceStatePayload } from '@dracord/types';
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
import { buildSidebarCategories } from '@/lib/channels';
import { useChatChannel } from '@/hooks/useChatChannel';
import { useGuildNav } from '@/hooks/useGuildNav';
import { useVoiceSession } from '@/components/VoiceSessionProvider';

interface GuildChannelViewProps {
  guildId: string;
  channelId: string;
}

type ConfirmState =
  | { kind: 'channel'; channel: ChannelSummary }
  | { kind: 'guild' }
  | null;

export function GuildChannelView({ guildId, channelId }: GuildChannelViewProps) {
  const router = useRouter();
  const { user, client } = useAuth();
  const { guilds, guild, channels, loading, reload, patchGuild } = useGuildNav(guildId);
  const channel = channels.find((c) => c.id === channelId);
  const isVoiceView = channel?.type === 'VOICE';

  const { messages, sendMessage, sendWithAttachments, sendMedia, error: chatError } =
    useChatChannel(isVoiceView ? undefined : channelId);
  const voice = useVoiceSession();

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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rememberChannel(guildId, channelId);
  }, [guildId, channelId]);

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
    setChannelModal({ mode: 'edit', categoryId: ch.categoryId, channel: ch });
  }, []);

  const selectChannel = useCallback(
    (ch: ChannelSummary) => {
      if (ch.type === 'VOICE') {
        voice.join(ch.id, guildId);
      }
      router.push(`/channels/${guildId}/${ch.id}`);
    },
    [voice.join, guildId, router],
  );

  const categories = useMemo(
    () =>
      buildSidebarCategories(channels, channelId, selectChannel, {
        voiceMembersByChannel,
        selfUserId: user?.id,
        selfVoiceChannelId: voice.voiceChannelId,
        onAddChannel: (categoryId) => {
          setChannelName('');
          setChannelType('TEXT');
          setChannelModal({ mode: 'create', categoryId });
        },
        onEditChannel: openEditChannel,
        onDeleteChannel: (ch) => setConfirm({ kind: 'channel', channel: ch }),
      }),
    [
      channels,
      channelId,
      selectChannel,
      voiceMembersByChannel,
      openEditChannel,
      user?.id,
      voice.voiceChannelId,
    ],
  );

  const memberGroups: MemberListGroup[] = useMemo(() => {
    const voiceList = inVoice
      ? voice.participants.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          status: 'ONLINE' as const,
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
                  },
                ]
              : [],
      },
    ];
  }, [user, inVoice, voice.participants]);

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
        await reload();
        setChannelModal(null);
        router.push(`/channels/${guildId}/${created.id}`);
      } else if (channelModal.channel) {
        await client.updateChannel(channelModal.channel.id, { name: channelName });
        await reload();
        setChannelModal(null);
      }
    } finally {
      setBusy(false);
    }
  }, [channelModal, channelName, channelType, client, guildId, reload, router]);

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
    onSend: (text: string) => void sendMessage(text),
    onAttachFiles: (files: FileList | File[]) => void sendWithAttachments(files),
    onSendMedia: (payload: Parameters<typeof sendMedia>[0]) => void sendMedia(payload),
    searchGifs,
    loadFeaturedGifs,
  };

  if (loading && !guild) {
    return (
      <AppShell guilds={guilds} activeGuildId={guildId} onGuildsChanged={() => void reload()}>
        <div className="flex flex-1 items-center justify-center text-outline">Sunucu yükleniyor…</div>
      </AppShell>
    );
  }

  const serverName = guild?.name ?? 'Sunucu';

  return (
    <AppShell
      guilds={guilds}
      activeGuildId={guildId}
      onGuildsChanged={() => void reload()}
    >
      <ChannelSidebar
        serverName={serverName}
        serverBannerUrl={guild?.bannerUrl}
        categories={categories}
        onServerHeaderClick={() => setServerMenuOpen(true)}
        userPanel={{
          displayName: user?.displayName ?? 'Kullanıcı',
          avatarUrl: user?.avatarUrl,
          status: user?.status ?? 'ONLINE',
          muted: inVoice ? voice.muted : undefined,
          deafened: inVoice ? voice.deafened : undefined,
          noiseCancellation: voice.noiseCancellation,
          noiseNote: voice.noiseNote,
          voiceConnected: inVoice,
          voiceChannelName: voiceChannel?.name ?? null,
          onSettingsClick: () => router.push('/settings'),
          onProfileClick: () => router.push('/settings/profile'),
          onMicClick: inVoice ? () => void voice.toggleMute() : undefined,
          onHeadphonesClick: inVoice ? () => void voice.toggleDeafen() : undefined,
          onNoiseClick: inVoice ? () => void voice.toggleNoiseCancellation() : undefined,
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

      {showingVoiceStage ? (
        <VoiceStage
          channelName={channel?.name ?? voiceChannel?.name ?? 'Ses'}
          participants={voice.participants}
          rtcConnected={voice.connected}
          muted={voice.muted}
          deafened={voice.deafened}
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
              <MemberList groups={memberGroups} className="w-full" />
            ) : undefined
          }
          chatPanel={
            chatOpen ? (
              <div className="flex flex-col h-full min-h-0 px-space-md py-space-sm">
                <p className="font-body-sm text-on-surface-variant">
                  Metin sohbeti için bir metin kanalına geçebilirsin — ses bağlantın kopmaz.
                </p>
              </div>
            ) : undefined
          }
        />
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
          {!isConnecting && (
            <button
              type="button"
              className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary-container"
              onClick={() => voice.join(channelId, guildId)}
            >
              {inVoice && voice.voiceChannelId !== channelId ? 'Bu kanala geç' : 'Kanala katıl'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-1 min-w-0 min-h-0 flex-col bg-surface">
          <header className="h-12 px-space-md flex items-center gap-space-sm border-b border-surface-container-high shadow-bar shrink-0">
            <span className="text-outline font-headline-md">#</span>
            <span className="font-headline-md text-headline-md text-on-surface truncate">
              {channel?.name ?? 'kanal'}
            </span>
            {channel && (
              <button
                type="button"
                className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface"
                aria-label="Kanalı düzenle"
                onClick={() => openEditChannel(channel)}
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
            )}
          </header>
          {chatError && (
            <p className="px-space-md py-space-sm text-error font-body-sm">{chatError}</p>
          )}
          <MessageList
            messages={messages}
            emptyState={
              <span className="font-body-md text-body-md">Henüz mesaj yok. Sohbeti başlat!</span>
            }
          />
          <ChatInput {...chatInputProps} />
        </div>
      )}

      {!showingVoiceStage && <MemberList groups={memberGroups} />}

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
              setServerNameDraft(serverName);
              setServerError(null);
              setServerMenuOpen(false);
              setServerSettingsOpen(true);
            }}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Sunucu ayarları
          </button>
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
    </AppShell>
  );
}
