import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { registerGlobals } from '@livekit/react-native';
import type { ChannelSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { ChatView } from '../../components/ChatView';
import { UserAvatar } from '../../components/UserAvatar';
import { primaryBtn, primaryBtnText } from '../../lib/ui';
import { ShellHeader } from '../../components/shell/AppShell';

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Direkt mesajlar" />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 12,
          paddingTop: 8,
        }}
      >
        <Pressable onPress={() => router.push('/(app)/friends')}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Arkadaşlar</Text>
        </Pressable>
      </View>
      <View style={{ maxHeight: 280, borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh }}>
        <FlatList
          data={dms}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingVertical: 4 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, padding: 12 }}>
              Henüz DM yok — Arkadaşlar’dan mesaj aç
            </Text>
          }
          renderItem={({ item: c }) => {
            const selected = active?.id === c.id;
            return (
              <Pressable
                onPress={() => {
                  void endCall();
                  setActive(c);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: selected ? colors.surfaceHigh : 'transparent',
                }}
              >
                <UserAvatar
                  displayName={c.name}
                  imageUrl={c.peerAvatarUrl}
                  size={44}
                  status={c.peerStatus}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: selected ? '800' : '600',
                      fontSize: 15,
                    }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                  {c.unread ? (
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>
                      Okunmamış
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
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
