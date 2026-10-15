import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import type {
  ClientSettings,
  DmPrivacyLevel,
  MessageBookmarkDto,
  PresenceStatus,
  SocialLinks,
} from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { uploadImageFromUri } from '../../lib/uploadMobile';
import { inputStyle, primaryBtn, primaryBtnText } from '../../lib/ui';
import { resetMobileAppTour, startMobileAppTour } from '../../components/AppTour';
import { ShellHeader } from '../../components/shell/AppShell';
import { Icon } from '../../components/Icon';
import { UserAvatar } from '../../components/UserAvatar';

const SOCIAL_FIELDS: Array<{ key: keyof SocialLinks; label: string }> = [
  { key: 'website', label: 'Website' },
  { key: 'twitter', label: 'X / Twitter' },
  { key: 'github', label: 'GitHub' },
  { key: 'discord', label: 'Discord' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'twitch', label: 'Twitch' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'steam', label: 'Steam' },
  { key: 'spotify', label: 'Spotify' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'facebook', label: 'Facebook' },
];

type Tab =
  | 'account'
  | 'profile'
  | 'password'
  | 'account-status'
  | 'privacy'
  | 'messaging'
  | 'bookmarks'
  | 'notifications'
  | 'nitro'
  | 'boost'
  | 'subscriptions'
  | 'gifts'
  | 'voice'
  | 'appearance'
  | 'accessibility'
  | 'system'
  | 'language'
  | 'developer'
  | 'privacy-policy'
  | 'terms'
  | 'kvkk'
  | 'cookies';

type NavItem = { id: Tab; label: string; icon: string };
type NavSection = { id: string; title?: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    id: 'account',
    title: 'Hesap',
    items: [
      { id: 'account', label: 'Hesap Bilgileri', icon: 'person' },
      { id: 'profile', label: 'Profil', icon: 'badge' },
      { id: 'password', label: 'Şifre', icon: 'lock' },
      { id: 'account-status', label: 'Hesap Durumu', icon: 'manage_accounts' },
      { id: 'privacy', label: 'Gizlilik', icon: 'shield' },
      { id: 'messaging', label: 'Mesajlaşma', icon: 'forum' },
      { id: 'bookmarks', label: 'Yer İmleri', icon: 'bookmark' },
      { id: 'notifications', label: 'Bildirimler', icon: 'notifications' },
    ],
  },
  {
    id: 'billing',
    title: 'Faturalandırma',
    items: [
      { id: 'nitro', label: 'Nitro', icon: 'workspace_premium' },
      { id: 'boost', label: 'Sunucu Takviyesi', icon: 'diamond' },
      { id: 'subscriptions', label: 'Abonelikler', icon: 'receipt_long' },
      { id: 'gifts', label: 'Hediyeler', icon: 'card_giftcard' },
    ],
  },
  {
    id: 'experience',
    title: 'Deneyim',
    items: [
      { id: 'voice', label: 'Ses', icon: 'mic' },
      { id: 'appearance', label: 'Görünüm', icon: 'palette' },
      { id: 'accessibility', label: 'Erişilebilirlik', icon: 'accessibility_new' },
      { id: 'system', label: 'Sistem', icon: 'dns' },
      { id: 'language', label: 'Dil', icon: 'language' },
    ],
  },
  {
    id: 'developer',
    title: 'Geliştirici',
    items: [{ id: 'developer', label: 'Gelişmiş', icon: 'code' }],
  },
  {
    id: 'other',
    items: [
      { id: 'privacy-policy', label: 'Gizlilik Politikası', icon: 'policy' },
      { id: 'terms', label: 'Kullanım Şartları', icon: 'gavel' },
      { id: 'kvkk', label: 'KVKK', icon: 'verified_user' },
      { id: 'cookies', label: 'Çerezler', icon: 'cookie' },
    ],
  },
];

const STARTUP_KEY = 'dracord.mobile.startup';
const TAB_LABEL = Object.fromEntries(
  NAV.flatMap((s) => s.items.map((i) => [i.id, i.label])),
) as Record<Tab, string>;

const DM_OPTIONS: { value: DmPrivacyLevel; label: string }[] = [
  { value: 'everyone', label: 'Herkes' },
  { value: 'friends', label: 'Arkadaşlar' },
  { value: 'nobody', label: 'Kimse' },
];

const STATUS_OPTIONS: { value: PresenceStatus; label: string }[] = [
  { value: 'ONLINE', label: 'Çevrimiçi' },
  { value: 'IDLE', label: 'Boşta' },
  { value: 'DND', label: 'Rahatsız etme' },
  { value: 'OFFLINE', label: 'Görünmez (başkalarına çevrimdışı)' },
];

export default function SettingsScreen() {
  const { user, logout, client, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('account');
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [usernameOk, setUsernameOk] = useState<boolean | null>(null);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [accentColor, setAccentColor] = useState(user?.accentColor ?? user?.bannerColor ?? '#bd93f9');
  const [social, setSocial] = useState<Record<keyof SocialLinks, string>>(() => {
    const o = {} as Record<keyof SocialLinks, string>;
    for (const f of SOCIAL_FIELDS) o[f.key] = '';
    return o;
  });
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startup, setStartup] = useState(false);
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [bookmarks, setBookmarks] = useState<MessageBookmarkDto[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STARTUP_KEY).then((v) => setStartup(v === '1'));
    void client.getClientSettings().then(setSettings).catch(() => undefined);
  }, [client]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setUsername(user.username);
    setUsernameOk(null);
    setBio(user.bio ?? '');
    setAccentColor(user.accentColor ?? user.bannerColor ?? '#bd93f9');
    setCustomStatus(user.customStatus ?? '');
    const next = {} as Record<keyof SocialLinks, string>;
    for (const f of SOCIAL_FIELDS) next[f.key] = user.socialLinks?.[f.key] ?? '';
    setSocial(next);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (normalized.length < 2) {
      setUsernameOk(null);
      return;
    }
    if (normalized === user.username) {
      setUsernameOk(true);
      return;
    }
    const t = setTimeout(() => {
      void client
        .checkUsernameAvailable(normalized)
        .then((r) => setUsernameOk(r.available))
        .catch(() => setUsernameOk(null));
    }, 300);
    return () => clearTimeout(t);
  }, [username, user, client]);

  useEffect(() => {
    if (tab !== 'bookmarks') return;
    void client
      .listBookmarks(40)
      .then(setBookmarks)
      .catch(() => setBookmarks([]));
  }, [tab, client]);

  const patchSettings = (patch: Partial<ClientSettings>) => {
    void client
      .updateClientSettings(patch)
      .then((next) => {
        setSettings(next);
        setMsg('Ayarlar kaydedildi');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Kayıt başarısız'));
  };

  const selectTab = (id: Tab) => {
    setTab(id);
    setMenuOpen(false);
    setMsg(null);
    setError(null);
  };

  const pickAndUpload = async (kind: 'avatar' | 'banner') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Galeri izni gerekli');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
      aspect: kind === 'avatar' ? [1, 1] : [16, 9],
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadImageFromUri(
        client,
        asset.uri,
        asset.fileName ?? `${kind}.jpg`,
        asset.mimeType ?? 'image/jpeg',
        kind === 'avatar' ? 'avatars' : 'banners',
      );
      await client.updateProfile(
        kind === 'avatar' ? { avatarUrl: uploaded.url } : { bannerUrl: uploaded.url },
      );
      setMsg(kind === 'avatar' ? 'Avatar güncellendi' : 'Banner güncellendi');
      void refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Ayarlar" />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceHigh,
          gap: 8,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable
          onPress={() => setMenuOpen(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.surfaceHigh,
          }}
          accessibilityLabel="Ayar menüsü"
        >
          <Icon name="menu" size={20} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Menü</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }} numberOfLines={1}>
          {TAB_LABEL[tab] ?? 'Ayarlar'}
        </Text>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Kapat">
          <Icon name="close" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
        {msg ? <Text style={{ color: colors.success, marginBottom: 8 }}>{msg}</Text> : null}

        {tab === 'account' && (
          <>
            <H1>Hesap Bilgileri</H1>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <UserAvatar displayName={user?.displayName ?? '?'} imageUrl={user?.avatarUrl} size={56} status={user?.status} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{user?.displayName}</Text>
                <Text style={{ color: colors.textMuted }}>@{user?.username}</Text>
              </View>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              2FA: {user?.twoFactorEnabled ? 'Açık' : 'Kapalı — web’den etkinleştirilebilir'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <Switch
                value={startup}
                onValueChange={(v) => {
                  setStartup(v);
                  void AsyncStorage.setItem(STARTUP_KEY, v ? '1' : '0');
                }}
              />
              <Text style={{ color: colors.text }}>Açılışta oturumu hatırla</Text>
            </View>
            <Pressable
              style={{ ...primaryBtn, backgroundColor: colors.surfaceHigh, marginTop: 16 }}
              onPress={() => void resetMobileAppTour().then(() => startMobileAppTour())}
            >
              <Text style={{ ...primaryBtnText, color: colors.text }}>Uygulama turunu başlat</Text>
            </Pressable>
            <Pressable
              style={{ ...primaryBtn, backgroundColor: colors.danger, marginTop: 12 }}
              onPress={() => void logout().then(() => router.replace('/(auth)/login'))}
            >
              <Text style={{ ...primaryBtnText, color: '#fff' }}>Çıkış yap</Text>
            </Pressable>
          </>
        )}

        {tab === 'profile' && (
          <>
            <H1>Profil</H1>
            <View
              style={{
                height: 96,
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: accentColor || colors.surfaceHigh,
                marginBottom: 12,
              }}
            >
              {resolveMediaUrl(user?.bannerUrl) ? (
                <Image
                  source={{ uri: resolveMediaUrl(user?.bannerUrl)! }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <UserAvatar
                displayName={displayName || user?.displayName || '?'}
                imageUrl={user?.avatarUrl}
                size={64}
                status={user?.status}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{displayName || user?.displayName}</Text>
                <Text style={{ color: colors.textMuted }}>@{username || user?.username}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <Pressable
                style={{ ...primaryBtn, flex: 1, backgroundColor: colors.surfaceHigh }}
                disabled={uploading}
                onPress={() => void pickAndUpload('avatar')}
              >
                <Text style={{ ...primaryBtnText, color: colors.text }}>
                  {uploading ? '…' : 'Avatar'}
                </Text>
              </Pressable>
              <Pressable
                style={{ ...primaryBtn, flex: 1, backgroundColor: colors.surfaceHigh }}
                disabled={uploading}
                onPress={() => void pickAndUpload('banner')}
              >
                <Text style={{ ...primaryBtnText, color: colors.text }}>Banner</Text>
              </Pressable>
            </View>
            <Label>Görünen ad</Label>
            <TextInput value={displayName} onChangeText={setDisplayName} style={{ ...inputStyle, marginBottom: 12 }} />
            <Label>Kullanıcı adı</Label>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              style={{ ...inputStyle, marginBottom: 4 }}
            />
            {usernameOk === false ? (
              <Text style={{ color: colors.danger, fontSize: 12, marginBottom: 12 }}>
                Bu kullanıcı adı alınmış
              </Text>
            ) : usernameOk === true && username !== user?.username ? (
              <Text style={{ color: colors.success, fontSize: 12, marginBottom: 12 }}>
                Kullanıcı adı müsait
              </Text>
            ) : (
              <View style={{ height: 12, marginBottom: 12 }} />
            )}
            <Label>Bio</Label>
            <TextInput
              value={bio}
              onChangeText={(v) => setBio(v.slice(0, 190))}
              multiline
              maxLength={190}
              style={{ ...inputStyle, height: 88, textAlignVertical: 'top', paddingVertical: 10, marginBottom: 4 }}
            />
            <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 12 }}>
              {bio.length}/190
            </Text>
            <Label>Vurgu rengi</Label>
            <TextInput
              value={accentColor}
              onChangeText={setAccentColor}
              autoCapitalize="none"
              placeholder="#bd93f9"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, marginBottom: 16 }}
            />
            <H1>Sosyal bağlantılar</H1>
            {SOCIAL_FIELDS.map((f) => (
              <View key={f.key} style={{ marginBottom: 10 }}>
                <Label>{f.label}</Label>
                <TextInput
                  value={social[f.key]}
                  onChangeText={(v) => setSocial((prev) => ({ ...prev, [f.key]: v }))}
                  autoCapitalize="none"
                  placeholderTextColor={colors.textMuted}
                  style={inputStyle}
                />
              </View>
            ))}
            <Pressable
              style={{ ...primaryBtn, marginTop: 8 }}
              onPress={() => {
                setError(null);
                const normalized = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
                if (normalized !== user?.username && usernameOk === false) {
                  setError('Kullanıcı adı müsait değil');
                  return;
                }
                const links: SocialLinks = {};
                for (const f of SOCIAL_FIELDS) {
                  const v = social[f.key].trim();
                  if (v) links[f.key] = v;
                }
                void client
                  .updateProfile({
                    displayName: displayName.trim(),
                    bio: bio.slice(0, 190),
                    accentColor: accentColor.trim() || null,
                    bannerColor: accentColor.trim() || null,
                    socialLinks: links,
                  })
                  .then(async () => {
                    if (normalized.length >= 2 && normalized !== user?.username) {
                      await client.confirmUsername(normalized);
                    }
                    setMsg('Profil güncellendi');
                    void refreshUser();
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
              }}
            >
              <Text style={primaryBtnText}>Kaydet</Text>
            </Pressable>
          </>
        )}

        {tab === 'password' && (
          <>
            <H1>Şifre</H1>
            <Label>Mevcut şifre</Label>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <Label>Yeni şifre</Label>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <Pressable
              style={primaryBtn}
              onPress={() => {
                if (!currentPassword || newPassword.length < 8) {
                  setError('Yeni şifre en az 8 karakter olmalı');
                  return;
                }
                void client
                  .changePassword(currentPassword, newPassword)
                  .then(() => {
                    setMsg('Şifre güncellendi');
                    setCurrentPassword('');
                    setNewPassword('');
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : 'Şifre değiştirilemedi'));
              }}
            >
              <Text style={primaryBtnText}>Şifreyi güncelle</Text>
            </Pressable>
          </>
        )}

        {tab === 'account-status' && (
          <>
            <H1>Hesap Durumu</H1>
            <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
              Kullanıcı adı onayı:{' '}
              {user?.usernameConfirmed === false ? 'Beklemede' : 'Onaylı'}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 8, lineHeight: 20 }}>
              Platform admin: {user?.isPlatformAdmin ? 'Evet' : 'Hayır'}
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 8, lineHeight: 20, marginBottom: 12 }}>
              2FA: {user?.twoFactorEnabled ? 'Aktif' : 'Kapalı — web’den etkinleştirilebilir'}
            </Text>
            <Label>Durum</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {STATUS_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  active={user?.status === o.value}
                  onPress={() => {
                    void client
                      .updatePresence({ status: o.value, customStatus: customStatus || null })
                      .then(() => {
                        setMsg('Durum güncellendi');
                        void refreshUser();
                      })
                      .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
                  }}
                />
              ))}
            </View>
            <Label>Özel durum</Label>
            <TextInput
              value={customStatus}
              onChangeText={setCustomStatus}
              placeholder="Ne yapıyorsun?"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <Pressable
              style={{ ...primaryBtn, backgroundColor: colors.surfaceHigh, marginBottom: 20 }}
              onPress={() => {
                void client
                  .updatePresence({
                    status: user?.status ?? 'ONLINE',
                    customStatus: customStatus.trim() || null,
                  })
                  .then(() => {
                    setMsg('Özel durum kaydedildi');
                    void refreshUser();
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
              }}
            >
              <Text style={{ ...primaryBtnText, color: colors.text }}>Özel durumu kaydet</Text>
            </Pressable>
            <H1>Devre dışı bırak</H1>
            <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: 8 }}>
              Hesap silinmez; erişim kesilir. Yeniden etkinleştirme destek üzerinden yapılır.
            </Text>
            <Label>Şifre (varsa)</Label>
            <TextInput
              value={deactivatePassword}
              onChangeText={setDeactivatePassword}
              secureTextEntry
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <Pressable
              style={{ ...primaryBtn, backgroundColor: colors.danger }}
              onPress={() => {
                Alert.alert('Hesabı devre dışı bırak', 'Oturum kapanacak. Emin misin?', [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Onayla',
                    style: 'destructive',
                    onPress: () => {
                      void client
                        .deactivateAccount(deactivatePassword || undefined)
                        .then(() => logout())
                        .then(() => router.replace('/(auth)/login'))
                        .catch((e) =>
                          setError(e instanceof Error ? e.message : 'İşlem başarısız'),
                        );
                    },
                  },
                ]);
              }}
            >
              <Text style={{ ...primaryBtnText, color: '#fff' }}>Hesabı devre dışı bırak</Text>
            </Pressable>
          </>
        )}

        {tab === 'privacy' && settings && (
          <>
            <H1>Gizlilik</H1>
            <Label>Direkt mesaj filtresi</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {DM_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  active={settings.privacy.dmFilter === o.value}
                  onPress={() =>
                    patchSettings({
                      privacy: { ...settings.privacy, dmFilter: o.value },
                      messaging: { ...settings.messaging, whoCanDm: o.value },
                    })
                  }
                />
              ))}
            </View>
            <ToggleRow
              label="Arkadaşlık isteklerine izin ver"
              value={settings.privacy.allowFriendRequests}
              onChange={(v) =>
                patchSettings({ privacy: { ...settings.privacy, allowFriendRequests: v } })
              }
            />
            <ToggleRow
              label="Aktivite durumunu paylaş"
              value={settings.privacy.shareActivityStatus}
              onChange={(v) =>
                patchSettings({ privacy: { ...settings.privacy, shareActivityStatus: v } })
              }
            />
            <ToggleRow
              label="Biyografiyi göster"
              value={settings.privacy.showBio !== false}
              onChange={(v) => patchSettings({ privacy: { ...settings.privacy, showBio: v } })}
            />
            <ToggleRow
              label="Sosyal linkleri göster"
              value={settings.privacy.showSocialLinks !== false}
              onChange={(v) =>
                patchSettings({ privacy: { ...settings.privacy, showSocialLinks: v } })
              }
            />
            <ToggleRow
              label="Banner göster"
              value={settings.privacy.showBanner !== false}
              onChange={(v) => patchSettings({ privacy: { ...settings.privacy, showBanner: v } })}
            />
            <ToggleRow
              label="Özel durumu göster"
              value={settings.privacy.showCustomStatus !== false}
              onChange={(v) =>
                patchSettings({ privacy: { ...settings.privacy, showCustomStatus: v } })
              }
            />
            <ToggleRow
              label="Veri toplamaya izin ver"
              value={settings.privacy.dataCollection}
              onChange={(v) =>
                patchSettings({ privacy: { ...settings.privacy, dataCollection: v } })
              }
            />
            <ToggleRow
              label="Link önizleme sansürü"
              value={Boolean(user?.censorLinkPreviews)}
              onChange={(v) => {
                void client.updateProfile({ censorLinkPreviews: v }).then(() => {
                  setMsg('Güncellendi');
                  void refreshUser();
                });
              }}
            />
            {settings.activity ? (
              <>
                <H1>Aktivite</H1>
                <ToggleRow
                  label="Aktiviteyi göster"
                  value={settings.activity.displayActivity}
                  onChange={(v) =>
                    patchSettings({ activity: { ...settings.activity, displayActivity: v } })
                  }
                />
                <ToggleRow
                  label="Oyunları paylaş"
                  value={settings.activity.shareGames}
                  onChange={(v) =>
                    patchSettings({ activity: { ...settings.activity, shareGames: v } })
                  }
                />
                <ToggleRow
                  label="Katılma isteklerine izin ver"
                  value={settings.activity.allowJoinRequests}
                  onChange={(v) =>
                    patchSettings({ activity: { ...settings.activity, allowJoinRequests: v } })
                  }
                />
              </>
            ) : null}
          </>
        )}

        {tab === 'messaging' && settings && (
          <>
            <H1>Mesajlaşma</H1>
            <Label>Kimler DM atabilir</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {DM_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  label={o.label}
                  active={settings.messaging.whoCanDm === o.value}
                  onPress={() =>
                    patchSettings({
                      messaging: { ...settings.messaging, whoCanDm: o.value },
                      privacy: { ...settings.privacy, dmFilter: o.value },
                    })
                  }
                />
              ))}
            </View>
            <ToggleRow
              label="Otomatik gömülü önizleme"
              value={settings.messaging.autoEmbed}
              onChange={(v) =>
                patchSettings({ messaging: { ...settings.messaging, autoEmbed: v } })
              }
            />
            <ToggleRow
              label="Açık içeriği filtrele"
              value={settings.messaging.filterExplicit}
              onChange={(v) =>
                patchSettings({ messaging: { ...settings.messaging, filterExplicit: v } })
              }
            />
            <ToggleRow
              label="Yazım denetimi"
              value={settings.messaging.spellcheck}
              onChange={(v) =>
                patchSettings({ messaging: { ...settings.messaging, spellcheck: v } })
              }
            />
          </>
        )}

        {tab === 'bookmarks' && (
          <>
            <H1>Yer İmleri</H1>
            {bookmarks.length === 0 ? (
              <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
                Henüz yer imi yok. Mesaj menüsünden ekleyebilirsin.
              </Text>
            ) : (
              bookmarks.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    if (b.guildId) {
                      router.push(`/(app)/channels/${b.guildId}/${b.channelId}`);
                    }
                  }}
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.surfaceHigh,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                    #{b.channelName ?? 'kanal'}
                  </Text>
                  <Text style={{ color: colors.text }} numberOfLines={3}>
                    {b.message.content || '(ek / gömülü)'}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        )}

        {tab === 'notifications' && settings && (
          <>
            <H1>Bildirimler</H1>
            <ToggleRow
              label="Push bildirimleri"
              value={settings.notifications.pushEnabled !== false}
              onChange={(v) =>
                patchSettings({
                  notifications: { ...settings.notifications, pushEnabled: v },
                })
              }
            />
            <ToggleRow
              label="Masaüstü / cihaz bildirimleri"
              value={settings.notifications.desktopEnabled}
              onChange={(v) =>
                patchSettings({
                  notifications: { ...settings.notifications, desktopEnabled: v },
                })
              }
            />
            <ToggleRow
              label="Sesli bildirim"
              value={settings.notifications.soundEnabled}
              onChange={(v) =>
                patchSettings({
                  notifications: { ...settings.notifications, soundEnabled: v },
                })
              }
            />
            <ToggleRow
              label="Okunmamış rozeti"
              value={settings.notifications.unreadBadge}
              onChange={(v) =>
                patchSettings({
                  notifications: { ...settings.notifications, unreadBadge: v },
                })
              }
            />
            <ToggleRow
              label="Yalnızca bahsetmeler"
              value={settings.notifications.mentionsOnly}
              onChange={(v) =>
                patchSettings({
                  notifications: { ...settings.notifications, mentionsOnly: v },
                })
              }
            />
            <ToggleRow
              label="Sessiz saatler"
              value={settings.notifications.quietHours}
              onChange={(v) =>
                patchSettings({
                  notifications: { ...settings.notifications, quietHours: v },
                })
              }
            />
            <Pressable
              style={{ ...primaryBtn, marginTop: 12, backgroundColor: colors.surfaceHigh }}
              onPress={() => router.push('/(app)/notifications')}
            >
              <Text style={{ ...primaryBtnText, color: colors.text }}>Bildirim merkezini aç</Text>
            </Pressable>
          </>
        )}

        {(tab === 'nitro' || tab === 'boost' || tab === 'subscriptions' || tab === 'gifts') && (
          <>
            <H1>{TAB_LABEL[tab]}</H1>
            <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: 12 }}>
              Abonelik ve hediye yönetimi web istemcisinden yapılır.
            </Text>
            <Pressable
              style={primaryBtn}
              onPress={() =>
                void Linking.openURL(
                  `https://dracord.com.tr/settings/${tab === 'boost' ? 'boost' : tab}`,
                )
              }
            >
              <Text style={primaryBtnText}>Web’de yönet</Text>
            </Pressable>
          </>
        )}

        {tab === 'voice' && (
          <>
            <H1>Ses</H1>
            <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: 12 }}>
              Mikrofon, sağırlaştırma, kamera, kamera döndürme ve ekran paylaşımı ses odası alt
              şeridinden yönetilir. Uygulama arka plana alındığında ses oturumu bildirim /
              foreground service ile sürdürülür.
            </Text>
            <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
              Aynı anda yalnızca bir istemciden ses yayınlanır. Başka sunuculara göz gezdirirken
              mevcut ses bağlantın korunur; yeni bir ses kanalına katılana kadar ayrılmazsın.
            </Text>
          </>
        )}

        {tab === 'appearance' && settings && (
          <>
            <H1>Görünüm</H1>
            <Label>Tema tercihi</Label>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Chip
                label="Koyu"
                active={settings.appearance.theme === 'dark'}
                onPress={() =>
                  patchSettings({ appearance: { ...settings.appearance, theme: 'dark' } })
                }
              />
              <Chip
                label="Açık"
                active={settings.appearance.theme === 'light'}
                onPress={() =>
                  patchSettings({ appearance: { ...settings.appearance, theme: 'light' } })
                }
              />
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
              Mobil istemci şu an koyu temayı kullanır; tercih diğer platformlarla senkron tutulur.
            </Text>
            <ToggleRow
              label="Kompakt mesaj yoğunluğu"
              value={settings.appearance.messageDensity === 'compact'}
              onChange={(v) =>
                patchSettings({
                  appearance: {
                    ...settings.appearance,
                    messageDensity: v ? 'compact' : 'cozy',
                  },
                })
              }
            />
          </>
        )}

        {tab === 'accessibility' && settings && (
          <>
            <H1>Erişilebilirlik</H1>
            <ToggleRow
              label="Azaltılmış hareket"
              value={settings.accessibility.reducedMotion}
              onChange={(v) =>
                patchSettings({
                  accessibility: { ...settings.accessibility, reducedMotion: v },
                })
              }
            />
            <ToggleRow
              label="Yüksek kontrast"
              value={settings.accessibility.highContrast}
              onChange={(v) =>
                patchSettings({
                  accessibility: { ...settings.accessibility, highContrast: v },
                })
              }
            />
            <ToggleRow
              label="Mesaj gruplama"
              value={settings.accessibility.messageGrouping}
              onChange={(v) =>
                patchSettings({
                  accessibility: { ...settings.accessibility, messageGrouping: v },
                })
              }
            />
            <ToggleRow
              label="Linklerin altını çiz"
              value={settings.accessibility.underlineLinks}
              onChange={(v) =>
                patchSettings({
                  accessibility: { ...settings.accessibility, underlineLinks: v },
                })
              }
            />
            <ToggleRow
              label="Rol renkleri"
              value={settings.accessibility.roleColors}
              onChange={(v) =>
                patchSettings({
                  accessibility: { ...settings.accessibility, roleColors: v },
                })
              }
            />
          </>
        )}

        {tab === 'system' && settings && (
          <>
            <H1>Sistem</H1>
            <ToggleRow
              label="Açılışta oturumu hatırla"
              value={startup}
              onChange={(v) => {
                setStartup(v);
                void AsyncStorage.setItem(STARTUP_KEY, v ? '1' : '0');
              }}
            />
            <ToggleRow
              label="Otomatik güncelleme tercihi"
              value={settings.system.autoUpdate}
              onChange={(v) => patchSettings({ system: { ...settings.system, autoUpdate: v } })}
            />
            <Text style={{ color: colors.textMuted, marginTop: 12, lineHeight: 20 }}>
              Uygulama sürümü ve cihaz bildirim izinleri sistem ayarlarından yönetilir.
            </Text>
          </>
        )}

        {tab === 'language' && settings && (
          <>
            <H1>Dil</H1>
            <Label>Arayüz dili</Label>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Chip
                label="Türkçe"
                active={settings.language.locale === 'tr'}
                onPress={() => patchSettings({ language: { ...settings.language, locale: 'tr' } })}
              />
              <Chip
                label="English"
                active={settings.language.locale === 'en'}
                onPress={() => patchSettings({ language: { ...settings.language, locale: 'en' } })}
              />
            </View>
            <ToggleRow
              label="24 saat formatı"
              value={settings.language.hour24}
              onChange={(v) => patchSettings({ language: { ...settings.language, hour24: v } })}
            />
          </>
        )}

        {tab === 'developer' && settings && (
          <>
            <H1>Gelişmiş</H1>
            <ToggleRow
              label="Geliştirici modu"
              value={settings.developer.developerMode}
              onChange={(v) =>
                patchSettings({ developer: { ...settings.developer, developerMode: v } })
              }
            />
            <ToggleRow
              label="Deneysel özellikler"
              value={settings.developer.experimental}
              onChange={(v) =>
                patchSettings({ developer: { ...settings.developer, experimental: v } })
              }
            />
            {settings.developer.developerMode ? (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Kullanıcı ID</Text>
                <Text style={{ color: colors.text, fontFamily: PlatformFont }} selectable>
                  {user?.id ?? '—'}
                </Text>
                <Pressable
                  style={{ ...primaryBtn, backgroundColor: colors.surfaceHigh }}
                  onPress={() => {
                    if (!user?.id) return;
                    void Clipboard.setStringAsync(user.id).then(() => setMsg('ID kopyalandı'));
                  }}
                >
                  <Text style={{ ...primaryBtnText, color: colors.text }}>ID’yi kopyala</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}

        {(tab === 'privacy-policy' || tab === 'terms' || tab === 'kvkk' || tab === 'cookies') && (
          <>
            <H1>{TAB_LABEL[tab]}</H1>
            <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: 12 }}>
              Yasal metinler web’de yayınlanır.
            </Text>
            <Pressable
              style={primaryBtn}
              onPress={() => {
                const path =
                  tab === 'kvkk' || tab === 'cookies'
                    ? `https://dracord.com.tr/legal/${tab}`
                    : `https://dracord.com.tr/settings/${tab}`;
                void Linking.openURL(path);
              }}
            >
              <Text style={primaryBtnText}>Web’de oku</Text>
            </Pressable>
          </>
        )}

        {!settings &&
        [
          'privacy',
          'messaging',
          'notifications',
          'appearance',
          'accessibility',
          'language',
          'developer',
          'system',
        ].includes(tab) ? (
          <Text style={{ color: colors.textMuted }}>Ayarlar yükleniyor…</Text>
        ) : null}
      </ScrollView>

      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          onPress={() => setMenuOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '85%',
              paddingBottom: 24,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.surfaceHigh,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, flex: 1 }}>
                Ayarlar
              </Text>
              <Pressable onPress={() => setMenuOpen(false)} hitSlop={8}>
                <Icon name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 12, gap: 4 }}>
              {NAV.map((section) => (
                <View key={section.id} style={{ marginBottom: 10 }}>
                  {section.title ? (
                    <Text
                      style={{
                        color: colors.textMuted,
                        fontSize: 11,
                        fontWeight: '800',
                        letterSpacing: 0.4,
                        paddingHorizontal: 8,
                        paddingVertical: 8,
                      }}
                    >
                      {section.title.toUpperCase()}
                    </Text>
                  ) : null}
                  {section.items.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => selectTab(item.id)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 12,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: tab === item.id ? colors.surfaceHigh : 'transparent',
                      }}
                    >
                      <Icon
                        name={item.icon}
                        size={20}
                        color={tab === item.id ? colors.primary : colors.textMuted}
                      />
                      <Text
                        style={{
                          color: colors.text,
                          fontWeight: tab === item.id ? '800' : '600',
                          flex: 1,
                        }}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  void logout().then(() => router.replace('/(auth)/login'));
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255,85,85,0.12)',
                  marginTop: 4,
                }}
              >
                <Icon name="logout" size={20} color={colors.danger} />
                <Text style={{ color: colors.danger, fontWeight: '800' }}>Çıkış yap</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const PlatformFont = 'monospace';

function H1({ children }: { children: string }) {
  return (
    <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
      {children}
    </Text>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ color: colors.textMuted, marginBottom: 4 }}>{children}</Text>;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: active ? colors.primary : colors.surfaceHigh,
      }}
    >
      <Text style={{ color: active ? colors.primaryOn : colors.text, fontWeight: '700', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceHigh,
        gap: 12,
      }}
    >
      <Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}
