import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type {
  CategoryDto,
  ChannelSummary,
  DiscoverCategory,
  GuildInviteDto,
  GuildSummary,
  PublicUser,
  RoleBadgeKey,
  RoleDto,
  RoleProfileBgKey,
} from '@dracord/types';
import { DISCOVER_CATEGORIES } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../lib/auth';
import { inputStyle, primaryBtn, primaryBtnText } from '../../../lib/ui';
import { uploadImageFromUri } from '../../../lib/uploadMobile';
import { ShellHeader } from '../../../components/shell/AppShell';
import { Icon } from '../../../components/Icon';
import { ThemedSwitch } from '../../../components/ThemedSwitch';
import {
  CreateCategorySheet,
  CreateChannelSheet,
} from '../../../components/CreateChannelSheet';

function channelIconName(type: ChannelSummary['type']) {
  if (type === 'VOICE') return 'volume_up';
  if (type === 'GAME' || type === 'WATCH_PARTY') return 'sports_esports';
  if (type === 'FORUM') return 'forum';
  return 'tag';
}

const BADGE_OPTIONS: Array<{ id: RoleBadgeKey; label: string }> = [
  { id: 'none', label: 'Rozet yok' },
  { id: 'crown', label: 'Taç' },
  { id: 'shield', label: 'Kalkan' },
  { id: 'star', label: 'Yıldız' },
  { id: 'fire', label: 'Ateş' },
  { id: 'sparkle', label: 'Parıltı' },
  { id: 'diamond', label: 'Elmas' },
  { id: 'heart', label: 'Kalp' },
];

const BG_OPTIONS: Array<{ id: RoleProfileBgKey; label: string }> = [
  { id: 'none', label: 'Varsayılan' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'ember', label: 'Kor' },
  { id: 'ocean', label: 'Okyanus' },
  { id: 'noir', label: 'Noir' },
  { id: 'candy', label: 'Candy' },
  { id: 'mint', label: 'Mint' },
  { id: 'sunset', label: 'Gün batımı' },
];

const ROLE_PERMISSIONS: Array<{ id: string; label: string }> = [
  { id: 'VIEW_CHANNELS', label: 'Kanalları gör' },
  { id: 'SEND_MESSAGES', label: 'Mesaj gönder' },
  { id: 'ADD_REACTIONS', label: 'Tepki ekle' },
  { id: 'CREATE_POLLS', label: 'Anket oluştur' },
  { id: 'MANAGE_MESSAGES', label: 'Mesajları yönet' },
  { id: 'MANAGE_CHANNELS', label: 'Kanalları yönet' },
  { id: 'MANAGE_ROLES', label: 'Rolleri yönet' },
  { id: 'MANAGE_GUILD', label: 'Sunucuyu yönet' },
  { id: 'KICK_MEMBERS', label: 'Üye at' },
  { id: 'BAN_MEMBERS', label: 'Üye yasakla' },
  { id: 'MOVE_MEMBERS', label: 'Ses taşı / ayır' },
  { id: 'MODERATE_MEMBERS', label: 'Timeout' },
  { id: 'ADMINISTRATOR', label: 'Yönetici' },
];

const AFK_TIMEOUTS = [0, 1, 5, 10, 15, 30, 60];

type Tab =
  | 'general'
  | 'channels'
  | 'roles'
  | 'members'
  | 'moderation'
  | 'slash'
  | 'invite';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: selected ? colors.primary : colors.surfaceHigh,
      }}
    >
      <Text
        style={{
          color: selected ? colors.primaryOn : colors.text,
          fontWeight: '700',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function GuildSettingsScreen() {
  const { guildId = '' } = useLocalSearchParams<{ guildId: string }>();
  const { client } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('general');
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [name, setName] = useState('');
  const [discoverable, setDiscoverable] = useState(false);
  const [discoverCategory, setDiscoverCategory] = useState<DiscoverCategory>('gaming');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [afkChannelId, setAfkChannelId] = useState<string>('');
  const [afkTimeout, setAfkTimeout] = useState(5);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [members, setMembers] = useState<PublicUser[]>([]);
  const [invite, setInvite] = useState<GuildInviteDto | null>(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [newRole, setNewRole] = useState('');
  const newRoleColor = '#5865F2';
  const [newBadge, setNewBadge] = useState<RoleBadgeKey>('star');
  const [newBg, setNewBg] = useState<RoleProfileBgKey>('aurora');
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [canManageChannels, setCanManageChannels] = useState(false);
  const [canModMembers, setCanModMembers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<
    Array<{ id: string; actorId: string; action: string; targetId: string | null; createdAt: string }>
  >([]);
  const [bans, setBans] = useState<
    Array<{ userId: string; reason: string | null; bannedById: string; createdAt: string }>
  >([]);
  const [slashCommands, setSlashCommands] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      usage: string;
      botName: string | null;
    }>
  >([]);
  const [slashName, setSlashName] = useState('');
  const [slashDesc, setSlashDesc] = useState('');
  const [slashUsage, setSlashUsage] = useState('');
  const [slashTemplate, setSlashTemplate] = useState('');

  const voiceChannels = useMemo(
    () => channels.filter((c) => c.type === 'VOICE'),
    [channels],
  );

  const reloadChannels = useCallback(() => {
    void client.getGuildChannels(guildId).then(setChannels);
    void client.listGuildCategories(guildId).then(setCategories).catch(() => setCategories([]));
  }, [client, guildId]);

  const reloadRoles = useCallback(() => {
    void client
      .listGuildRoles(guildId)
      .then((list) => setRoles(list.sort((a, b) => b.position - a.position)))
      .catch(() => setRoles([]));
  }, [client, guildId]);

  const reloadModeration = useCallback(() => {
    void Promise.all([
      client.listGuildAuditLogs(guildId).catch(() => []),
      client.listGuildBans(guildId).catch(() => []),
    ]).then(([logs, banList]) => {
      setAuditLogs(logs.slice(0, 50));
      setBans(banList);
    });
  }, [client, guildId]);

  const reloadSlash = useCallback(() => {
    void client
      .listGuildSlashCommands(guildId)
      .then((list) =>
        setSlashCommands(
          list.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            usage: c.usage,
            botName: c.botName,
          })),
        ),
      )
      .catch(() => setSlashCommands([]));
  }, [client, guildId]);

  useEffect(() => {
    void client.getGuild(guildId).then((g) => {
      setGuild(g);
      setName(g.name);
      setDiscoverable(Boolean(g.discoverable));
      setDiscoverCategory((g.discoverCategory as DiscoverCategory) || 'gaming');
      setIconUrl(g.iconUrl ?? null);
      setBannerUrl(g.bannerUrl ?? null);
      setAfkChannelId(g.afkChannelId ?? '');
      setAfkTimeout(g.afkTimeoutMinutes ?? 5);
    });
    void client
      .getGuildPermissions(guildId)
      .then((p) => {
        const set = new Set(p.permissions ?? []);
        const god = Boolean(p.owner || p.platformAdmin || set.has('ADMINISTRATOR'));
        setCanManage(god || set.has('MANAGE_GUILD'));
        setCanManageRoles(god || set.has('MANAGE_ROLES'));
        setCanManageChannels(god || set.has('MANAGE_CHANNELS'));
        setCanModMembers(
          god ||
            set.has('KICK_MEMBERS') ||
            set.has('BAN_MEMBERS') ||
            set.has('MODERATE_MEMBERS'),
        );
      })
      .catch(() => {
        setCanManage(false);
        setCanManageRoles(false);
        setCanManageChannels(false);
        setCanModMembers(false);
      });
    reloadRoles();
    reloadChannels();
    void client.getGuildMembers(guildId).then(setMembers);
    reloadModeration();
    reloadSlash();
  }, [client, guildId, reloadRoles, reloadChannels, reloadModeration, reloadSlash]);

  const tabs = useMemo(() => {
    const all: Array<[Tab, string, boolean]> = [
      ['general', 'Genel', canManage],
      ['channels', 'Kanallar', canManageChannels],
      ['roles', 'Roller', canManageRoles],
      ['members', 'Üyeler', canModMembers || canManage],
      ['moderation', 'Moderasyon', canManage],
      ['slash', 'Slash', canManage],
      ['invite', 'Davet', true],
    ];
    return all.filter(([, , ok]) => ok);
  }, [canManage, canManageChannels, canManageRoles, canModMembers]);

  useEffect(() => {
    if (tabs.length && !tabs.some(([id]) => id === tab)) {
      setTab(tabs[0][0]);
    }
  }, [tabs, tab]);

  const pickAndUpload = async (kind: 'icon' | 'banner') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Galeri izni gerekli');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: kind === 'icon' ? [1, 1] : [16, 9],
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadImageFromUri(
        client,
        asset.uri,
        asset.fileName ?? `${kind}.jpg`,
        asset.mimeType ?? 'image/jpeg',
        kind === 'icon' ? 'avatars' : 'banners',
      );
      const updated = await client.updateGuild(
        guildId,
        kind === 'icon' ? { iconUrl: uploaded.url } : { bannerUrl: uploaded.url },
      );
      setGuild(updated);
      if (kind === 'icon') setIconUrl(updated.iconUrl ?? uploaded.url);
      else setBannerUrl(updated.bannerUrl ?? uploaded.url);
      setMsg(kind === 'icon' ? 'İkon güncellendi' : 'Kapak güncellendi');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setBusy(false);
    }
  };

  const saveGeneral = async () => {
    if (!name.trim()) {
      setError('Sunucu adı gerekli');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await client.updateGuild(guildId, {
        name: name.trim(),
        discoverable,
        discoverCategory: discoverable ? discoverCategory : undefined,
        afkChannelId: afkChannelId || null,
        afkTimeoutMinutes: afkTimeout,
      });
      setGuild(updated);
      setMsg('Kaydedildi');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Sunucu ayarları" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh }}
      >
        {tabs.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => {
              setTab(k);
              setError(null);
              setMsg(null);
            }}
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
        {msg ? <Text style={{ color: colors.success, marginBottom: 8 }}>{msg}</Text> : null}

        {tab === 'general' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
              Genel
            </Text>
            {!canManage ? (
              <Text style={{ color: colors.textMuted }}>
                Bu sunucuyu düzenlemek için yetkin yok.
              </Text>
            ) : (
              <>
                <Pressable
                  onPress={() => void pickAndUpload('banner')}
                  disabled={busy}
                  style={{
                    height: 100,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: colors.surfaceHigh,
                    marginBottom: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {bannerUrl ? (
                    <Image source={{ uri: bannerUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text style={{ color: colors.textMuted }}>Kapak seç</Text>
                  )}
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <Pressable
                    onPress={() => void pickAndUpload('icon')}
                    disabled={busy}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      overflow: 'hidden',
                      backgroundColor: colors.surfaceHigh,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {iconUrl ? (
                      <Image source={{ uri: iconUrl }} style={{ width: 64, height: 64 }} />
                    ) : (
                      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22 }}>
                        {(name || 'S').slice(0, 1).toUpperCase()}
                      </Text>
                    )}
                  </Pressable>
                  <Text style={{ color: colors.textMuted, flex: 1 }}>
                    İkon veya kapak için dokun
                  </Text>
                </View>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={{ ...inputStyle, marginBottom: 12 }}
                  placeholder="Sunucu adı"
                  placeholderTextColor={colors.textMuted}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                  }}
                >
                  <Text style={{ color: colors.text, flex: 1, paddingRight: 12 }}>
                    Keşfette göster
                  </Text>
                  <ThemedSwitch value={discoverable} onValueChange={setDiscoverable} />
                </View>
                {discoverable ? (
                  <View style={{ marginBottom: 12, gap: 8 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>Keşfet kategorisi</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {DISCOVER_CATEGORIES.map((c) => (
                        <Chip
                          key={c.id}
                          label={c.label}
                          selected={discoverCategory === c.id}
                          onPress={() => setDiscoverCategory(c.id)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
                <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>
                  AFK kanalı
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <Chip
                    label="Kapalı"
                    selected={!afkChannelId}
                    onPress={() => setAfkChannelId('')}
                  />
                  {voiceChannels.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={afkChannelId === c.id}
                      onPress={() => setAfkChannelId(c.id)}
                    />
                  ))}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                  Zaman aşımı
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {AFK_TIMEOUTS.map((m) => (
                    <Chip
                      key={m}
                      label={m === 0 ? 'Kapalı' : `${m} dk`}
                      selected={afkTimeout === m}
                      onPress={() => setAfkTimeout(m)}
                    />
                  ))}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
                  Sunucu ID: {guildId}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 16 }}>
                  Sahip ID: {guild?.ownerId ?? '—'}
                </Text>
                <Pressable
                  style={[primaryBtn, { opacity: busy ? 0.6 : 1 }]}
                  disabled={busy}
                  onPress={() => void saveGeneral()}
                >
                  <Text style={primaryBtnText}>{busy ? '…' : 'Kaydet'}</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {tab === 'channels' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
              Kanallar
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <Pressable style={primaryBtn} onPress={() => setCreateChannelOpen(true)}>
                <Text style={primaryBtnText}>Kanal oluştur</Text>
              </Pressable>
              <Pressable
                style={[primaryBtn, { backgroundColor: colors.surfaceHigh }]}
                onPress={() => setCreateCategoryOpen(true)}
              >
                <Text style={[primaryBtnText, { color: colors.text }]}>Kategori oluştur</Text>
              </Pressable>
            </View>
            {categories.map((cat) => (
              <Text key={cat.id} style={{ color: colors.textMuted, paddingVertical: 4 }}>
                {cat.name}
              </Text>
            ))}
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
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      flex: 1,
                      paddingRight: 8,
                    }}
                  >
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
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
              Roller & rozetler
            </Text>
            {!canManageRoles ? (
              <Text style={{ color: colors.textMuted }}>Rol yönetmek için yetkin yok.</Text>
            ) : (
              <>
                <TextInput
                  value={newRole}
                  onChangeText={setNewRole}
                  placeholder="Yeni rol adı"
                  placeholderTextColor={colors.textMuted}
                  style={{ ...inputStyle, marginBottom: 10 }}
                />
                <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>Rozet</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {BADGE_OPTIONS.map((o) => (
                    <Chip
                      key={o.id}
                      label={o.label}
                      selected={newBadge === o.id}
                      onPress={() => setNewBadge(o.id)}
                    />
                  ))}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>
                  Profil arka planı
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {BG_OPTIONS.map((o) => (
                    <Chip
                      key={o.id}
                      label={o.label}
                      selected={newBg === o.id}
                      onPress={() => setNewBg(o.id)}
                    />
                  ))}
                </View>
                <Pressable
                  style={[primaryBtn, { marginBottom: 16, opacity: !newRole.trim() || busy ? 0.5 : 1 }]}
                  disabled={!newRole.trim() || busy}
                  onPress={() => {
                    setBusy(true);
                    void client
                      .createGuildRole(guildId, {
                        name: newRole.trim(),
                        color: newRoleColor,
                        badgeKey: newBadge,
                        profileBgKey: newBg,
                        hoist: true,
                        permissions: ['VIEW_CHANNELS', 'SEND_MESSAGES', 'ADD_REACTIONS'],
                      })
                      .then(() => {
                        setNewRole('');
                        reloadRoles();
                        setMsg('Rol oluşturuldu');
                      })
                      .catch((e) =>
                        setError(e instanceof Error ? e.message : 'Rol oluşturulamadı'),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  <Text style={primaryBtnText}>Rol oluştur</Text>
                </Pressable>
                {roles.map((r) => (
                  <View
                    key={r.id}
                    style={{
                      borderBottomWidth: 1,
                      borderBottomColor: colors.surfaceHigh,
                      paddingVertical: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: r.color || newRoleColor,
                        }}
                      />
                      <Text style={{ color: r.color || colors.text, fontWeight: '700', flex: 1 }}>
                        {r.name}
                      </Text>
                      {r.name !== '@everyone' ? (
                        <>
                          <Pressable
                            onPress={() =>
                              setExpandedRoleId((id) => (id === r.id ? null : r.id))
                            }
                          >
                            <Text style={{ color: colors.primary, fontWeight: '600' }}>İzinler</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              Alert.alert('Rol sil', `${r.name} silinsin mi?`, [
                                { text: 'İptal', style: 'cancel' },
                                {
                                  text: 'Sil',
                                  style: 'destructive',
                                  onPress: () =>
                                    void client
                                      .deleteGuildRole(guildId, r.id)
                                      .then(reloadRoles),
                                },
                              ]);
                            }}
                          >
                            <Text style={{ color: colors.danger }}>Sil</Text>
                          </Pressable>
                        </>
                      ) : null}
                    </View>
                    {r.name !== '@everyone' ? (
                      <View style={{ marginTop: 8, gap: 8 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {BADGE_OPTIONS.map((o) => (
                            <Chip
                              key={o.id}
                              label={o.label}
                              selected={(r.badgeKey || 'none') === o.id}
                              onPress={() => {
                                void client
                                  .updateGuildRole(guildId, r.id, { badgeKey: o.id })
                                  .then(reloadRoles);
                              }}
                            />
                          ))}
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {BG_OPTIONS.map((o) => (
                            <Chip
                              key={o.id}
                              label={o.label}
                              selected={(r.profileBgKey || 'none') === o.id}
                              onPress={() => {
                                void client
                                  .updateGuildRole(guildId, r.id, { profileBgKey: o.id })
                                  .then(reloadRoles);
                              }}
                            />
                          ))}
                        </View>
                      </View>
                    ) : null}
                    {expandedRoleId === r.id && r.name !== '@everyone' ? (
                      <View style={{ marginTop: 10, gap: 6 }}>
                        {ROLE_PERMISSIONS.map((p) => {
                          const has = (r.permissions ?? []).includes(p.id);
                          return (
                            <Pressable
                              key={p.id}
                              onPress={() => {
                                const next = has
                                  ? (r.permissions ?? []).filter((x) => x !== p.id)
                                  : [...(r.permissions ?? []), p.id];
                                void client
                                  .updateGuildRole(guildId, r.id, { permissions: next })
                                  .then(reloadRoles);
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                paddingVertical: 4,
                              }}
                            >
                              <Icon
                                name={has ? 'check_box' : 'check_box_outline_blank'}
                                size={20}
                                color={has ? colors.primary : colors.textMuted}
                              />
                              <Text style={{ color: colors.text }}>{p.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'members' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
              Üyeler
            </Text>
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
                            void client
                              .kickGuildMember(guildId, m.id)
                              .then(() => client.getGuildMembers(guildId).then(setMembers)),
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
                            void client
                              .banGuildMember(guildId, m.id)
                              .then(() => client.getGuildMembers(guildId).then(setMembers)),
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

        {tab === 'moderation' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
              Moderasyon
            </Text>
            <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Yasaklar</Text>
            {bans.length === 0 ? (
              <Text style={{ color: colors.textMuted, marginBottom: 16 }}>Yasak yok</Text>
            ) : (
              bans.map((b) => (
                <View
                  key={b.userId}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surfaceHigh,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: colors.text }} numberOfLines={1}>
                      {b.userId}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {b.reason || 'Sebep yok'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      void client.unbanGuildMember(guildId, b.userId).then(reloadModeration)
                    }
                  >
                    <Text style={{ color: colors.primary }}>Kaldır</Text>
                  </Pressable>
                </View>
              ))
            )}
            <Text style={{ color: colors.text, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>
              Denetim kaydı
            </Text>
            {auditLogs.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Kayıt yok</Text>
            ) : (
              auditLogs.map((a) => (
                <View
                  key={a.id}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surfaceHigh,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{a.action}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {new Date(a.createdAt).toLocaleString('tr-TR')}
                  </Text>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'slash' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 8 }}>
              Slash komutları
            </Text>
            <Text style={{ color: colors.textMuted, marginBottom: 12, fontSize: 13 }}>
              Şablonda {'{user}'}, {'{args}'}, {'{command}'} kullanılabilir.
            </Text>
            <TextInput
              value={slashName}
              onChangeText={setSlashName}
              placeholder="komut-adı"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <TextInput
              value={slashDesc}
              onChangeText={setSlashDesc}
              placeholder="Açıklama"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <TextInput
              value={slashUsage}
              onChangeText={setSlashUsage}
              placeholder="Kullanım"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, marginBottom: 8 }}
            />
            <TextInput
              value={slashTemplate}
              onChangeText={setSlashTemplate}
              placeholder="Yanıt şablonu"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <Pressable
              style={[
                primaryBtn,
                {
                  marginBottom: 16,
                  opacity: busy || !slashName.trim() || !slashDesc.trim() ? 0.5 : 1,
                },
              ]}
              disabled={busy || !slashName.trim() || !slashDesc.trim()}
              onPress={() => {
                setBusy(true);
                void client
                  .registerGuildSlashCommand(guildId, {
                    name: slashName.trim(),
                    description: slashDesc.trim(),
                    usage: slashUsage.trim() || undefined,
                    responseTemplate: slashTemplate.trim() || undefined,
                  })
                  .then(() => {
                    setSlashName('');
                    setSlashDesc('');
                    setSlashUsage('');
                    setSlashTemplate('');
                    reloadSlash();
                    setMsg('Komut eklendi');
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : 'Komut kaydedilemedi'))
                  .finally(() => setBusy(false));
              }}
            >
              <Text style={primaryBtnText}>Komut ekle</Text>
            </Pressable>
            {slashCommands.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Henüz özel komut yok.</Text>
            ) : (
              slashCommands.map((c) => (
                <View
                  key={c.id}
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surfaceHigh,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>/{c.name}</Text>
                    <Text style={{ color: colors.text }} numberOfLines={1}>
                      {c.description}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      void client
                        .deleteGuildSlashCommand(guildId, c.id)
                        .then(reloadSlash)
                        .catch((e) =>
                          setError(e instanceof Error ? e.message : 'Silinemedi'),
                        )
                    }
                  >
                    <Text style={{ color: colors.danger }}>Sil</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'invite' && (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18, marginBottom: 12 }}>
              Davet
            </Text>
            <Pressable
              style={primaryBtn}
              onPress={() => {
                void client
                  .createInvite(guildId)
                  .then(setInvite)
                  .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
              }}
            >
              <Text style={primaryBtnText}>Davet oluştur</Text>
            </Pressable>
            {invite ? (
              <Text selectable style={{ color: colors.primary, marginTop: 16 }}>
                {invite.url || `https://dracord.com.tr/invite/${invite.code}`}
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

      <CreateChannelSheet
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        categories={categories}
        onSubmit={async (data) => {
          await client.createChannel(guildId, {
            name: data.name,
            type: data.type,
            categoryId: data.categoryId,
            gameKind: data.gameKind,
          });
          reloadChannels();
          setMsg('Kanal oluşturuldu');
        }}
      />
      <CreateCategorySheet
        open={createCategoryOpen}
        onClose={() => setCreateCategoryOpen(false)}
        onSubmit={async (catName) => {
          await client.createGuildCategory(guildId, catName);
          reloadChannels();
          setMsg('Kategori oluşturuldu');
        }}
      />
    </View>
  );
}
