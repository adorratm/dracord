import { useCallback, useEffect, useMemo, useState } from 'react';
import { DRACORD_BOT_USER_ID, type ChannelSummary, type PublicUser } from '@dracord/types';
import {
  MemberList,
  VoiceStage,
  presenceLabelTr,
  type MemberListAction,
  type MemberListGroup,
} from '@dracord/ui';
import { MusicPlayerBar } from '@/components/MusicPlayerBar';
import {
  SCREEN_SHARE_VIEW_QUALITY_PRESETS,
  SCREEN_SHARE_VIEW_QUALITY_SPECS,
} from '@/lib/voice-settings';
import { useAuth } from '../auth';
import { loadLocalPrefs } from '../lib/client-settings';
import { useVoiceSession } from '../voice/VoiceSession';
import { ChatPanel } from './ChatPanel';

function memberRoleExtras(m: PublicUser | undefined, roleColors: boolean) {
  const roles = m?.roles;
  const topRole = (roles ?? [])
    .filter((r) => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position)[0];
  return {
    roles,
    roleColor: roleColors ? topRole?.color : undefined,
    badges: (roles ?? [])
      .filter((r) => r.badgeKey && r.badgeKey !== 'none')
      .map((r) => ({
        id: r.id,
        badgeKey: r.badgeKey,
        color: r.color,
        label: r.name,
      })),
  };
}

export function VoicePanel({
  guildId,
  channel,
  members = [],
  textChannels = [],
  onLeaveNavigate,
  onOpenChannels,
  buildActions,
}: {
  guildId: string;
  channel: ChannelSummary;
  members?: PublicUser[];
  textChannels?: ChannelSummary[];
  muted?: boolean;
  deafened?: boolean;
  onMutedChange?: (v: boolean) => void;
  onDeafenedChange?: (v: boolean) => void;
  onLeaveNavigate?: () => void;
  onOpenChannels?: () => void;
  /** Web parity — sağ tık menüsü (DM, mod, yerel sustur…) */
  buildActions?: (user: PublicUser) => MemberListAction[];
}) {
  const { client, user } = useAuth();
  const voice = useVoiceSession();
  const roleColors = loadLocalPrefs().accessibility.roleColors !== false;
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(340);
  const [partsWidth, setPartsWidth] = useState(288);
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [chatChannelId, setChatChannelId] = useState<string | null>(
    () => textChannels.find((c) => c.type === 'TEXT')?.id ?? null,
  );
  const [dmChannel, setDmChannel] = useState<ChannelSummary | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const userId = user?.id;

  // Sadece bu panelin kanalı değişince katıl.
  // sessionChannelId bağımlılığı bırakınca: leave/oyun geçişinde tekrar eski kanala join oluyordu.
  const join = voice.join;
  useEffect(() => {
    void join(guildId, { id: channel.id, name: channel.name });
  }, [channel.id, channel.name, guildId, join]);

  const textOnly = useMemo(
    () => textChannels.filter((c) => c.type === 'TEXT'),
    [textChannels],
  );

  const chatChannel =
    dmChannel ??
    textOnly.find((c) => c.id === chatChannelId) ??
    textOnly[0] ??
    null;

  const titleLabel = dmChannel
    ? 'Direkt mesaj'
    : chatChannel
      ? `#${chatChannel.name}`
      : 'Kanal seç';

  const canDmUser = (m?: Pick<PublicUser, 'id' | 'isBot'> | null) =>
    Boolean(m) && m!.id !== userId && !m!.isBot && m!.id !== DRACORD_BOT_USER_ID;

  const openDmWith = (targetUserId: string) => {
    const m = members.find((x) => x.id === targetUserId);
    if (!canDmUser(m ?? { id: targetUserId, isBot: targetUserId === DRACORD_BOT_USER_ID })) {
      return;
    }
    void client.openDm(targetUserId).then((ch) => {
      setDmChannel(ch);
      setChatChannelId(ch.id);
      setChatOpen(true);
      setPickerOpen(false);
    });
  };

  const dmTargets = useMemo(
    () => members.filter((m) => canDmUser(m)).slice(0, 24),
    [members, userId],
  );

  const actionsFor = useCallback(
    (m: PublicUser | undefined, fallback: { id: string; displayName: string; isBot?: boolean }) => {
      const target: PublicUser = m ?? ({
        id: fallback.id,
        username: fallback.id.slice(0, 8),
        displayName: fallback.displayName,
        isBot: Boolean(fallback.isBot),
        status: 'ONLINE',
      } as PublicUser);
      if (buildActions) {
        const list = buildActions(target);
        return list.length ? list : undefined;
      }
      return canDmUser(target)
        ? [{ id: 'dm', label: 'Mesaj gönder', onSelect: () => openDmWith(target.id) }]
        : undefined;
    },
    [buildActions, userId],
  );

  const participantGroups: MemberListGroup[] = useMemo(() => {
    const liveStatus = (
      raw?: 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE' | null,
    ): 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE' => {
      if (raw === 'IDLE' || raw === 'DND' || raw === 'ONLINE') return raw;
      // Seste görünen biri OFFLINE/eksik ise çevrimiçi tut (web parity)
      return 'ONLINE';
    };
    const activityFor = (memberId: string, m?: (typeof members)[number] | null) => {
      // Self: auth.user anlık Spotify/oyun — members gecikmeli kalabiliyor
      if (user && memberId === user.id) {
        return {
          activity: user.activity ?? m?.activity ?? null,
          activities: user.activities ?? m?.activities ?? null,
        };
      }
      return {
        activity: m?.activity ?? null,
        activities: m?.activities ?? null,
      };
    };
    const voiceList = voice.peers.map((p) => {
      const m = members.find((x) => x.id === p.id);
      const status = liveStatus(m?.status);
      const peerIsBot = Boolean(m?.isBot);
      const contextActions = actionsFor(m, {
        id: p.id,
        displayName: p.displayName,
        isBot: peerIsBot,
      });
      const dmTarget = m
        ? { id: m.id, isBot: m.isBot }
        : { id: p.id, isBot: peerIsBot };
      const act = activityFor(p.id, m);
      return {
        id: p.id,
        displayName: p.displayName,
        username: m?.username,
        avatarUrl: p.avatarUrl ?? m?.avatarUrl,
        bannerUrl: m?.bannerUrl,
        bannerColor: m?.bannerColor,
        bio: m?.bio,
        socialLinks: m?.socialLinks,
        status,
        customStatus: m?.customStatus,
        activity: act.activity,
        activities: act.activities,
        isBot: peerIsBot,
        ...memberRoleExtras(m, roleColors),
        subtitle: presenceLabelTr(status, m?.customStatus),
        onClick: canDmUser(dmTarget) ? () => openDmWith(p.id) : undefined,
        contextActions,
      };
    });
    return [
      {
        id: 'voice',
        label: 'Seste',
        members: voiceList,
      },
      {
        id: 'members',
        label: 'Üyeler',
        members: members.map((m) => {
          const contextActions = actionsFor(m, m);
          const act = activityFor(m.id, m);
          return {
            id: m.id,
            displayName: m.displayName,
            username: m.username,
            avatarUrl: m.avatarUrl,
            bannerUrl: m.bannerUrl,
            bannerColor: m.bannerColor,
            bio: m.bio,
            socialLinks: m.socialLinks,
            status: (m.status ?? 'OFFLINE') as 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE',
            customStatus: m.customStatus,
            activity: act.activity,
            activities: act.activities,
            isBot: Boolean(m.isBot),
            ...memberRoleExtras(m, roleColors),
            subtitle: presenceLabelTr(m.status ?? 'OFFLINE', m.customStatus),
            onClick: canDmUser(m) ? () => openDmWith(m.id) : undefined,
            contextActions,
          };
        }),
      },
    ];
  }, [voice.peers, members, userId, user, roleColors, actionsFor]);

  const focused = voice.activeScreenShare;

  const viewQualityOptions = SCREEN_SHARE_VIEW_QUALITY_PRESETS.map((id) => ({
    value: id,
    label: SCREEN_SHARE_VIEW_QUALITY_SPECS[id].label,
  }));

  const textChannelId = textOnly[0]?.id ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
    <VoiceStage
      className="min-h-0 flex-1"
      channelName={channel.name}
      participants={voice.peers}
      localParticipantId={userId}
      rtcConnected={voice.connected}
      muted={voice.muted}
      deafened={voice.deafened}
      cameraEnabled={voice.cameraEnabled}
      screenSharing={voice.screenSharing}
      screenShares={voice.screenShares}
      screenShare={
        focused && !voice.screenShareViewPaused
          ? {
              identity: focused.identity,
              displayName: focused.displayName,
              isLocal: focused.isLocal,
              videoRef: (el) => voice.setScreenVideoElement(el),
            }
          : null
      }
      screenShareVolumes={voice.screenShareVolumes}
      onScreenShareVolumeChange={voice.setScreenShareVolume}
      participantVolumes={voice.participantVolumes}
      onParticipantVolumeChange={voice.setParticipantVolume}
      screenShareViewPaused={voice.screenShareViewPaused}
      onPauseScreenShareView={voice.pauseScreenShareView}
      onResumeScreenShareView={voice.resumeScreenShareView}
      screenShareViewQuality={voice.audioSettings.screenShareViewQuality}
      screenShareViewQualityOptions={viewQualityOptions}
      onScreenShareViewQualityChange={(q) =>
        voice.setScreenShareViewQuality(q as typeof voice.audioSettings.screenShareViewQuality)
      }
      onFocusScreenShare={(id) => voice.focusScreenShare(id)}
      onCameraVideoRef={(participantId, el) => voice.attachCamera(participantId, el)}
      chatDrawerOpen={chatOpen}
      participantsDrawerOpen={participantsOpen}
      chatPanelWidth={chatWidth}
      onChatPanelWidthChange={setChatWidth}
      participantsPanelWidth={partsWidth}
      onParticipantsPanelWidthChange={setPartsWidth}
      onToggleMute={() => voice.setMuted(!voice.muted)}
      onToggleDeafen={() => voice.setDeafened(!voice.deafened)}
      onToggleCamera={() => void voice.toggleCamera()}
      onToggleScreenShare={() => void voice.toggleScreenShare()}
      onToggleChat={() => setChatOpen((v) => !v)}
      onToggleParticipants={() => setParticipantsOpen((v) => !v)}
      onOpenChannels={onOpenChannels}
      onLeave={() => {
        void (async () => {
          // Önce UI'dan çık, sonra LiveKit — panel remount/join yarışını önler
          onLeaveNavigate?.();
          const leftId = await voice.leave();
          if (leftId && (channel.type === 'GAME' || channel.type === 'WATCH_PARTY')) {
            try {
              const s = await client.getChannelActivity(guildId, leftId);
              if (s && userId) {
                if (s.playerIds.includes(userId) || s.spectatorIds.includes(userId)) {
                  await client.leaveActivity(s.id);
                }
              }
            } catch {
              /* ignore */
            }
          }
        })();
      }}
      stageOverlay={
        voice.status ? (
          <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none">
            <div className="px-3 py-1.5 rounded-lg bg-error-container text-on-error-container text-sm">
              {voice.status}
            </div>
          </div>
        ) : null
      }
      chatPanel={
        chatOpen ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-11 shrink-0 items-center gap-2 border-b border-surface-container-high px-2">
              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  className="w-full h-8 px-2 rounded-lg bg-surface-container-highest text-left font-body-sm text-on-surface truncate flex items-center gap-1"
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-expanded={pickerOpen}
                >
                  <span className="truncate">{titleLabel}</span>
                  <span className="material-symbols-outlined text-[16px] text-outline ml-auto">
                    expand_more
                  </span>
                </button>
                {pickerOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-surface-container-highest bg-surface-container-low shadow-float max-h-48 overflow-y-auto">
                    {textOnly.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full h-9 px-2 text-left font-body-sm hover:bg-surface-container truncate"
                        onClick={() => {
                          setDmChannel(null);
                          setChatChannelId(c.id);
                          setPickerOpen(false);
                        }}
                      >
                        #{c.name}
                      </button>
                    ))}
                    {dmTargets.length > 0 && (
                      <div className="border-t border-surface-container-high py-1">
                        <p className="px-2 py-1 font-label-sm text-outline uppercase tracking-wide">
                          DM aç
                        </p>
                        {dmTargets.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className="w-full h-9 px-2 text-left font-body-sm hover:bg-surface-container truncate flex items-center gap-2"
                            onClick={() => openDmWith(m.id)}
                          >
                            <span className="material-symbols-outlined text-[16px]">mail</span>
                            {m.displayName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface"
                aria-label="Sohbeti kapat"
                onClick={() => setChatOpen(false)}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {chatChannel ? (
                <ChatPanel
                  guildId={dmChannel ? (dmChannel.guildId ?? guildId) : guildId}
                  channel={chatChannel}
                  members={members}
                  hideHeader
                  titleOverride={titleLabel}
                />
              ) : (
                <p className="p-4 text-sm text-on-surface-variant text-center">
                  Metin kanalı yok. Üye listesinden DM açabilirsin.
                </p>
              )}
            </div>
          </div>
        ) : null
      }
      participantsPanel={
        participantsOpen ? (
          <div className="flex h-full min-h-0 flex-col relative">
            <button
              type="button"
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface"
              aria-label="Üyeleri kapat"
              onClick={() => setParticipantsOpen(false)}
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <MemberList groups={participantGroups} className="w-full h-full min-h-0" />
          </div>
        ) : undefined
      }
    />
    <MusicPlayerBar
      guildId={guildId}
      textChannelId={textChannelId}
      variant="stage"
    />
    </div>
  );
}
