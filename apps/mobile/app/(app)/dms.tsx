import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { registerGlobals } from '@livekit/react-native';
import type { ChannelSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { ChatView } from '../../components/ChatView';
import { primaryBtn, primaryBtnText } from '../../lib/ui';

let lkReady = false;
function ensureLiveKit() {
  if (!lkReady) {
    registerGlobals();
    lkReady = true;
  }
}

export default function DmsScreen() {
  const { client } = useAuth();
  const router = useRouter();
  const [dms, setDms] = useState<ChannelSummary[]>([]);
  const [active, setActive] = useState<ChannelSummary | null>(null);
  const [callStatus, setCallStatus] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);

  const reload = () =>
    client.listDms().then((list) => {
      setDms(list);
      setActive((cur) => cur ?? list[0] ?? null);
    });

  useEffect(() => {
    void reload();
    return () => {
      void endCall();
    };
  }, [client]);

  const endCall = async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) await room.disconnect();
    if (active) {
      try {
        await client.declineDmCall(active.id);
      } catch {
        /* ignore */
      }
    }
    setCallStatus(null);
  };

  const startCall = async (mode: 'audio' | 'video') => {
    if (!active) return;
    ensureLiveKit();
    setCallStatus('Aranıyor…');
    try {
      await client.startDmCall(active.id, mode);
      const tok = await client.getVoiceToken(active.id);
      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub) => {
        if (pub.kind === Track.Kind.Audio) {
          track.attach();
        }
      });
      await room.connect(tok.url, tok.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (mode === 'video') await room.localParticipant.setCameraEnabled(true);
      setCallStatus(mode === 'video' ? 'Görüntülü arama' : 'Sesli arama');
    } catch (e) {
      setCallStatus(e instanceof Error ? e.message : 'Arama başarısız');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Direkt mesajlar',
          headerRight: () => (
            <Pressable onPress={() => router.push('/(app)/friends')} style={{ paddingHorizontal: 12 }}>
              <Text style={{ color: colors.primary }}>Arkadaş</Text>
            </Pressable>
          ),
        }}
      />
      <View style={{ maxHeight: 120, borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh }}>
        <FlatList
          horizontal
          data={dms}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 8 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, padding: 8 }}>Henüz DM yok — Arkadaşlar’dan mesaj aç</Text>
          }
          renderItem={({ item: c }) => (
            <Pressable
              onPress={() => {
                void endCall();
                setActive(c);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginRight: 8,
                borderRadius: 10,
                backgroundColor: active?.id === c.id ? colors.primary : colors.surfaceHigh,
              }}
            >
              <Text
                style={{
                  color: active?.id === c.id ? colors.primaryOn : colors.text,
                  fontWeight: '600',
                }}
              >
                {c.name}
              </Text>
            </Pressable>
          )}
        />
      </View>

      {active ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              padding: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.surfaceHigh,
              alignItems: 'center',
            }}
          >
            <Pressable style={{ ...primaryBtn, flex: 1, height: 40 }} onPress={() => void startCall('audio')}>
              <Text style={{ ...primaryBtnText, fontSize: 13 }}>Sesli ara</Text>
            </Pressable>
            <Pressable style={{ ...primaryBtn, flex: 1, height: 40 }} onPress={() => void startCall('video')}>
              <Text style={{ ...primaryBtnText, fontSize: 13 }}>Görüntülü</Text>
            </Pressable>
            {callStatus ? (
              <Pressable onPress={() => void endCall()}>
                <Text style={{ color: colors.danger, fontSize: 13 }}>Kapat</Text>
              </Pressable>
            ) : null}
          </View>
          {callStatus ? (
            <Text style={{ color: colors.textMuted, paddingHorizontal: 12, paddingBottom: 4, fontSize: 12 }}>
              {callStatus}
            </Text>
          ) : null}
          <ChatView channel={active} />
        </>
      ) : (
        <Text style={{ color: colors.textMuted, padding: 16 }}>Bir DM seç</Text>
      )}
    </View>
  );
}
