import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { registerGlobals } from '@livekit/react-native';
import type { ChannelSummary, VoiceTakeoverPayload } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { ChatView } from './ChatView';

let globalsReady = false;
function ensureLiveKit() {
  if (!globalsReady) {
    registerGlobals();
    globalsReady = true;
  }
}

export function VoiceRoom({
  channel,
  guildId,
}: {
  channel: ChannelSummary;
  guildId?: string;
}) {
  const { client, user } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const connectGen = useRef(0);
  const [status, setStatus] = useState('Bağlanıyor…');
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [voiceOnOtherClient, setVoiceOnOtherClient] = useState(false);
  const [elsewherePlatform, setElsewherePlatform] = useState<string | null>(null);
  const [peers, setPeers] = useState<Array<{ id: string; name: string; speaking?: boolean }>>([]);
  const attachedAudio = useRef<ReturnType<RemoteTrack['attach']>[]>([]);
  const userId = user?.id;
  const displayName = user?.displayName;

  const clearAttached = () => {
    for (const el of attachedAudio.current) {
      if (typeof el === 'object' && el && 'pause' in el) {
        (el as HTMLAudioElement).pause?.();
      }
    }
    attachedAudio.current = [];
  };

  const disconnectLiveKit = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    clearAttached();
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* ignore */
      }
    }
    setPeers([]);
    setCamOn(false);
  }, []);

  const connectLiveKit = useCallback(
    async (opts?: { reclaim?: boolean }) => {
      ensureLiveKit();
      const gen = ++connectGen.current;
      await disconnectLiveKit();
      const room = new Room();
      roomRef.current = room;

      const refreshPeers = () => {
        const list = Array.from(room.remoteParticipants.values()).map((p) => ({
          id: p.identity,
          name: p.name || p.identity,
          speaking: p.isSpeaking,
        }));
        if (displayName) {
          list.unshift({
            id: 'self',
            name: `${displayName} (sen)`,
            speaking: room.localParticipant.isSpeaking,
          });
        }
        setPeers(list);
      };

      const onTrackSubscribed = (track: RemoteTrack, pub: { kind?: Track.Kind }) => {
        if (pub.kind === Track.Kind.Audio) {
          const el = track.attach();
          attachedAudio.current.push(el);
        }
        refreshPeers();
      };

      room.on(RoomEvent.ParticipantConnected, refreshPeers);
      room.on(RoomEvent.ParticipantDisconnected, refreshPeers);
      room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.on(RoomEvent.ActiveSpeakersChanged, refreshPeers);

      try {
        setStatus('Bağlanıyor…');
        setVoiceOnOtherClient(false);
        setElsewherePlatform(null);
        if (opts?.reclaim) {
          await client.claimVoiceClient(channel.id).catch(() => undefined);
        } else {
          await client.joinVoiceState(channel.id, {});
        }
        const tok = await client.getVoiceToken(channel.id);
        if (gen !== connectGen.current) return;
        await room.connect(tok.url, tok.token);
        await room.localParticipant.setMicrophoneEnabled(!muted);
        setStatus('Bağlı');
        refreshPeers();
      } catch (e) {
        if (gen !== connectGen.current) return;
        setStatus(e instanceof Error ? e.message : 'Ses bağlantısı başarısız');
        await disconnectLiveKit();
      }
    },
    [channel.id, client, disconnectLiveKit, displayName, muted],
  );

  useEffect(() => {
    void connectLiveKit();
    return () => {
      connectGen.current += 1;
      void (async () => {
        await disconnectLiveKit();
        void client.leaveVoiceState(channel.id);
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / channel değişimi
  }, [channel.id, userId]);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onTakeover = (payload: VoiceTakeoverPayload) => {
      if (payload.clientId === client.getVoiceClientId()) return;
      void (async () => {
        await disconnectLiveKit();
        setVoiceOnOtherClient(true);
        setElsewherePlatform(payload.platform ?? null);
        setStatus(
          payload.platform === 'desktop'
            ? 'Ses masaüstünde'
            : payload.platform === 'web'
              ? 'Ses webde'
              : 'Ses başka cihazda',
        );
      })();
    };
    sock.on(SocketEvents.VOICE_TAKEOVER, onTakeover);
    return () => {
      sock.off(SocketEvents.VOICE_TAKEOVER, onTakeover);
    };
  }, [user, client, disconnectLiveKit]);

  useEffect(() => {
    for (const el of attachedAudio.current) {
      if (typeof el === 'object' && el && 'muted' in el) {
        (el as HTMLAudioElement).muted = deafened;
      }
    }
    if (deafened && !muted) {
      void roomRef.current?.localParticipant.setMicrophoneEnabled(false);
      setMuted(true);
    }
  }, [deafened, muted]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    void roomRef.current?.localParticipant.setMicrophoneEnabled(!next);
    void client.updateVoiceState(channel.id, { muted: next });
  };

  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    await roomRef.current?.localParticipant.setCameraEnabled(next);
  };

  if (showChat && guildId) {
    return (
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={() => setShowChat(false)}
          style={{ padding: 12, backgroundColor: colors.surface }}
        >
          <Text style={{ color: colors.primary, fontWeight: '700' }}>← Ses odası</Text>
        </Pressable>
        <ChatView channel={channel} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>🔊 {channel.name}</Text>
          <Text style={{ color: colors.textMuted, marginVertical: 8 }}>{status}</Text>
        </View>
        {guildId ? (
          <Pressable
            onPress={() => setShowChat(true)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: colors.surfaceHigh,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>Sohbet</Text>
          </Pressable>
        ) : null}
      </View>

      {voiceOnOtherClient ? (
        <View
          style={{
            padding: 12,
            marginBottom: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceHigh,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.text }}>
            {elsewherePlatform === 'desktop'
              ? 'Ses masaüstü uygulamasında açık.'
              : elsewherePlatform === 'web'
                ? 'Ses web istemcisinde açık.'
                : 'Ses başka bir cihazda açık.'}{' '}
            Yalnızca bir istemciden ses gelebilir.
          </Text>
          <Pressable
            onPress={() => void connectLiveKit({ reclaim: true })}
            style={{
              height: 44,
              borderRadius: 12,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>Bu cihaza al</Text>
          </Pressable>
        </View>
      ) : null}

      {peers.map((p) => (
        <View
          key={p.id}
          style={{
            padding: 12,
            marginBottom: 8,
            backgroundColor: p.speaking ? colors.surfaceHigh : colors.surface,
            borderRadius: 10,
            borderWidth: p.speaking ? 2 : 0,
            borderColor: colors.primary,
          }}
        >
          <Text style={{ color: colors.text }}>
            {p.name}
            {p.speaking ? ' 🎙️' : ''}
          </Text>
        </View>
      ))}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 'auto' }}>
        <VoiceBtn
          label={muted ? 'Mic kapalı' : 'Mic açık'}
          active={!muted}
          onPress={toggleMute}
          danger={muted}
          disabled={voiceOnOtherClient}
        />
        <VoiceBtn
          label={deafened ? 'Sağır' : 'Ses açık'}
          active={!deafened}
          onPress={() => {
            const next = !deafened;
            setDeafened(next);
            void client.updateVoiceState(channel.id, { deafened: next });
          }}
          danger={deafened}
          disabled={voiceOnOtherClient}
        />
        <VoiceBtn
          label={camOn ? 'Kamera açık' : 'Kamera kapalı'}
          active={camOn}
          onPress={() => void toggleCam()}
          disabled={voiceOnOtherClient}
        />
      </View>

      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 12 }}>
        Ekran paylaşımı bu platformda desteklenmiyor (N/A). Masaüstü istemcisini kullanın.
      </Text>
    </View>
  );
}

function VoiceBtn({
  label,
  onPress,
  active,
  danger,
  disabled,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        minWidth: '45%',
        height: 48,
        borderRadius: 12,
        opacity: disabled ? 0.45 : 1,
        backgroundColor: danger ? colors.danger : active ? colors.primary : colors.surfaceHigh,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: danger || active ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
