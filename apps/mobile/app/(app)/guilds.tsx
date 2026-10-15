import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import type { ChannelSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { FriendsHub } from '../../components/FriendsHub';
import { ChatView } from '../../components/ChatView';
import {
  ShellHeader,
  useAppShell,
} from '../../components/shell/AppShell';
import { ChannelList } from '../../components/shell/ChannelList';
import { UserPanel } from '../../components/shell/UserPanel';
import { UserAvatar } from '../../components/UserAvatar';
import { useVoiceSessionOptional } from '../../components/voice/VoiceSession';
import { useActivitySessionOptional } from '../../components/activity/ActivitySession';

/**
 * Home (arkadaş/DM) veya sunucu kanal listesi.
 * Sunucu rayı TitleBar hamburger ile açılır (AppShell drawer).
 */
export default function GuildsScreen() {
  const { client, user, refreshUser } = useAuth();
  const router = useRouter();
  const shell = useAppShell();
  const voice = useVoiceSessionOptional();
  const activity = useActivitySessionOptional();
  const [dms, setDms] = useState<ChannelSummary[]>([]);
  const [activeDm, setActiveDm] = useState<ChannelSummary | null>(null);
  const [homeTab, setHomeTab] = useState<'friends' | 'dms'>('friends');

  useEffect(() => {
    if (shell.mode !== 'home') return;
    void client.listDms().then((list) => {
      setDms(list);
      setActiveDm((cur) => cur ?? list[0] ?? null);
    });
  }, [client, shell.mode]);

  const activeGuild = shell.guilds.find((g) => g.id === shell.guildId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader
        title={shell.mode === 'home' ? 'Ana sayfa' : activeGuild?.name ?? 'Dracord'}
        subtitle={shell.mode === 'home' ? 'Arkadaşlar & DM' : user?.displayName}
        showMembers={shell.mode === 'guild'}
      />

      {shell.mode === 'home' ? (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
            <Chip
              label="Arkadaşlar"
              active={homeTab === 'friends'}
              onPress={() => setHomeTab('friends')}
            />
            <Chip label="Mesajlar" active={homeTab === 'dms'} onPress={() => setHomeTab('dms')} />
            <Pressable
              onPress={() => router.push('/(app)/dms')}
              style={{ marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 10 }}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Tümü →</Text>
            </Pressable>
          </View>
          {homeTab === 'friends' ? (
            <FriendsHub
              onOpenDm={(userId) => {
                void client.openDm(userId).then((dm) => {
                  setHomeTab('dms');
                  setActiveDm(dm);
                  void client.listDms().then(setDms);
                });
              }}
            />
          ) : (
            <View style={{ flex: 1 }}>
              <FlatList
                horizontal
                data={dms}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh }}
                contentContainerStyle={{ paddingHorizontal: 8, gap: 6, alignItems: 'center' }}
                ListEmptyComponent={
                  <Text style={{ color: colors.textMuted, padding: 12 }}>Henüz DM yok</Text>
                }
                renderItem={({ item }) => {
                  const selected = activeDm?.id === item.id;
                  return (
                    <Pressable
                      onPress={() => setActiveDm(item)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: selected ? colors.primary : colors.surfaceHigh,
                      }}
                    >
                      <UserAvatar
                        displayName={item.name}
                        imageUrl={item.peerAvatarUrl}
                        size={28}
                        status={item.peerStatus}
                        statusRing={Boolean(item.peerStatus)}
                      />
                      <Text
                        style={{
                          color: selected ? colors.primaryOn : colors.text,
                          fontWeight: '700',
                          fontSize: 13,
                          maxWidth: 120,
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                }}
              />
              {activeDm ? (
                <ChatView channel={activeDm} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                  <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                    Bir sohbet seç veya Arkadaşlar’dan mesaj başlat.
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>
          {/* Ray hamburger menüde — burada tam genişlik kanal listesi */}
          <ChannelList
            channels={shell.channels}
            categories={shell.categories}
            activeChannelId={shell.activeChannelId}
            onOpenChannel={(c) => void shell.openChannel(c)}
            serverName={activeGuild?.name}
            onOpenServerMenu={shell.openServerMenu}
            onOpenMembers={() => {
              void shell.refreshMembers();
              shell.setMembersOpen(true);
            }}
            selfUserId={user?.id}
            activeVoiceChannelId={voice?.voiceChannelId}
            activeActivityChannelId={activity?.activityChannelId}
            onVoiceMemberPress={(m, ch) => shell.openVoiceMember(m, ch)}
            onVoiceMemberLongPress={(m, ch) => shell.openVoiceMemberMenu(m, ch)}
          />
          <UserPanel
            user={user}
            onStatusChange={(status, customStatus) => {
              void client
                .updatePresence({ status, customStatus })
                .then(() => refreshUser())
                .catch(() => undefined);
            }}
            onOpenSettings={() => router.push('/(app)/settings')}
            onOpenProfile={() => {
              if (user) shell.openProfile(user);
            }}
          />
        </View>
      )}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surfaceHigh,
      }}
    >
      <Text style={{ color: active ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}
