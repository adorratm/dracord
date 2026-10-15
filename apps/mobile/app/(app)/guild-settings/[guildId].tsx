import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { ChannelSummary, GuildInviteDto, PublicUser, RoleDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../lib/auth';
import { inputStyle, primaryBtn, primaryBtnText } from '../../../lib/ui';
import { ShellHeader } from '../../../components/shell/AppShell';
import { Icon } from '../../../components/Icon';

function channelIconName(type: ChannelSummary['type']) {
  if (type === 'VOICE') return 'volume_up';
  if (type === 'GAME' || type === 'WATCH_PARTY') return 'sports_esports';
  if (type === 'FORUM') return 'forum';
  return 'tag';
}

type Tab = 'general' | 'channels' | 'roles' | 'members' | 'invite';

export default function GuildSettingsScreen() {
  const { guildId = '' } = useLocalSearchParams<{ guildId: string }>();
  const { client } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('general');
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [invite, setInvite] = useState<GuildInviteDto | null>(null);
  const [newChannel, setNewChannel] = useState('');
  const [newRole, setNewRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reloadChannels = () => void client.getGuildChannels(guildId).then(setChannels);

  useEffect(() => {
    void client.getGuild(guildId).then((g) => setName(g.name));
    void client.listGuildRoles(guildId).then(setRoles);
    reloadChannels();
    void client.getGuildMembers(guildId).then(setMembers);
  }, [client, guildId]);

  const tabs: Array<[Tab, string]> = [
    ['general', 'Genel'],
    ['channels', 'Kanallar'],
    ['roles', 'Roller'],
    ['members', 'Üyeler'],
    ['invite', 'Davet'],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Sunucu ayarları" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh }}>
        {tabs.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: tab === k ? colors.surfaceHigh : 'transparent',
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
        {msg ? <Text style={{ color: colors.success, marginBottom: 8 }}>{msg}</Text> : null}

        {tab === 'general' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>Genel</Text>
            <TextInput value={name} onChangeText={setName} style={{ ...inputStyle, marginBottom: 12 }} />
            <Pressable
              style={primaryBtn}
              onPress={() => {
                setError(null);
                void client
                  .updateGuild(guildId, { name: name.trim() })
                  .then(() => setMsg('Kaydedildi'))
                  .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
              }}
            >
              <Text style={primaryBtnText}>Kaydet</Text>
            </Pressable>
          </>
        )}

        {tab === 'channels' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>Kanallar</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TextInput
                value={newChannel}
                onChangeText={setNewChannel}
                placeholder="Yeni metin kanalı"
                placeholderTextColor={colors.textMuted}
                style={{ ...inputStyle, flex: 1 }}
              />
              <Pressable
                style={primaryBtn}
                onPress={() => {
                  if (!newChannel.trim()) return;
                  void client
                    .createChannel(guildId, { name: newChannel.trim(), type: 'TEXT' })
                    .then(() => {
                      setNewChannel('');
                      reloadChannels();
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : 'Oluşturulamadı'));
                }}
              >
                <Text style={primaryBtnText}>Ekle</Text>
              </Pressable>
            </View>
            {channels
              .filter((c) => c.type !== 'CATEGORY')
              .map((c) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surfaceHigh,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 }}>
                    <Icon name={channelIconName(c.type)} size={18} color={colors.textMuted} />
                    <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                      {c.name}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      Alert.alert('Kanal sil', `#${c.name} silinsin mi?`, [
                        { text: 'İptal', style: 'cancel' },
                        {
                          text: 'Sil',
                          style: 'destructive',
                          onPress: () => void client.deleteChannel(c.id).then(reloadChannels),
                        },
                      ]);
                    }}
                  >
                    <Text style={{ color: colors.danger }}>Sil</Text>
                  </Pressable>
                </View>
              ))}
          </>
        )}

        {tab === 'roles' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>Roller</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TextInput
                value={newRole}
                onChangeText={setNewRole}
                placeholder="Yeni rol"
                placeholderTextColor={colors.textMuted}
                style={{ ...inputStyle, flex: 1 }}
              />
              <Pressable
                style={primaryBtn}
                onPress={() => {
                  if (!newRole.trim()) return;
                  void client.createGuildRole(guildId, { name: newRole.trim() }).then(() => {
                    setNewRole('');
                    void client.listGuildRoles(guildId).then(setRoles);
                  });
                }}
              >
                <Text style={primaryBtnText}>Ekle</Text>
              </Pressable>
            </View>
            {roles.map((r) => (
              <Text key={r.id} style={{ color: r.color || colors.text, paddingVertical: 8 }}>
                {r.name}
              </Text>
            ))}
          </>
        )}

        {tab === 'members' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>Üyeler</Text>
            {members.map((m) => (
              <View
                key={m.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.surfaceHigh,
                }}
              >
                <Text style={{ color: colors.text, flex: 1 }}>
                  {m.displayName}{' '}
                  <Text style={{ color: colors.textMuted }}>@{m.username}</Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Pressable
                    onPress={() => {
                      Alert.alert('Üye at', 'Üye atılsın mı?', [
                        { text: 'İptal', style: 'cancel' },
                        {
                          text: 'At',
                          style: 'destructive',
                          onPress: () =>
                            void client.kickGuildMember(guildId, m.id).then(() =>
                              client.getGuildMembers(guildId).then(setMembers),
                            ),
                        },
                      ]);
                    }}
                  >
                    <Text style={{ color: colors.danger }}>At</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert('Ban', 'Üye banlansın mı?', [
                        { text: 'İptal', style: 'cancel' },
                        {
                          text: 'Ban',
                          style: 'destructive',
                          onPress: () =>
                            void client.banGuildMember(guildId, m.id).then(() =>
                              client.getGuildMembers(guildId).then(setMembers),
                            ),
                        },
                      ]);
                    }}
                  >
                    <Text style={{ color: colors.danger }}>Ban</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        )}

        {tab === 'invite' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>Davet</Text>
            <Pressable
              style={primaryBtn}
              onPress={() => {
                void client.createInvite(guildId).then(setInvite).catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
              }}
            >
              <Text style={primaryBtnText}>Davet oluştur</Text>
            </Pressable>
            {invite ? (
              <Text selectable style={{ color: colors.primary, marginTop: 16 }}>
                Kod: {invite.code}
              </Text>
            ) : null}
          </>
        )}

        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 32, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Icon name="arrow_back" size={18} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted }}>Geri</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
