import { useEffect, useState } from 'react';
import type { ChannelSummary } from '@dracord/types';
import { DM_CALL_GUILD_ID } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useAuth } from '../auth';
import { useVoiceSession } from '../voice/VoiceSession';
import { ChatPanel } from './ChatPanel';

export function DmPanel({
  channelId,
  onBack,
}: {
  channelId: string;
  onBack?: () => void;
}) {
  const { client, user } = useAuth();
  const voice = useVoiceSession();
  const [channel, setChannel] = useState<ChannelSummary | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [callBusy, setCallBusy] = useState(false);

  const inThisCall =
    voice.voiceChannelId === channelId && voice.voiceGuildId === DM_CALL_GUILD_ID;
  const selfNotes = Boolean(channel?.selfNotes);
  const peerOffline = channel?.peerStatus === 'OFFLINE';

  useEffect(() => {
    let cancelled = false;
    void client.listDms().then((list) => {
      if (cancelled) return;
      setChannel(list.find((c) => c.id === channelId) ?? null);
    });
    void client.markChannelRead(channelId).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, channelId]);

  useEffect(() => {
    if (!user || !channel?.peerUserId) return;
    const sock = client.connectSocket();
    const onPresence = (payload: { userId: string; status: string }) => {
      if (payload.userId !== channel.peerUserId) return;
      setChannel((prev) =>
        prev
          ? {
              ...prev,
              peerStatus: payload.status as ChannelSummary['peerStatus'],
            }
          : prev,
      );
    };
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    return () => {
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
    };
  }, [client, user, channel?.peerUserId]);

  const startCall = async (mode: 'audio' | 'video') => {
    if (selfNotes) return;
    if (peerOffline) {
      setCallError('Karşı taraf çevrimdışı — arama yapılamaz');
      return;
    }
    setCallBusy(true);
    setCallError(null);
    try {
      if (voice.voiceChannelId && voice.voiceChannelId !== channelId) {
        await voice.leave();
      }
      await client.startDmCall(channelId, mode);
      await voice.join(DM_CALL_GUILD_ID, {
        id: channelId,
        name: channel?.name ?? 'DM',
      });
      if (mode === 'video') {
        window.setTimeout(() => {
          void voice.toggleCamera();
        }, 800);
      }
    } catch (e) {
      setCallError(e instanceof Error ? e.message : 'Arama başarısız');
    } finally {
      setCallBusy(false);
    }
  };

  const hangUp = () => {
    void voice.leave();
    void client.declineDmCall(channelId).catch(() => undefined);
  };

  if (!channel) {
    return (
      <div className="flex flex-1 items-center justify-center text-outline font-body-sm">
        DM yükleniyor…
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 min-h-0 flex-col bg-surface">
      <header className="h-12 px-4 flex items-center gap-2 border-b border-surface-container-high shadow-bar shrink-0">
        {onBack && (
          <button
            type="button"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
            onClick={onBack}
            aria-label="Geri"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <span className="font-headline-md text-on-surface truncate block">
            {channel.name || 'DM'}
          </span>
          {channel.peerStatus && !selfNotes && (
            <span className="font-label-sm text-outline capitalize">
              {channel.peerStatus === 'ONLINE'
                ? 'Çevrimiçi'
                : channel.peerStatus === 'IDLE'
                  ? 'Boşta'
                  : channel.peerStatus === 'DND'
                    ? 'Rahatsız etmeyin'
                    : 'Çevrimdışı'}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {!selfNotes && (
            <>
              <button
                type="button"
                disabled={callBusy || inThisCall}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container disabled:opacity-40"
                onClick={() => void startCall('audio')}
                title="Sesli ara"
                aria-label="Sesli ara"
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
              </button>
              <button
                type="button"
                disabled={callBusy || inThisCall}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container disabled:opacity-40"
                onClick={() => void startCall('video')}
                title="Görüntülü ara"
                aria-label="Görüntülü ara"
              >
                <span className="material-symbols-outlined text-[18px]">videocam</span>
              </button>
            </>
          )}
          {inThisCall && (
            <button
              type="button"
              className="h-8 px-3 rounded-lg bg-error-container text-on-error-container font-label-sm"
              onClick={hangUp}
            >
              Bitir
            </button>
          )}
        </div>
      </header>
      {callError && (
        <p className="px-4 py-2 text-error font-body-sm border-b border-surface-container-highest">
          {callError}
        </p>
      )}
      {inThisCall && (
        <div className="px-4 py-2 flex items-center gap-2 bg-dracula-green/10 border-b border-surface-container-highest">
          <span className="w-2 h-2 rounded-full bg-dracula-green animate-pulse" />
          <span className="font-label-sm text-dracula-green">
            {voice.cameraEnabled ? 'Görüntülü arama' : 'Sesli arama'} devam ediyor
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ChatPanel
          guildId=""
          channel={channel}
          hideHeader
          titleOverride={channel.name || 'DM'}
        />
      </div>
    </div>
  );
}
