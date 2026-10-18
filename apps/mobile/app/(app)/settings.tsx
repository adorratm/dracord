import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type {
  ClientSettings,
  DmPrivacyLevel,
  GuildSummary,
  MessageBookmarkDto,
  PresenceStatus,
  SocialLinks,
} from '@dracord/types';
import { guildBoostLevel } from '@dracord/types';
import { colors, setThemeMode } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { getAppLocale, setAppLocale, subscribeLocale, t, type AppLocale } from '../../lib/i18n';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { uploadImageFromUri } from '../../lib/uploadMobile';
import { inputStyle, primaryBtn, primaryBtnText } from '../../lib/ui';
import { resetMobileAppTour, startMobileAppTour } from '../../components/AppTour';
import { confirmDialog } from '../../components/ConfirmModal';
import { ShellHeader } from '../../components/shell/AppShell';
import { Icon } from '../../components/Icon';
import { UserAvatar } from '../../components/UserAvatar';
import { ThemedSwitch } from '../../components/ThemedSwitch';
import { useVoiceSessionOptional } from '../../components/voice/VoiceSession';
import { configureUiTones } from '../../lib/sounds';
import {
  checkAppUpdates,
  getNativeAppVersion,
  promptOtaUpdate,
  promptStoreUpdate,
} from '../../lib/appUpdates';
import * as Updates from 'expo-updates';

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

type NavItem = { id: Tab; labelKey: string; icon: string };
type NavSection = { id: string; titleKey?: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    id: 'account',
    titleKey: 'nav.account',
    items: [
      { id: 'account', labelKey: 'nav.accountInfo', icon: 'person' },
      { id: 'profile', labelKey: 'nav.profile', icon: 'badge' },
      { id: 'password', labelKey: 'nav.password', icon: 'lock' },
      { id: 'account-status', labelKey: 'nav.accountStatus', icon: 'manage_accounts' },
      { id: 'privacy', labelKey: 'nav.privacy', icon: 'shield' },
      { id: 'messaging', labelKey: 'nav.messaging', icon: 'forum' },
      { id: 'bookmarks', labelKey: 'nav.bookmarks', icon: 'bookmark' },
      { id: 'notifications', labelKey: 'nav.notifications', icon: 'notifications' },
    ],
  },
  {
    id: 'billing',
    titleKey: 'nav.billing',
    items: [
      { id: 'nitro', labelKey: 'nav.nitro', icon: 'workspace_premium' },
      { id: 'boost', labelKey: 'nav.boost', icon: 'diamond' },
      { id: 'subscriptions', labelKey: 'nav.subscriptions', icon: 'receipt_long' },
      { id: 'gifts', labelKey: 'nav.gifts', icon: 'card_giftcard' },
    ],
  },
  {
    id: 'experience',
    titleKey: 'nav.experience',
    items: [
      { id: 'voice', labelKey: 'nav.voice', icon: 'mic' },
      { id: 'appearance', labelKey: 'nav.appearance', icon: 'palette' },
      { id: 'accessibility', labelKey: 'nav.accessibility', icon: 'accessibility_new' },
      { id: 'system', labelKey: 'nav.system', icon: 'dns' },
      { id: 'language', labelKey: 'nav.language', icon: 'language' },
    ],
  },
  {
    id: 'developer',
    titleKey: 'nav.developer',
    items: [{ id: 'developer', labelKey: 'nav.advanced', icon: 'code' }],
  },
  {
    id: 'other',
    items: [
      { id: 'privacy-policy', labelKey: 'nav.privacyPolicy', icon: 'policy' },
      { id: 'terms', labelKey: 'nav.terms', icon: 'gavel' },
      { id: 'kvkk', labelKey: 'nav.kvkk', icon: 'verified_user' },
      { id: 'cookies', labelKey: 'nav.cookies', icon: 'cookie' },
    ],
  },
];

const STARTUP_KEY = 'dracord.mobile.startup';
const VALID_TABS = new Set<string>(NAV.flatMap((s) => s.items.map((i) => i.id)));

function tabLabel(id: Tab, locale: AppLocale): string {
  const item = NAV.flatMap((s) => s.items).find((i) => i.id === id);
  return item ? t(item.labelKey, locale) : id;
}

function newLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeGiftCode() {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${part()}-${part()}-${part()}`;
}

function addMonths(isoOrNow: string | null, months: number): string {
  const d = isoOrNow ? new Date(isoOrNow) : new Date();
  if (d.getTime() < Date.now()) d.setTime(Date.now());
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

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
  const params = useLocalSearchParams<{ tab?: string }>();
  const voice = useVoiceSessionOptional();
  const locale = useSyncExternalStore(subscribeLocale, getAppLocale, getAppLocale);
  const [tab, setTab] = useState<Tab>('account');
  const [menuOpen, setMenuOpen] = useState(false);
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [giftCode, setGiftCode] = useState('');
  const [boostBusy, setBoostBusy] = useState<string | null>(null);
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
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startup, setStartup] = useState(false);
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [bookmarks, setBookmarks] = useState<MessageBookmarkDto[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const raw = typeof params.tab === 'string' ? params.tab : Array.isArray(params.tab) ? params.tab[0] : undefined;
    if (raw && VALID_TABS.has(raw)) setTab(raw as Tab);
  }, [params.tab]);

  useEffect(() => {
    void AsyncStorage.getItem(STARTUP_KEY).then((v) => setStartup(v === '1'));
    void client
      .getClientSettings()
      .then((s) => {
        setSettings(s);
        setAppLocale(s.language?.locale === 'en' ? 'en' : 'tr');
        configureUiTones({
          enabled: s.notifications.soundEnabled !== false,
          volume: s.notifications.uiToneVolume ?? 0.85,
        });
      })
      .catch(() => undefined);
    void client.listGuilds().then(setGuilds).catch(() => setGuilds([]));
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

  const { setMode: applyTheme } = useTheme();

  const patchSettings = (patch: Partial<ClientSettings>) => {
    if (patch.appearance?.theme === 'light' || patch.appearance?.theme === 'dark') {
      applyTheme(patch.appearance.theme);
      setThemeMode(patch.appearance.theme);
    }
    if (patch.language?.locale === 'en' || patch.language?.locale === 'tr') {
      setAppLocale(patch.language.locale);
    }
    void client
      .updateClientSettings(patch)
      .then((next) => {
        setSettings(next);
        if (next.appearance?.theme === 'light' || next.appearance?.theme === 'dark') {
          applyTheme(next.appearance.theme);
          setThemeMode(next.appearance.theme);
        }
        if (next.language?.locale === 'en' || next.language?.locale === 'tr') {
          setAppLocale(next.language.locale);
        }
        if (patch.notifications) {
          configureUiTones({
            enabled: next.notifications.soundEnabled !== false,
            volume: next.notifications.uiToneVolume ?? 0.85,
          });
        }
        setMsg(patch.language ? t('lang.saved', next.language?.locale === 'en' ? 'en' : 'tr') : 'Ayarlar kaydedildi');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Kayıt başarısız'));
  };

  const patchBilling = (billing: Partial<ClientSettings['billing']>) => {
    if (!settings) return;
    patchSettings({ billing: { ...settings.billing, ...billing } });
  };

  const navSections = useMemo(
    () =>
      NAV.map((section) => ({
        ...section,
        title: section.titleKey ? t(section.titleKey, locale) : undefined,
        items: section.items.map((item) => ({
          ...item,
          label: t(item.labelKey, locale),
        })),
      })),
    [locale],
  );

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
          {tabLabel(tab, locale)}
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
              <ThemedSwitch
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
                void confirmDialog({
                  title: 'Hesabı devre dışı bırak',
                  message: 'Oturum kapanacak. Emin misin?',
                  confirmLabel: 'Onayla',
                  destructive: true,
                }).then((ok) => {
                  if (!ok) return;
                  void client
                    .deactivateAccount(deactivatePassword || undefined)
                    .then(() => logout())
                    .then(() => router.replace('/(auth)/login'))
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : 'İşlem başarısız'),
                    );
                });
              }}
            >
              <Text style={{ ...primaryBtnText, color: '#fff' }}>Hesabı devre dışı bırak</Text>
            </Pressable>

            <H1>Hesabı kalıcı sil</H1>
            <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: 8 }}>
              Geri alınamaz. Sahip olduğun sunucuları önce sil veya sahipliği devret. Onay
              için SİL yaz.
            </Text>
            <Label>Onay (SİL)</Label>
            <TextInput
              value={deletePhrase}
              onChangeText={setDeletePhrase}
              autoCapitalize="characters"
              placeholder="SİL"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <Label>Şifre (şifreli hesaplarda zorunlu)</Label>
            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              style={{ ...inputStyle, marginBottom: 12 }}
            />
            <Pressable
              style={{ ...primaryBtn, backgroundColor: colors.danger }}
              onPress={() => {
                void confirmDialog({
                  title: 'Hesabı kalıcı sil',
                  message: 'Tüm verilerin silinir. Bu işlem geri alınamaz.',
                  confirmLabel: 'Kalıcı sil',
                  destructive: true,
                }).then((ok) => {
                  if (!ok) return;
                  void client
                    .deleteAccount({
                      password: deletePassword || undefined,
                      confirm: deletePhrase,
                    })
                    .then(() => logout())
                    .then(() => router.replace('/(auth)/login'))
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : 'Silme başarısız'),
                    );
                });
              }}
            >
              <Text style={{ ...primaryBtnText, color: '#fff' }}>Hesabımı kalıcı sil</Text>
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
                  label="Spotify dinlemeyi paylaş"
                  value={settings.activity.shareSpotify !== false}
                  onChange={(v) =>
                    patchSettings({ activity: { ...settings.activity, shareSpotify: v } })
                  }
                />
                <ToggleRow
                  label="Katılma isteklerine izin ver"
                  value={settings.activity.allowJoinRequests}
                  onChange={(v) =>
                    patchSettings({ activity: { ...settings.activity, allowJoinRequests: v } })
                  }
                />
                <SpotifyConnectBlock client={client} />
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
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontSize: 15 }}>Ses kanalı bildirim sesi</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                  {Math.round((settings.notifications.uiToneVolume ?? 0.85) * 100)}%
                </Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                Katılma / ayrılma tonlarının yüksekliği
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {[0.25, 0.5, 0.7, 0.85, 1].map((v) => (
                  <Pressable
                    key={v}
                    disabled={!settings.notifications.soundEnabled}
                    onPress={() =>
                      patchSettings({
                        notifications: { ...settings.notifications, uiToneVolume: v },
                      })
                    }
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor:
                        Math.abs((settings.notifications.uiToneVolume ?? 0.85) - v) < 0.01
                          ? colors.primary
                          : colors.surfaceHigh,
                      opacity: settings.notifications.soundEnabled ? 1 : 0.4,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          Math.abs((settings.notifications.uiToneVolume ?? 0.85) - v) < 0.01
                            ? colors.primaryOn
                            : colors.text,
                        fontWeight: '600',
                        fontSize: 12,
                      }}
                    >
                      {Math.round(v * 100)}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
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

        {tab === 'nitro' && settings && (
          <>
            <H1>{tabLabel('nitro', locale)}</H1>
            <Text style={{ color: colors.textMuted, marginBottom: 12, lineHeight: 20 }}>
              Demo abonelik — gerçek ödeme alınmaz; hesabına kaydedilir.
            </Text>
            <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>
              Plan:{' '}
              {settings.billing.nitroPlan === 'none'
                ? 'Yok'
                : settings.billing.nitroPlan === 'basic'
                  ? 'Nitro Basic'
                  : 'Nitro'}
            </Text>
            {settings.billing.nitroExpiresAt ? (
              <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
                Bitiş: {new Date(settings.billing.nitroExpiresAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'tr-TR')}
              </Text>
            ) : null}
            {settings.billing.nitroPlan !== 'none' ? (
              <Pressable
                style={{ ...primaryBtn, backgroundColor: colors.surfaceHigh, marginBottom: 12 }}
                onPress={() => patchBilling({ nitroPlan: 'none', nitroExpiresAt: null })}
              >
                <Text style={{ ...primaryBtnText, color: colors.text }}>Aboneliği iptal et</Text>
              </Pressable>
            ) : null}
            <View style={{ gap: 10 }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.surfaceHigh }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>Nitro Basic</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 }}>
                  Özel emoji · daha büyük yükleme · animasyonlu avatar
                </Text>
                <Pressable
                  style={{ ...primaryBtn, marginTop: 10, opacity: settings.billing.nitroPlan === 'basic' ? 0.5 : 1 }}
                  disabled={settings.billing.nitroPlan === 'basic'}
                  onPress={() =>
                    patchBilling({
                      nitroPlan: 'basic',
                      nitroExpiresAt: addMonths(settings.billing.nitroExpiresAt, 1),
                      invoices: [
                        {
                          id: newLocalId('inv'),
                          label: 'Nitro Basic (demo)',
                          amount: '₺49',
                          at: new Date().toISOString(),
                        },
                        ...settings.billing.invoices,
                      ].slice(0, 20),
                    })
                  }
                >
                  <Text style={primaryBtnText}>
                    {settings.billing.nitroPlan === 'basic' ? 'Aktif' : 'Etkinleştir (demo)'}
                  </Text>
                </Pressable>
              </View>
              <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.primary }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>Nitro</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 18 }}>
                  Basic + profil teması · +2 takviye kredisi · sticker · uzun mesaj
                </Text>
                <Pressable
                  style={{ ...primaryBtn, marginTop: 10, opacity: settings.billing.nitroPlan === 'nitro' ? 0.5 : 1 }}
                  disabled={settings.billing.nitroPlan === 'nitro'}
                  onPress={() =>
                    patchBilling({
                      nitroPlan: 'nitro',
                      nitroExpiresAt: addMonths(settings.billing.nitroExpiresAt, 1),
                      boostCredits: settings.billing.boostCredits + (settings.billing.nitroPlan === 'nitro' ? 0 : 2),
                      invoices: [
                        {
                          id: newLocalId('inv'),
                          label: 'Nitro (demo)',
                          amount: '₺99',
                          at: new Date().toISOString(),
                        },
                        ...settings.billing.invoices,
                      ].slice(0, 20),
                    })
                  }
                >
                  <Text style={primaryBtnText}>
                    {settings.billing.nitroPlan === 'nitro' ? 'Aktif' : 'Etkinleştir (demo)'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {tab === 'boost' && settings && (
          <>
            <H1>{tabLabel('boost', locale)}</H1>
            <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
              Kredi: {settings.billing.boostCredits}
            </Text>
            <Pressable
              style={{ ...primaryBtn, marginBottom: 16 }}
              onPress={() =>
                patchBilling({
                  boostCredits: settings.billing.boostCredits + 1,
                  invoices: [
                    {
                      id: newLocalId('inv'),
                      label: 'Sunucu takviyesi (demo)',
                      amount: '₺49',
                      at: new Date().toISOString(),
                    },
                    ...settings.billing.invoices,
                  ].slice(0, 20),
                })
              }
            >
              <Text style={primaryBtnText}>+1 kredi satın al (demo)</Text>
            </Pressable>
            {settings.billing.boostAssignments.length > 0 ? (
              <View style={{ marginBottom: 16, gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Atanan takviyeler</Text>
                {settings.billing.boostAssignments.map((a) => (
                  <View
                    key={a.guildId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      backgroundColor: colors.surface,
                      padding: 12,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: colors.text, flex: 1 }}>{a.guildName}</Text>
                    <Pressable
                      onPress={() => {
                        void client
                          .unboostGuild(a.guildId)
                          .then(async () => {
                            const s = await client.getClientSettings();
                            setSettings(s);
                            setGuilds(await client.listGuilds());
                            setMsg('Takviye kaldırıldı');
                          })
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : 'Kaldırılamadı'),
                          );
                      }}
                    >
                      <Text style={{ color: colors.danger, fontWeight: '700' }}>Kaldır</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Sunucular</Text>
            {guilds.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sunucu yok</Text>
            ) : (
              guilds.map((g) => {
                const assigned = settings.billing.boostAssignments.some((a) => a.guildId === g.id);
                const count = g.boostCount ?? 0;
                const level = g.boostLevel ?? guildBoostLevel(count);
                return (
                  <View
                    key={g.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 8,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{g.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Seviye {level} · {count} takviye
                    </Text>
                    <Pressable
                      style={{
                        ...primaryBtn,
                        opacity: assigned || boostBusy === g.id ? 0.5 : 1,
                        height: 36,
                      }}
                      disabled={assigned || boostBusy === g.id}
                      onPress={() => {
                        setBoostBusy(g.id);
                        void client
                          .boostGuild(g.id)
                          .then(async () => {
                            const s = await client.getClientSettings();
                            setSettings(s);
                            setGuilds(await client.listGuilds());
                            setMsg('Takviye uygulandı');
                          })
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : 'Takviye yapılamadı'),
                          )
                          .finally(() => setBoostBusy(null));
                      }}
                    >
                      <Text style={primaryBtnText}>
                        {assigned ? 'Takviye aktif' : 'Bu sunucuya takviye yap'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </>
        )}

        {tab === 'subscriptions' && settings && (
          <>
            <H1>{tabLabel('subscriptions', locale)}</H1>
            {settings.billing.nitroPlan === 'none' &&
            settings.billing.boostAssignments.length === 0 ? (
              <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
                Aktif aboneliğin yok. Nitro veya takviye ekle.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {settings.billing.nitroPlan !== 'none' ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.surface,
                      padding: 12,
                      borderRadius: 10,
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, flex: 1 }}>
                      Nitro {settings.billing.nitroPlan === 'basic' ? 'Basic' : ''} · bitiş{' '}
                      {settings.billing.nitroExpiresAt
                        ? new Date(settings.billing.nitroExpiresAt).toLocaleDateString(
                            locale === 'en' ? 'en-US' : 'tr-TR',
                          )
                        : '—'}
                    </Text>
                    <Pressable
                      onPress={() => patchBilling({ nitroPlan: 'none', nitroExpiresAt: null })}
                    >
                      <Text style={{ color: colors.danger, fontWeight: '700' }}>İptal</Text>
                    </Pressable>
                  </View>
                ) : null}
                {settings.billing.boostAssignments.map((a) => (
                  <View
                    key={a.guildId}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.surface,
                      padding: 12,
                      borderRadius: 10,
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: colors.text, flex: 1 }}>Takviye · {a.guildName}</Text>
                    <Pressable
                      onPress={() => {
                        void client
                          .unboostGuild(a.guildId)
                          .then(async () => {
                            setSettings(await client.getClientSettings());
                            setGuilds(await client.listGuilds());
                          })
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : 'İptal edilemedi'),
                          );
                      }}
                    >
                      <Text style={{ color: colors.danger, fontWeight: '700' }}>İptal</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {settings.billing.invoices.length > 0 ? (
              <View style={{ marginTop: 20, gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>Faturalar</Text>
                {settings.billing.invoices.slice(0, 8).map((inv) => (
                  <Text key={inv.id} style={{ color: colors.textMuted, fontSize: 12 }}>
                    {inv.label} · {inv.amount} ·{' '}
                    {new Date(inv.at).toLocaleDateString(locale === 'en' ? 'en-US' : 'tr-TR')}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        )}

        {tab === 'gifts' && settings && (
          <>
            <H1>{tabLabel('gifts', locale)}</H1>
            <Label>Kod kullan</Label>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TextInput
                value={giftCode}
                onChangeText={setGiftCode}
                placeholder="XXXX-XXXX veya DRACORD-NITRO"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                style={{ ...inputStyle, flex: 1 }}
              />
              <Pressable
                style={{ ...primaryBtn, paddingHorizontal: 14, height: 44 }}
                onPress={() => {
                  const normalized = giftCode.trim().toUpperCase();
                  const gift = settings.billing.gifts.find(
                    (g) => g.code === normalized && !g.redeemed,
                  );
                  if (gift) {
                    const gifts = settings.billing.gifts.map((g) =>
                      g.id === gift.id ? { ...g, redeemed: true } : g,
                    );
                    if (gift.kind === 'nitro') {
                      patchBilling({
                        gifts,
                        nitroPlan: 'basic',
                        nitroExpiresAt: addMonths(null, 1),
                      });
                    } else {
                      patchBilling({
                        gifts,
                        boostCredits: settings.billing.boostCredits + 1,
                      });
                    }
                    setGiftCode('');
                    setMsg('Hediye kullanıldı');
                    return;
                  }
                  if (normalized === 'DRACORD-NITRO') {
                    patchBilling({
                      nitroPlan: 'nitro',
                      nitroExpiresAt: addMonths(null, 1),
                    });
                    setGiftCode('');
                    setMsg('Nitro kodu kullanıldı');
                    return;
                  }
                  if (normalized === 'DRACORD-BOOST') {
                    patchBilling({ boostCredits: settings.billing.boostCredits + 1 });
                    setGiftCode('');
                    setMsg('Takviye kodu kullanıldı');
                    return;
                  }
                  setError('Geçersiz veya kullanılmış kod');
                }}
              >
                <Text style={primaryBtnText}>Kullan</Text>
              </Pressable>
            </View>
            <Label>Hediye oluştur</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Pressable
                style={{ ...primaryBtn, backgroundColor: colors.surfaceHigh }}
                onPress={() => {
                  const gift = {
                    id: newLocalId('gift'),
                    kind: 'nitro' as const,
                    label: 'Nitro hediyesi',
                    code: makeGiftCode(),
                    redeemed: false,
                  };
                  patchBilling({ gifts: [gift, ...settings.billing.gifts] });
                }}
              >
                <Text style={{ ...primaryBtnText, color: colors.text }}>Nitro hediyesi</Text>
              </Pressable>
              <Pressable
                style={{ ...primaryBtn, backgroundColor: colors.surfaceHigh }}
                onPress={() => {
                  const gift = {
                    id: newLocalId('gift'),
                    kind: 'boost' as const,
                    label: 'Takviye hediyesi',
                    code: makeGiftCode(),
                    redeemed: false,
                  };
                  patchBilling({ gifts: [gift, ...settings.billing.gifts] });
                }}
              >
                <Text style={{ ...primaryBtnText, color: colors.text }}>Takviye hediyesi</Text>
              </Pressable>
            </View>
            <Label>Envanter</Label>
            {settings.billing.gifts.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Hediye yok</Text>
            ) : (
              settings.billing.gifts.map((g) => (
                <View
                  key={g.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>
                    {g.label}
                    {g.redeemed ? ' (kullanıldı)' : ''}
                  </Text>
                  <Pressable
                    onPress={() =>
                      void Clipboard.setStringAsync(g.code).then(() => setMsg('Kod kopyalandı'))
                    }
                  >
                    <Text style={{ color: colors.primary, fontFamily: PlatformFont, marginTop: 4 }}>
                      {g.code}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}

        {tab === 'voice' && (
          <>
            <H1>{tabLabel('voice', locale)}</H1>
            <Text style={{ color: colors.textMuted, lineHeight: 20, marginBottom: 12 }}>
              Mikrofon, sağırlaştırma ve kamera burada veya ses odası alt şeridinden yönetilir.
              Uygulama arka plandayken oturum foreground service ile sürer.
            </Text>
            {voice?.connected ? (
              <>
                <Text style={{ color: colors.success, fontWeight: '700', marginBottom: 8 }}>
                  Bağlı: {voice.voiceChannelName ?? 'Ses kanalı'}
                </Text>
                <ToggleRow
                  label="Mikrofon kapalı (mute)"
                  value={voice.muted}
                  onChange={(v) => voice.setMuted(v)}
                />
                <ToggleRow
                  label="Sağırlaştır (deafen)"
                  value={voice.deafened}
                  onChange={(v) => voice.setDeafened(v)}
                />
                <ToggleRow
                  label="Kamera açık"
                  value={voice.camOn}
                  onChange={() => void voice.toggleCamera()}
                />
                <Pressable
                  style={{ ...primaryBtn, backgroundColor: colors.surfaceHigh, marginTop: 12 }}
                  onPress={() => void voice.flipCamera()}
                >
                  <Text style={{ ...primaryBtnText, color: colors.text }}>Kamerayı çevir</Text>
                </Pressable>
                <Pressable
                  style={{ ...primaryBtn, backgroundColor: colors.danger, marginTop: 8 }}
                  onPress={() => void voice.leave()}
                >
                  <Text style={{ ...primaryBtnText, color: '#fff' }}>Sesten ayrıl</Text>
                </Pressable>
              </>
            ) : (
              <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
                Şu an bir ses kanalında değilsin. Bir odaya katıldığında mute / deafen / kamera
                burada da görünür.
              </Text>
            )}
            <Text style={{ color: colors.textMuted, lineHeight: 20, marginTop: 16 }}>
              Aynı anda yalnızca bir istemciden ses yayınlanır. Başka sunuculara göz atarken mevcut
              bağlantın korunur.
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
              Tema tüm istemcilerde senkron tutulur (web, masaüstü, mobil).
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
              label="Otomatik güncelleme"
              value={settings.system.autoUpdate}
              onChange={(v) => patchSettings({ system: { ...settings.system, autoUpdate: v } })}
            />
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 15 }}>
                Uygulama sürümü:{' '}
                <Text style={{ color: colors.textMuted }}>v{getNativeAppVersion()}</Text>
              </Text>
              {Updates.updateId ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  OTA: {Updates.updateId.slice(0, 8)}…
                </Text>
              ) : null}
              <Pressable
                onPress={() => {
                  void (async () => {
                    try {
                      const result = await checkAppUpdates(client);
                      if (result.forceStore || result.storeUpdate) {
                        promptStoreUpdate({
                          current: result.current,
                          remote: result.remoteStoreVersion,
                          storeUrl: result.storeUrl,
                          force: result.forceStore,
                        });
                        return;
                      }
                      if (result.otaAvailable) {
                        promptOtaUpdate({
                          current: result.current,
                          autoApply: settings.system.autoUpdate,
                        });
                        return;
                      }
                      Alert.alert(
                        'Güncelleme',
                        `Uygulama güncel (v${result.current}).`,
                      );
                    } catch (e) {
                      Alert.alert(
                        'Güncelleme',
                        e instanceof Error ? e.message : 'Kontrol başarısız',
                      );
                    }
                  })();
                }}
                style={{
                  ...primaryBtn,
                  alignSelf: 'flex-start',
                  paddingHorizontal: 14,
                  height: 36,
                }}
              >
                <Text style={primaryBtnText}>Şimdi güncelleme kontrol et</Text>
              </Pressable>
            </View>
          </>
        )}

        {tab === 'language' && settings && (
          <>
            <H1>{t('lang.title', locale)}</H1>
            <Text style={{ color: colors.textMuted, marginBottom: 12, lineHeight: 20 }}>
              {t('lang.localeDesc', locale)}
            </Text>
            <Label>{t('lang.locale', locale)}</Label>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Chip
                label="Türkçe"
                active={settings.language.locale === 'tr'}
                onPress={() => {
                  setAppLocale('tr');
                  patchSettings({ language: { ...settings.language, locale: 'tr' } });
                }}
              />
              <Chip
                label="English"
                active={settings.language.locale === 'en'}
                onPress={() => {
                  setAppLocale('en');
                  patchSettings({ language: { ...settings.language, locale: 'en' } });
                }}
              />
            </View>
            <ToggleRow
              label={t('lang.hour24', locale)}
              value={settings.language.hour24}
              onChange={(v) => patchSettings({ language: { ...settings.language, hour24: v } })}
            />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 18 }}>
              {t('lang.note', locale)}
            </Text>
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
            <H1>{tabLabel(tab, locale)}</H1>
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
          'nitro',
          'boost',
          'subscriptions',
          'gifts',
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
              {navSections.map((section) => (
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
      <ThemedSwitch value={value} onValueChange={onChange} />
    </View>
  );
}

function SpotifyConnectBlock({
  client,
}: {
  client: {
    getSpotifyStatus: () => Promise<{
      configured: boolean;
      connected: boolean;
      authorizeUrl: string | null;
    }>;
    disconnectSpotify: () => Promise<{ ok: true }>;
  };
}) {
  const [spotify, setSpotify] = useState<{
    configured: boolean;
    connected: boolean;
    authorizeUrl: string | null;
  } | null>(null);

  const refresh = useCallback(() => {
    void client
      .getSpotifyStatus()
      .then(setSpotify)
      .catch(() =>
        setSpotify({ configured: false, connected: false, authorizeUrl: null }),
      );
  }, [client]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!spotify) return null;

  return (
    <View style={{ marginTop: 16, gap: 8 }}>
      <H1>Spotify</H1>
      {!spotify.configured ? (
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          Spotify API anahtarları sunucuda yapılandırılmamış.
        </Text>
      ) : spotify.connected ? (
        <>
          <Text style={{ color: colors.text }}>Spotify bağlı</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Çalan parçan profilinde “Dinliyor” olarak görünür.
          </Text>
          <Pressable
            onPress={() => {
              void client.disconnectSpotify().then(refresh);
            }}
            style={{ paddingVertical: 10 }}
          >
            <Text style={{ color: colors.danger, fontWeight: '700' }}>Bağlantıyı kes</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Hesabını bağla; dinlediğin şarkı profilde görünür.
          </Text>
          <Pressable
            disabled={!spotify.authorizeUrl}
            onPress={() => {
              if (spotify.authorizeUrl) void Linking.openURL(spotify.authorizeUrl);
            }}
            style={[primaryBtn, { opacity: spotify.authorizeUrl ? 1 : 0.4 }]}
          >
            <Text style={primaryBtnText}>Spotify bağla</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
