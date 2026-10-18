import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientSettings,
  GuildSummary,
  MessageBookmarkDto,
  PresenceStatus,
  SocialLinks,
} from '@dracord/types';
import { guildBoostLevel, resetAppTour } from '@dracord/types';
import {
  ConfirmDialog,
  SettingsShell,
  SOCIAL_LINK_KEYS,
  presenceLabelTr,
  type SocialLinkKey,
} from '@dracord/ui';
import {
  SCREEN_SHARE_FPS_PRESETS,
  SCREEN_SHARE_RESOLUTION_PRESETS,
  SCREEN_SHARE_RESOLUTION_SPECS,
  SCREEN_SHARE_VIEW_QUALITY_PRESETS,
  SCREEN_SHARE_VIEW_QUALITY_SPECS,
  VOICE_BITRATE_PRESETS,
  type ScreenShareFps,
  type ScreenShareResolutionId,
  type ScreenShareViewQualityId,
  type VoiceBitrateKbps,
} from '@/lib/voice-settings';
import { useAuth } from '../auth';
import { DracoEmpty } from '../components/Draco';
import {
  applyPrefsDom,
  loadLocalPrefs,
  saveLocalPrefs,
  mergeClientSettings,
  syncDesktopSystemPrefs,
} from '../lib/client-settings';
import {
  SettingsNote,
  SettingsPageBody,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
  SettingsSlider,
} from '../components/settings/SettingsControls';
import { useVoiceSession } from '../voice/VoiceSession';

const LEGAL_BASE = 'https://dracord.com.tr/legal';

const SOCIAL_LABELS: Record<SocialLinkKey, string> = {
  website: 'Website',
  twitter: 'X / Twitter',
  github: 'GitHub',
  discord: 'Discord',
  youtube: 'YouTube',
  instagram: 'Instagram',
  twitch: 'Twitch',
  linkedin: 'LinkedIn',
  steam: 'Steam',
  spotify: 'Spotify',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

function normalizeUsername(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 32);
}

function emptySocial(): Record<SocialLinkKey, string> {
  const o = {} as Record<SocialLinkKey, string>;
  for (const k of SOCIAL_LINK_KEYS) o[k] = '';
  return o;
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addMonths(isoOrNow: string | null, months: number): string {
  const d = isoOrNow ? new Date(isoOrNow) : new Date();
  if (d.getTime() < Date.now()) d.setTime(Date.now());
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function makeGiftCode(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${part()}-${part()}-${part()}`;
}

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

export function SettingsPage({
  onClose,
  onOpenChannel,
  onOpenDm,
  initialTab = 'account',
}: {
  onClose?: () => void;
  onOpenChannel?: (guildId: string, channelId: string) => void;
  onOpenDm?: () => void;
  initialTab?: Tab;
}) {
  const { user, logout, client, updatePresence, setUser, refreshUser } = useAuth();
  const voice = useVoiceSession();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [prefs, setPrefs] = useState<ClientSettings>(loadLocalPrefs);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [accentColor, setAccentColor] = useState(user?.accentColor ?? '#bd93f9');
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [nsfwDisableConfirmOpen, setNsfwDisableConfirmOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState<MessageBookmarkDto[]>([]);
  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null);
  const [twoFaOtpUrl, setTwoFaOtpUrl] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [socialDraft, setSocialDraft] = useState<Record<SocialLinkKey, string>>(emptySocial);
  const [deactivateConfirming, setDeactivateConfirming] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateBusy, setDeactivateBusy] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [boostGuilds, setBoostGuilds] = useState<GuildSummary[]>([]);
  const [boostBusyId, setBoostBusyId] = useState<string | null>(null);
  const [giftCode, setGiftCode] = useState('');
  const [giftMsg, setGiftMsg] = useState<string | null>(null);

  useEffect(() => {
    applyPrefsDom(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? '');
    setUsername(user.username ?? '');
    setUsernameAvailable(null);
    setBio(user.bio ?? '');
    setAccentColor(user.accentColor ?? user.bannerColor ?? '#bd93f9');
    setCustomStatus(user.customStatus ?? '');
    const next = emptySocial();
    const links = user.socialLinks ?? {};
    for (const k of SOCIAL_LINK_KEYS) next[k] = links[k] ?? '';
    setSocialDraft(next);
  }, [user]);

  useEffect(() => {
    if (!user || tab !== 'profile') return;
    const normalized = normalizeUsername(username);
    if (normalized.length < 2) {
      setUsernameAvailable(null);
      return;
    }
    if (normalized === user.username) {
      setUsernameAvailable(true);
      return;
    }
    const t = window.setTimeout(() => {
      setUsernameChecking(true);
      void client
        .checkUsernameAvailable(normalized)
        .then((r) => setUsernameAvailable(r.available))
        .catch(() => setUsernameAvailable(null))
        .finally(() => setUsernameChecking(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [username, user, client, tab]);

  useEffect(() => {
    if (tab !== 'bookmarks') return;
    void client.listBookmarks(50).then(setBookmarks).catch(() => setBookmarks([]));
  }, [tab, client]);

  useEffect(() => {
    if (tab !== 'boost') return;
    void client.listGuilds().then(setBoostGuilds).catch(() => setBoostGuilds([]));
  }, [tab, client]);

  useEffect(() => {
    if (tab === 'voice') void voice.refreshAudioDevices(true);
  }, [tab, voice.refreshAudioDevices]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    void client
      .getClientSettings()
      .then((remote) => {
        const merged = mergeClientSettings(remote as unknown as Record<string, unknown>);
        setPrefs(merged);
        saveLocalPrefs(merged);
        syncDesktopSystemPrefs(merged.system);
      })
      .catch(() => {
        /* yerel prefs yeterli */
        syncDesktopSystemPrefs(loadLocalPrefs().system);
      });
  }, [client]);

  const setSection = useCallback(
    <K extends keyof ClientSettings>(key: K, value: Partial<ClientSettings[K]>) => {
      setPrefs((prev) => {
        const next = {
          ...prev,
          [key]: { ...(prev[key] as object), ...value },
        } as ClientSettings;
        saveLocalPrefs(next);
        void client.updateClientSettings({ [key]: next[key] } as Partial<ClientSettings>).catch(() => {});
        if (key === 'system') {
          syncDesktopSystemPrefs(next.system);
        }
        return next;
      });
    },
    [client],
  );

  const item = (id: Tab, label: string, icon: string) => ({
    id,
    label,
    icon,
    active: tab === id,
    onClick: () => {
      setMsg(null);
      setError(null);
      setTab(id);
    },
  });

  return (
    <SettingsShell
      title="Dracord"
      onClose={onClose}
      sections={[
        {
          id: 'account',
          title: 'Hesap',
          items: [
            item('account', 'Hesap Bilgileri', 'person'),
            item('profile', 'Profil', 'badge'),
            item('password', 'Şifre ve Güvenlik', 'lock'),
            item('account-status', 'Hesap Durumu', 'manage_accounts'),
            item('privacy', 'Veri ve Gizlilik', 'shield'),
            item('messaging', 'Mesajlaşma İzinleri', 'forum'),
            item('bookmarks', 'Yer İmleri', 'bookmark'),
            item('notifications', 'Bildirimler', 'notifications'),
          ],
        },
        {
          id: 'billing',
          title: 'Faturalandırma',
          items: [
            item('nitro', 'Nitro', 'workspace_premium'),
            item('boost', 'Sunucu Takviyesi', 'diamond'),
            item('subscriptions', 'Abonelikler', 'receipt_long'),
            item('gifts', 'Hediye Envanteri', 'card_giftcard'),
          ],
        },
        {
          id: 'experience',
          title: 'Deneyimler',
          items: [
            item('voice', 'Ses ve Görüntü', 'mic'),
            item('appearance', 'Görünüm', 'palette'),
            item('accessibility', 'Erişilebilirlik', 'accessibility_new'),
            item('system', 'Sistem', 'dns'),
            item('language', 'Dil ve Zaman', 'language'),
          ],
        },
        {
          id: 'developer',
          title: 'Geliştirici',
          items: [item('developer', 'Gelişmiş', 'code')],
        },
        {
          id: 'other',
          items: [
            {
              id: 'logout',
              label: 'Çıkış Yap',
              icon: 'logout',
              variant: 'danger' as const,
              onClick: () => logout(),
            },
            item('privacy-policy', 'Gizlilik Politikası', 'policy'),
            item('terms', 'Hizmet Koşulları', 'gavel'),
            item('kvkk', 'KVKK', 'verified_user'),
            item('cookies', 'Çerezler', 'cookie'),
          ],
        },
      ]}
    >
      {error && <p className="text-error mb-3">{error}</p>}
      {msg && <p className="text-primary-container mb-3">{msg}</p>}

      {tab === 'account' && (
        <SettingsPageBody
          title="Hesap Bilgileri"
          description="Profil özetin, durumun ve oturum bilgilerin."
        >
          <SettingsSection title="Hesap">
            <div className="px-space-md py-space-md space-y-2">
              <p className="font-headline-md">{user?.displayName ?? '—'}</p>
              <p className="text-sm text-outline">@{user?.username ?? '—'}</p>
              <p className="text-sm text-on-surface-variant">
                Durum:{' '}
                {presenceLabelTr(user?.status ?? 'OFFLINE', user?.customStatus)}
              </p>
              <button
                type="button"
                className="mt-1 text-sm text-primary-container hover:underline"
                onClick={() => setTab('profile')}
              >
                Profili düzenle
              </button>
            </div>
          </SettingsSection>
          <SettingsSection title="Durum">
            <div className="px-space-md py-space-md space-y-3">
              <div className="flex flex-wrap gap-2">
                {(['ONLINE', 'IDLE', 'DND', 'OFFLINE'] as PresenceStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void updatePresence({ status: s })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      user?.status === s
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-surface-container-high hover:bg-surface-bright'
                    }`}
                  >
                    {presenceLabelTr(s)}
                  </button>
                ))}
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-on-surface-variant">Özel durum</span>
                <div className="flex gap-2">
                  <input
                    value={customStatus}
                    maxLength={128}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder="Ne yapıyorsun?"
                    className="flex-1 h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                  />
                  <button
                    type="button"
                    className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
                    onClick={() =>
                      void updatePresence({
                        status: user?.status ?? 'ONLINE',
                        customStatus: customStatus.trim() || null,
                      }).then(() => setMsg('Durum güncellendi'))
                    }
                  >
                    Kaydet
                  </button>
                </div>
              </label>
            </div>
          </SettingsSection>
          <SettingsSection title="Yardım">
            <div className="px-space-md py-space-md space-y-2">
              <p className="text-sm text-on-surface-variant">
                Arayüzü yeniden tanımak için kısa turu başlatabilirsin.
              </p>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface font-semibold hover:bg-surface-bright"
                onClick={() => {
                  resetAppTour();
                  onClose?.();
                  window.setTimeout(() => {
                    window.dispatchEvent(new Event('dracord:start-tour'));
                  }, 120);
                }}
              >
                Uygulama turunu başlat
              </button>
            </div>
            <SettingsNote>Çıkış yapmak için sol menüdeki “Çıkış Yap”ı kullan.</SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'profile' && (() => {
        const usernameChanged =
          Boolean(user) && normalizeUsername(username) !== (user?.username ?? '');
        const usernameOk =
          normalizeUsername(username).length >= 2 &&
          (usernameAvailable === true || !usernameChanged);

        const uploadAvatar = async (file: File) => {
          setProfileSaving(true);
          setError(null);
          try {
            const uploaded = await client.uploadFile(file, 'avatars');
            const updated = await client.updateProfile({ avatarUrl: uploaded.url });
            setUser(updated);
            setMsg('Avatar güncellendi');
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Avatar yüklenemedi (S3 ayarlarını kontrol et)',
            );
          } finally {
            setProfileSaving(false);
          }
        };

        const uploadBanner = async (file: File) => {
          setProfileSaving(true);
          setError(null);
          try {
            const uploaded = await client.uploadFile(file, 'banners');
            const updated = await client.updateProfile({ bannerUrl: uploaded.url });
            setUser(updated);
            setMsg('Banner güncellendi');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Banner yüklenemedi');
          } finally {
            setProfileSaving(false);
          }
        };

        const saveProfile = async () => {
          setProfileSaving(true);
          setError(null);
          setMsg(null);
          try {
            const normalized = normalizeUsername(username);
            if (normalized.length < 2) {
              throw new Error('Kullanıcı adı en az 2 karakter olmalı');
            }
            if (usernameChanged && usernameAvailable === false) {
              throw new Error('Bu kullanıcı adı alınmış');
            }

            const socialLinks: SocialLinks = {};
            for (const k of SOCIAL_LINK_KEYS) {
              const v = socialDraft[k]?.trim();
              if (v) socialLinks[k] = v;
            }

            let updated = await client.updateProfile({
              displayName,
              bio,
              accentColor,
              bannerColor: accentColor,
              socialLinks,
            });

            if (usernameChanged) {
              updated = await client.confirmUsername(normalized);
            }

            setUser(updated);
            setUsername(updated.username);
            await refreshUser().catch(() => undefined);
            setMsg('Profil kaydedildi');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Kaydedilemedi');
          } finally {
            setProfileSaving(false);
          }
        };

        return (
          <SettingsPageBody
            title="Profil"
            description="Avatar, kullanıcı adı, renk, bio ve sosyal bağlantılarını buradan düzenle."
          >
            <div
              className="h-28 rounded-xl relative overflow-hidden bg-surface-container-high"
              style={{
                backgroundColor: accentColor,
                backgroundImage: user?.bannerUrl ? `url(${user.bannerUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <label className="absolute right-space-sm bottom-space-sm px-space-sm py-1 rounded-lg bg-black/50 text-white font-label-sm cursor-pointer">
                Banner
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadBanner(f);
                  }}
                />
              </label>
            </div>

            <div className="flex items-center gap-space-md">
              <div className="relative">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-headline-lg">
                    {(user?.displayName ?? '?').slice(0, 1)}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center cursor-pointer">
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAvatar(f);
                    }}
                  />
                </label>
              </div>
              <div>
                <p className="font-headline-md text-on-surface">{user?.displayName}</p>
                <p className="font-label-sm text-outline">@{user?.username}</p>
              </div>
            </div>

            <label className="flex flex-col gap-space-xs">
              <span className="font-label-sm text-on-surface-variant">Görünen ad</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
              />
            </label>

            <label className="flex flex-col gap-space-xs">
              <span className="font-label-sm text-on-surface-variant">Kullanıcı adı</span>
              <div className="flex items-center h-10 px-space-sm rounded-lg bg-surface-container-highest gap-1">
                <span className="text-outline font-body-md">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  autoComplete="username"
                  spellCheck={false}
                  maxLength={32}
                  className="flex-1 bg-transparent outline-none font-body-md min-w-0"
                />
              </div>
              <span className="font-label-sm text-on-surface-variant">
                {usernameChecking
                  ? 'Kontrol ediliyor…'
                  : normalizeUsername(username).length < 2
                    ? 'En az 2 karakter (a-z, 0-9, _)'
                    : !usernameChanged
                      ? 'Mevcut kullanıcı adın'
                      : usernameAvailable === true
                        ? 'Kullanılabilir'
                        : usernameAvailable === false
                          ? 'Bu ad alınmış'
                          : 'Uygunluk kontrol ediliyor…'}
              </span>
            </label>

            <label className="flex flex-col gap-space-xs">
              <span className="font-label-sm text-on-surface-variant">Bio</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={190}
                className="px-space-sm py-space-sm rounded-lg bg-surface-container-highest outline-none resize-none"
              />
            </label>

            <label className="flex flex-col gap-space-xs">
              <span className="font-label-sm text-on-surface-variant">Vurgu rengi</span>
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-24 bg-transparent"
              />
            </label>

            <div>
              <p className="font-label-sm text-on-surface-variant mb-space-sm">
                Sosyal bağlantılar
              </p>
              <div className="grid gap-space-md sm:grid-cols-2 lg:grid-cols-3">
                {SOCIAL_LINK_KEYS.map((key) => (
                  <label key={key} className="flex flex-col gap-space-xs">
                    <span className="font-label-sm text-on-surface-variant">
                      {SOCIAL_LABELS[key]}
                    </span>
                    <input
                      value={socialDraft[key]}
                      onChange={(e) =>
                        setSocialDraft((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="URL veya kullanıcı adı"
                      className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
                    />
                  </label>
                ))}
              </div>
            </div>

            {msg && tab === 'profile' && (
              <p className="text-dracula-green font-body-sm">{msg}</p>
            )}
            {error && tab === 'profile' && (
              <p className="text-error font-body-sm">{error}</p>
            )}

            <button
              type="button"
              disabled={profileSaving || !usernameOk}
              onClick={() => void saveProfile()}
              className="px-space-lg py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            >
              Kaydet
            </button>
          </SettingsPageBody>
        );
      })()}

      {tab === 'password' && (
        <SettingsPageBody
          title="Şifre ve Güvenlik"
          description="Hesap şifreni ve iki adımlı doğrulamayı yönet."
        >
          <SettingsSection title="Şifre">
            <div className="px-space-md py-space-md space-y-3">
              <input
                type="password"
                placeholder="Mevcut şifre"
                value={password.current}
                onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
              />
              <input
                type="password"
                placeholder="Yeni şifre"
                value={password.next}
                onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
              />
              <input
                type="password"
                placeholder="Yeni şifre (tekrar)"
                value={password.confirm}
                onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
              />
              <button
                type="button"
                className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
                onClick={() => {
                  if (password.next !== password.confirm) {
                    setError('Şifreler eşleşmiyor');
                    return;
                  }
                  setError(null);
                  void client
                    .changePassword(password.current, password.next)
                    .then(() => {
                      setMsg('Şifre güncellendi');
                      setPassword({ current: '', next: '', confirm: '' });
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
                }}
              >
                Şifreyi değiştir
              </button>
            </div>
          </SettingsSection>
          <SettingsSection title="İki adımlı doğrulama">
            <div className="px-space-md py-space-md space-y-3">
              <p className="text-sm text-on-surface-variant">
                Durum: {user?.twoFactorEnabled ? 'Açık' : 'Kapalı'}
              </p>
              {!user?.twoFactorEnabled ? (
                <>
                  <button
                    type="button"
                    className="h-10 px-4 rounded-lg bg-surface-container-high font-bold"
                    onClick={() => {
                      void client.beginTwoFactorSetup().then((r) => {
                        setTwoFaSecret(r.secret);
                        setTwoFaOtpUrl(r.otpauthUrl ?? null);
                        setMsg('Authenticator uygulamasına secret’ı ekle, sonra kodu onayla.');
                      });
                    }}
                  >
                    2FA kurulumunu başlat
                  </button>
                  {twoFaSecret && (
                    <>
                      {twoFaOtpUrl && (
                        <a
                          href={twoFaOtpUrl}
                          className="text-sm text-primary-container hover:underline"
                        >
                          Authenticator’da aç
                        </a>
                      )}
                      <code className="block p-2 rounded-lg bg-surface-container-highest text-xs break-all">
                        {twoFaSecret}
                      </code>
                      <input
                        value={twoFaCode}
                        onChange={(e) => setTwoFaCode(e.target.value)}
                        placeholder="6 haneli kod"
                        className="w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                      />
                      <button
                        type="button"
                        className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
                        onClick={() => {
                          void client
                            .confirmTwoFactorSetup(twoFaCode)
                            .then(() => {
                              setTwoFaSecret(null);
                              setTwoFaCode('');
                              void refreshUser();
                              setMsg('2FA açıldı');
                            })
                            .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
                        }}
                      >
                        2FA’yı onayla
                      </button>
                    </>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  className="h-10 px-4 rounded-lg bg-error-container text-on-error-container font-bold"
                  onClick={() => {
                    const code = window.prompt('2FA kodu');
                    if (!code) return;
                    void client
                      .disableTwoFactor({ code })
                      .then(() => {
                        void refreshUser();
                        setMsg('2FA kapatıldı');
                      })
                      .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
                  }}
                >
                  2FA’yı kapat
                </button>
              )}
            </div>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'account-status' && (
        <SettingsPageBody
          title="Hesap Durumu"
          description="Hesabı geçici kapat veya kalıcı sil. Silme geri alınamaz."
        >
          <SettingsSection title="Devre dışı bırak">
            <div className="px-space-md py-space-md space-y-3">
              <SettingsNote>
                Hesabın silinmez; erişim kesilir. Yeniden etkinleştirme destek ekibi veya giriş
                akışı üzerinden sağlanabilir.
              </SettingsNote>
              {!deactivateConfirming ? (
                <button
                  type="button"
                  onClick={() => setDeactivateConfirming(true)}
                  className="px-4 py-2 rounded-lg bg-error/20 text-error font-semibold hover:bg-error/30"
                >
                  Hesabı devre dışı bırak…
                </button>
              ) : (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-on-surface-variant">
                      Şifreni onayla (varsa)
                    </span>
                    <input
                      type="password"
                      value={deactivatePassword}
                      onChange={(e) => setDeactivatePassword(e.target.value)}
                      className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deactivateBusy}
                      className="px-4 py-2 rounded-lg bg-error text-on-error font-semibold disabled:opacity-50"
                      onClick={() => {
                        setDeactivateBusy(true);
                        setError(null);
                        void client
                          .deactivateAccount(deactivatePassword || undefined)
                          .then(() => logout())
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : 'İşlem başarısız'),
                          )
                          .finally(() => setDeactivateBusy(false));
                      }}
                    >
                      Onayla ve çıkış yap
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-surface-container-high font-semibold"
                      onClick={() => setDeactivateConfirming(false)}
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SettingsSection>
          <SettingsSection title="Hesabı kalıcı sil">
            <div className="px-space-md py-space-md space-y-3">
              <SettingsNote>
                Tüm verilerin silinir. Sahip olduğun sunucuları önce sil veya sahipliği
                devret. Onay için <strong>SİL</strong> yaz.
              </SettingsNote>
              {!deleteConfirming ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirming(true)}
                  className="px-4 py-2 rounded-lg bg-error/20 text-error font-semibold hover:bg-error/30"
                >
                  Hesabımı kalıcı sil…
                </button>
              ) : (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs text-on-surface-variant">Onay (SİL yaz)</span>
                    <input
                      type="text"
                      value={deletePhrase}
                      onChange={(e) => setDeletePhrase(e.target.value)}
                      placeholder="SİL"
                      autoComplete="off"
                      className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-on-surface-variant">
                      Şifreni onayla (şifreli hesaplarda zorunlu)
                    </span>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="w-full h-10 rounded-lg bg-surface-container-highest px-3 outline-none"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={deleteBusy}
                      className="px-4 py-2 rounded-lg bg-error text-on-error font-semibold disabled:opacity-50"
                      onClick={() => {
                        setDeleteBusy(true);
                        setError(null);
                        void client
                          .deleteAccount({
                            password: deletePassword || undefined,
                            confirm: deletePhrase,
                          })
                          .then(() => logout())
                          .catch((e) =>
                            setError(e instanceof Error ? e.message : 'Silme başarısız'),
                          )
                          .finally(() => setDeleteBusy(false));
                      }}
                    >
                      Kalıcı sil ve çık
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-surface-container-high font-semibold"
                      onClick={() => setDeleteConfirming(false)}
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'privacy' && (
        <SettingsPageBody
          title="Veri ve Gizlilik"
          description="Kimlerle etkileşime geçtiğini ve profil görünürlüğünü kontrol et."
        >
          <SettingsSection title="Sosyal">
            <SettingsSelect
              label="Direkt mesaj filtresi"
              description="Kimlerden DM alabileceğini sınırla."
              value={prefs.messaging.whoCanDm}
              options={[
                { value: 'everyone', label: 'Herkes' },
                { value: 'friends', label: 'Arkadaşlar' },
                { value: 'nobody', label: 'Kimse' },
              ]}
              onChange={(v) => {
                const level = v as 'everyone' | 'friends' | 'nobody';
                setSection('messaging', { whoCanDm: level });
                setSection('privacy', { dmFilter: level });
              }}
            />
            <SettingsToggle
              label="Arkadaşlık isteklerine izin ver"
              checked={prefs.privacy.allowFriendRequests}
              onChange={(v) => setSection('privacy', { allowFriendRequests: v })}
            />
          </SettingsSection>
          <SettingsSection title="Profil görünürlüğü">
            <SettingsToggle
              label="Biyografi göster"
              checked={prefs.privacy.showBio !== false}
              onChange={(v) => setSection('privacy', { showBio: v })}
            />
            <SettingsToggle
              label="Sosyal bağlantıları göster"
              checked={prefs.privacy.showSocialLinks !== false}
              onChange={(v) => setSection('privacy', { showSocialLinks: v })}
            />
            <SettingsToggle
              label="Banner göster"
              checked={prefs.privacy.showBanner !== false}
              onChange={(v) => setSection('privacy', { showBanner: v })}
            />
            <SettingsToggle
              label="Özel durum göster"
              checked={prefs.privacy.showCustomStatus !== false}
              onChange={(v) => setSection('privacy', { showCustomStatus: v })}
            />
          </SettingsSection>
          <SettingsSection title="Veri ve etkinlik">
            <SettingsToggle
              label="Veri toplama"
              description="Ürün iyileştirme için anonim kullanım verisi."
              checked={Boolean(prefs.privacy.dataCollection)}
              onChange={(v) => setSection('privacy', { dataCollection: v })}
            />
            <SettingsToggle
              label="Kişiselleştirilmiş reklamlar"
              checked={Boolean(prefs.privacy.personalizeAds)}
              onChange={(v) => setSection('privacy', { personalizeAds: v })}
            />
            <SettingsToggle
              label="Etkinlik durumunu paylaş"
              checked={prefs.privacy.shareActivityStatus}
              onChange={(v) => setSection('privacy', { shareActivityStatus: v })}
            />
          </SettingsSection>
          <SettingsSection title="Aktivite gizliliği">
            <SettingsToggle
              label="Aktiviteyi profilde göster"
              checked={prefs.activity.displayActivity !== false}
              onChange={(v) => setSection('activity', { displayActivity: v })}
            />
            <SettingsToggle
              label="Dracord oyunlarını paylaş"
              checked={prefs.activity.shareGames !== false}
              onChange={(v) => setSection('activity', { shareGames: v })}
            />
            <SettingsToggle
              label="Spotify dinlemeyi paylaş"
              checked={prefs.activity.shareSpotify !== false}
              onChange={(v) => setSection('activity', { shareSpotify: v })}
            />
            <SettingsToggle
              label="Masaüstü oyun algılama"
              description="Steam, Epic ve kayıtlı oyun süreçlerini tara; oynadığın oyun profilde görünür."
              checked={prefs.activity.shareDesktopActivity !== false}
              onChange={(v) => setSection('activity', { shareDesktopActivity: v })}
            />
            <SettingsToggle
              label="Katılma isteklerine izin ver"
              checked={prefs.activity.allowJoinRequests !== false}
              onChange={(v) => setSection('activity', { allowJoinRequests: v })}
            />
          </SettingsSection>
          <DesktopGamesLibrarySection />
          <SpotifyConnectionsSection client={client} />
        </SettingsPageBody>
      )}

      {tab === 'messaging' && (
        <SettingsPageBody
          title="Mesajlaşma İzinleri"
          description="Kimlerin sana mesaj atabileceğini ve içerik tercihlerini ayarla."
        >
          <SettingsSection title="İzinler">
            <SettingsSelect
              label="Kimler DM atabilir"
              value={prefs.messaging.whoCanDm}
              options={[
                { value: 'everyone', label: 'Herkes' },
                { value: 'friends', label: 'Arkadaşlar' },
                { value: 'nobody', label: 'Kimse' },
              ]}
              onChange={(v) => {
                const level = v as 'everyone' | 'friends' | 'nobody';
                setSection('messaging', { whoCanDm: level });
                setSection('privacy', { dmFilter: level });
              }}
            />
            <SettingsToggle
              label="Bağlantı gömme (embed)"
              description="Yapıştırılan linkler için önizleme kartı göster."
              checked={prefs.messaging.autoEmbed}
              onChange={(v) => setSection('messaging', { autoEmbed: v })}
            />
            <SettingsToggle
              label="Yazım denetimi"
              checked={prefs.messaging.spellcheck}
              onChange={(v) => setSection('messaging', { spellcheck: v })}
            />
          </SettingsSection>
          <SettingsSection title="İçerik filtresi">
            <SettingsToggle
              label="Uygunsuz içerik filtresi"
              description="Mesajlarda kaba kelimeleri sansürle ve şüpheli medya önizlemelerini gizle."
              checked={prefs.messaging.filterExplicit}
              onChange={(v) => setSection('messaging', { filterExplicit: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'bookmarks' && (
        <SettingsPageBody title="Yer imleri" description="Kaydettiğin mesajlara buradan dönebilirsin.">
          <SettingsSection>
            {bookmarks.length === 0 ? (
              <DracoEmpty
                mood="peek"
                size={80}
                title="Henüz yer imin yok"
                description="Mesaj menüsünden “Yer imine ekle” ile kaydedebilirsin."
              />
            ) : (
              <div className="divide-y divide-surface-container-high">
                {bookmarks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="w-full text-left px-space-md py-space-md hover:bg-surface-container"
                    onClick={() => {
                      if (b.guildId && b.channelId) onOpenChannel?.(b.guildId, b.channelId);
                      else onOpenDm?.();
                    }}
                  >
                    <div className="text-sm font-semibold truncate">
                      {b.channelName ? `#${b.channelName}` : 'Kanal'}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                      {b.message.content || 'Mesaj'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'notifications' && (
        <SettingsPageBody
          title="Bildirimler"
          description="Masaüstü, ses ve rozet bildirimlerini yönet."
        >
          <SettingsSection title="Masaüstü">
            <SettingsToggle
              label="Masaüstü bildirimleri"
              description="Uygulama arka plandayken sistem bildirimi göster. İlk açılışta sistem izni istenir."
              checked={prefs.notifications.desktopEnabled}
              onChange={(v) => {
                void (async () => {
                  if (v && typeof Notification !== 'undefined') {
                    if (Notification.permission === 'default') {
                      await Notification.requestPermission();
                    }
                    if (Notification.permission === 'denied') {
                      setSection('notifications', { desktopEnabled: false });
                      return;
                    }
                  }
                  setSection('notifications', { desktopEnabled: v });
                })();
              }}
            />
            <SettingsToggle
              label="Bildirim sesi"
              checked={prefs.notifications.soundEnabled}
              onChange={(v) => setSection('notifications', { soundEnabled: v })}
            />
            <SettingsSlider
              label="Ses kanalı bildirim sesi"
              description="Katılma / ayrılma tonlarının yüksekliği."
              value={Math.round((prefs.notifications.uiToneVolume ?? 0.85) * 100)}
              min={0}
              max={100}
              step={5}
              suffix="%"
              disabled={!prefs.notifications.soundEnabled}
              onChange={(v) => setSection('notifications', { uiToneVolume: v / 100 })}
            />
            <SettingsToggle
              label="Okunmamış rozeti"
              checked={prefs.notifications.unreadBadge}
              onChange={(v) => setSection('notifications', { unreadBadge: v })}
            />
          </SettingsSection>
          <SettingsSection title="Filtreler">
            <SettingsToggle
              label="Yalnızca bahsetmeler"
              description="Sadece @bahsetme ve arkadaşlık isteklerini al."
              checked={prefs.notifications.mentionsOnly}
              onChange={(v) => setSection('notifications', { mentionsOnly: v })}
            />
            <SettingsToggle
              label="Sessiz saatler (23:00–07:00)"
              description="Bu saatlerde ses ve masaüstü bildirimi bastırılır."
              checked={prefs.notifications.quietHours}
              onChange={(v) => setSection('notifications', { quietHours: v })}
            />
          </SettingsSection>
          <SettingsSection title="Yönetim">
            <p className="text-sm text-on-surface-variant px-space-md py-space-md">
              Okunmamış bildirimleri ve geçmişi üst çubuktaki bildirim zilinden veya Bildirimler
              sayfasından yönetebilirsin.
            </p>
          </SettingsSection>
          <SettingsSection>
            <SettingsNote>
              Sistem izni:{' '}
              {typeof Notification !== 'undefined' ? Notification.permission : 'desteklenmiyor'}
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'nitro' && (
        <SettingsPageBody
          title="Nitro"
          description="Demo abonelik — gerçek ödeme alınmaz; hesabına kaydedilir."
        >
          <SettingsSection title="Durum">
            <div className="px-space-md py-space-md space-y-1">
              <p>
                Plan:{' '}
                <span className="text-primary-container font-semibold">
                  {prefs.billing.nitroPlan === 'none'
                    ? 'Yok'
                    : prefs.billing.nitroPlan === 'basic'
                      ? 'Nitro Basic'
                      : 'Nitro'}
                </span>
              </p>
              {prefs.billing.nitroExpiresAt && (
                <p className="text-sm text-on-surface-variant">
                  Bitiş:{' '}
                  {new Date(prefs.billing.nitroExpiresAt).toLocaleDateString('tr-TR')}
                </p>
              )}
              {prefs.billing.nitroPlan !== 'none' && (
                <button
                  type="button"
                  className="mt-2 px-4 py-2 rounded-lg bg-surface-container-high font-semibold"
                  onClick={() =>
                    setSection('billing', { nitroPlan: 'none', nitroExpiresAt: null })
                  }
                >
                  Aboneliği iptal et
                </button>
              )}
            </div>
          </SettingsSection>
          <SettingsSection title="Planlar">
            <div className="px-space-md py-space-md space-y-3">
              <div className="rounded-lg border border-surface-container-highest p-4">
                <p className="font-semibold text-lg">Nitro Basic</p>
                <ul className="mt-2 space-y-1 text-sm text-on-surface-variant list-disc pl-5">
                  <li>Özel emoji kullanımı</li>
                  <li>Daha büyük dosya yükleme</li>
                  <li>Animasyonlu avatar</li>
                </ul>
                <button
                  type="button"
                  disabled={prefs.billing.nitroPlan === 'basic'}
                  className="mt-3 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-semibold disabled:opacity-50"
                  onClick={() =>
                    setSection('billing', {
                      nitroPlan: 'basic',
                      nitroExpiresAt: addMonths(prefs.billing.nitroExpiresAt, 1),
                      invoices: [
                        {
                          id: newId('inv'),
                          label: 'Nitro Basic (demo)',
                          amount: '₺49',
                          at: new Date().toISOString(),
                        },
                        ...prefs.billing.invoices,
                      ].slice(0, 20),
                    })
                  }
                >
                  {prefs.billing.nitroPlan === 'basic' ? 'Aktif' : 'Etkinleştir (ücretsiz demo)'}
                </button>
              </div>
              <div className="rounded-lg border border-primary-container/40 p-4">
                <p className="font-semibold text-lg">Nitro</p>
                <ul className="mt-2 space-y-1 text-sm text-on-surface-variant list-disc pl-5">
                  <li>Basic’teki her şey</li>
                  <li>Profil teması</li>
                  <li>+2 sunucu takviyesi kredisi</li>
                  <li>Özel sticker’lar</li>
                </ul>
                <button
                  type="button"
                  disabled={prefs.billing.nitroPlan === 'nitro'}
                  className="mt-3 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-semibold disabled:opacity-50"
                  onClick={() =>
                    setSection('billing', {
                      nitroPlan: 'nitro',
                      nitroExpiresAt: addMonths(prefs.billing.nitroExpiresAt, 1),
                      boostCredits: prefs.billing.boostCredits + 2,
                      invoices: [
                        {
                          id: newId('inv'),
                          label: 'Nitro (demo)',
                          amount: '₺99',
                          at: new Date().toISOString(),
                        },
                        ...prefs.billing.invoices,
                      ].slice(0, 20),
                    })
                  }
                >
                  {prefs.billing.nitroPlan === 'nitro' ? 'Aktif' : 'Etkinleştir (+2 takviye)'}
                </button>
              </div>
            </div>
            <SettingsNote>
              Nitro aktifken profilinde rozet gösterilir. Ödeme altyapısı yok — yalnızca demo.
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'boost' && (
        <SettingsPageBody
          title="Sunucu Takviyesi"
          description="Takviye satın al (demo) ve sunucularına ata — seviyeler herkese görünür."
        >
          <SettingsSection title="Krediler">
            <div className="px-space-md py-space-md flex items-center justify-between gap-3 flex-wrap">
              <p>
                Kullanılabilir: <strong>{prefs.billing.boostCredits}</strong>
              </p>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary-container font-semibold"
                onClick={() =>
                  setSection('billing', {
                    boostCredits: prefs.billing.boostCredits + 1,
                    invoices: [
                      {
                        id: newId('inv'),
                        label: 'Sunucu takviyesi (demo)',
                        amount: '₺49',
                        at: new Date().toISOString(),
                      },
                      ...prefs.billing.invoices,
                    ].slice(0, 20),
                  })
                }
              >
                +1 Takviye al (demo)
              </button>
            </div>
          </SettingsSection>
          <SettingsSection title="Takviye yapmak sunucuların işine yarayabilir">
            {boostGuilds.length === 0 ? (
              <DracoEmpty
                mood="confused"
                size={80}
                title="Henüz sunucun yok"
                description="Bir sunucuya katıl veya oluştur — sonra takviye verebilirsin."
              />
            ) : (
              <ul className="divide-y divide-surface-container-highest">
                {boostGuilds.map((g) => {
                  const count = g.boostCount ?? 0;
                  const level = g.boostLevel ?? guildBoostLevel(count);
                  const mine = (prefs.billing.boostAssignments ?? []).some(
                    (a) => a.guildId === g.id,
                  );
                  return (
                    <li key={g.id} className="px-space-md py-space-md flex items-center gap-3 flex-wrap">
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest overflow-hidden flex items-center justify-center shrink-0">
                        {g.iconUrl ? (
                          <img src={g.iconUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold">{g.name.slice(0, 2)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{g.name}</p>
                        <p className="text-sm text-on-surface-variant">
                          {count === 0 ? 'Takviye yok' : `${count} takviye · Seviye ${level}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={
                          boostBusyId === g.id || (!mine && prefs.billing.boostCredits < 1)
                        }
                        className={`h-9 px-3 rounded-lg text-sm font-semibold inline-flex items-center gap-1 disabled:opacity-50 ${
                          mine
                            ? 'bg-surface-container-highest'
                            : 'bg-primary-container text-on-primary-container'
                        }`}
                        onClick={() => {
                          setBoostBusyId(g.id);
                          void (mine ? client.unboostGuild(g.id) : client.boostGuild(g.id))
                            .then(async () => {
                              const settings = await client.getClientSettings();
                              const merged = mergeClientSettings(
                                settings as unknown as Record<string, unknown>,
                              );
                              setPrefs(merged);
                              saveLocalPrefs(merged);
                              setBoostGuilds(await client.listGuilds());
                            })
                            .catch((e) =>
                              setError(e instanceof Error ? e.message : 'Takviye hatası'),
                            )
                            .finally(() => setBoostBusyId(null));
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">diamond</span>
                        {mine ? 'Takviyeyi kaldır' : 'Bu sunucuya takviye yap'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'subscriptions' && (
        <SettingsPageBody title="Abonelikler" description="Aktif planların ve takviyelerin.">
          <SettingsSection>
            {prefs.billing.nitroPlan === 'none' &&
            (prefs.billing.boostAssignments?.length ?? 0) === 0 ? (
              <SettingsNote>Aktif aboneliğin yok. Nitro veya takviye ekle.</SettingsNote>
            ) : (
              <ul className="divide-y divide-surface-container-high">
                {prefs.billing.nitroPlan !== 'none' && (
                  <li className="px-space-md py-3 flex items-center justify-between gap-3">
                    <span>
                      Nitro {prefs.billing.nitroPlan === 'basic' ? 'Basic' : ''} · bitiş{' '}
                      {prefs.billing.nitroExpiresAt
                        ? new Date(prefs.billing.nitroExpiresAt).toLocaleDateString('tr-TR')
                        : '—'}
                    </span>
                    <button
                      type="button"
                      className="text-sm text-error hover:underline"
                      onClick={() =>
                        setSection('billing', { nitroPlan: 'none', nitroExpiresAt: null })
                      }
                    >
                      İptal
                    </button>
                  </li>
                )}
                {(prefs.billing.boostAssignments ?? []).map((a) => (
                  <li
                    key={a.guildId}
                    className="px-space-md py-3 flex items-center justify-between gap-3"
                  >
                    <span>Takviye · {a.guildName}</span>
                    <button
                      type="button"
                      className="text-sm text-error hover:underline"
                      onClick={() =>
                        setSection('billing', {
                          boostCredits: prefs.billing.boostCredits + 1,
                          boostAssignments: prefs.billing.boostAssignments.filter(
                            (x) => x.guildId !== a.guildId,
                          ),
                        })
                      }
                    >
                      İptal
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'gifts' && (
        <SettingsPageBody title="Hediye Envanteri" description="Hediye oluştur veya kod kullan.">
          <SettingsSection title="Kod kullan">
            <div className="px-space-md py-space-md flex gap-2">
              <input
                value={giftCode}
                onChange={(e) => setGiftCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX veya DRACORD-NITRO"
                className="flex-1 h-10 rounded-lg bg-surface-container-highest px-3 outline-none text-sm"
              />
              <button
                type="button"
                className="px-4 rounded-lg bg-primary-container text-on-primary-container font-semibold"
                onClick={() => {
                  setGiftMsg(null);
                  const normalized = giftCode.trim().toUpperCase();
                  const gift = prefs.billing.gifts.find(
                    (g) => g.code === normalized && !g.redeemed,
                  );
                  if (!gift) {
                    if (normalized === 'DRACORD-NITRO') {
                      setSection('billing', {
                        nitroPlan: 'nitro',
                        nitroExpiresAt: addMonths(null, 1),
                      });
                      setGiftMsg('Nitro kodu kullanıldı!');
                      setGiftCode('');
                      return;
                    }
                    if (normalized === 'DRACORD-BOOST') {
                      setSection('billing', {
                        boostCredits: prefs.billing.boostCredits + 1,
                      });
                      setGiftMsg('Takviye kodu kullanıldı!');
                      setGiftCode('');
                      return;
                    }
                    setGiftMsg('Geçersiz veya kullanılmış kod.');
                    return;
                  }
                  const gifts = prefs.billing.gifts.map((g) =>
                    g.id === gift.id ? { ...g, redeemed: true } : g,
                  );
                  if (gift.kind === 'nitro') {
                    setSection('billing', {
                      gifts,
                      nitroPlan: 'basic',
                      nitroExpiresAt: addMonths(null, 1),
                    });
                  } else {
                    setSection('billing', {
                      gifts,
                      boostCredits: prefs.billing.boostCredits + 1,
                    });
                  }
                  setGiftMsg('Hediye kullanıldı!');
                  setGiftCode('');
                }}
              >
                Kullan
              </button>
            </div>
            {giftMsg && (
              <p className="px-space-md pb-space-md text-sm text-secondary">{giftMsg}</p>
            )}
          </SettingsSection>
          <SettingsSection title="Hediye oluştur">
            <div className="px-space-md py-space-md flex flex-wrap gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-surface-container-high font-semibold"
                onClick={() =>
                  setSection('billing', {
                    gifts: [
                      {
                        id: newId('gift'),
                        kind: 'nitro',
                        label: 'Nitro hediyesi',
                        code: makeGiftCode(),
                        redeemed: false,
                      },
                      ...prefs.billing.gifts,
                    ],
                  })
                }
              >
                Nitro hediyesi oluştur
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-surface-container-high font-semibold"
                onClick={() =>
                  setSection('billing', {
                    gifts: [
                      {
                        id: newId('gift'),
                        kind: 'boost',
                        label: 'Takviye hediyesi',
                        code: makeGiftCode(),
                        redeemed: false,
                      },
                      ...prefs.billing.gifts,
                    ],
                  })
                }
              >
                Takviye hediyesi oluştur
              </button>
            </div>
          </SettingsSection>
          <SettingsSection title="Envanter">
            {prefs.billing.gifts.length === 0 ? (
              <SettingsNote>Hediye yok.</SettingsNote>
            ) : (
              <ul className="divide-y divide-surface-container-high">
                {prefs.billing.gifts.map((g) => (
                  <li key={g.id} className="px-space-md py-3">
                    <p>
                      {g.label}{' '}
                      {g.redeemed && (
                        <span className="text-outline text-sm">(kullanıldı)</span>
                      )}
                    </p>
                    <p className="font-mono text-sm text-primary-container">{g.code}</p>
                  </li>
                ))}
              </ul>
            )}
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'voice' && (
        <SettingsPageBody
          title="Ses ve görüntü"
          description="Mikrofon, kulaklık, kamera ve ekran paylaşımı ayarları (web ile aynı)."
        >
          <SettingsSection title="Ses seviyeleri">
            <div className="px-space-md py-space-md space-y-4">
              <label className="block">
                <span className="flex justify-between text-sm text-on-surface-variant mb-1">
                  <span>Mikrofon</span>
                  <span>{Math.round(voice.audioSettings.micVolume * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={Math.round(voice.audioSettings.micVolume * 100)}
                  onChange={(e) => voice.setMicVolume(Number(e.target.value) / 100)}
                  className="w-full accent-primary-container"
                />
              </label>
              <label className="block">
                <span className="flex justify-between text-sm text-on-surface-variant mb-1">
                  <span>Kulaklık / hoparlör</span>
                  <span>{Math.round(voice.audioSettings.outputVolume * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={Math.round(voice.audioSettings.outputVolume * 100)}
                  onChange={(e) => voice.setOutputVolume(Number(e.target.value) / 100)}
                  className="w-full accent-primary-container"
                />
              </label>
            </div>
          </SettingsSection>
          <SettingsSection title="Ses kalitesi">
            <SettingsSelect
              label="Yayın bitrate"
              value={String(voice.audioSettings.audioBitrateKbps)}
              options={VOICE_BITRATE_PRESETS.map((kbps) => ({
                value: String(kbps),
                label: `${kbps} kbps${kbps === 128 ? ' — Önerilen' : ''}`,
              }))}
              onChange={(v) => voice.setAudioBitrate(Number(v) as VoiceBitrateKbps)}
            />
          </SettingsSection>
          <SettingsSection title="Ses aygıtları">
            <div className="px-space-md py-2 flex justify-end">
              <button
                type="button"
                className="text-sm text-primary-container hover:underline"
                onClick={() => void voice.refreshAudioDevices(true)}
              >
                Yenile
              </button>
            </div>
            <SettingsSelect
              label="Giriş (mikrofon)"
              value={voice.audioSettings.inputDeviceId}
              options={[
                { value: '', label: 'Sistem varsayılanı' },
                ...voice.audioInputDevices.map((d) => ({
                  value: d.deviceId,
                  label: d.label,
                })),
              ]}
              onChange={(v) => void voice.setInputDevice(v)}
            />
            <SettingsSelect
              label="Çıkış (hoparlör)"
              value={voice.audioSettings.outputDeviceId}
              options={[
                { value: '', label: 'Sistem varsayılanı' },
                ...voice.audioOutputDevices.map((d) => ({
                  value: d.deviceId,
                  label: d.label,
                })),
              ]}
              onChange={(v) => void voice.setOutputDevice(v)}
            />
            <SettingsSelect
              label="Kamera"
              value={voice.audioSettings.videoDeviceId}
              options={[
                { value: '', label: 'Sistem varsayılanı' },
                ...voice.videoDevices.map((d) => ({ value: d.deviceId, label: d.label })),
              ]}
              onChange={(v) => void voice.setVideoDevice(v)}
            />
            <SettingsToggle
              label="Gürültü engelleme"
              checked={voice.noiseCancellation}
              onChange={(next) => {
                if (next !== voice.noiseCancellation) voice.toggleNoiseCancellation();
              }}
            />
          </SettingsSection>
          <SettingsSection title="Ekran paylaşımı">
            <SettingsNote>
              Çözünürlük ve FPS kişisel ayardır. Paylaşım sırasında değiştirirsen paylaşım yeniden
              başlar; ekranın gerçek çözünürlüğünü aşamaz.
            </SettingsNote>
            <SettingsToggle
              label="Otomatik uygunsuz içerik engeli"
              checked={voice.audioSettings.nsfwContentFilter !== false}
              onChange={(next) => {
                if (next) {
                  voice.setNsfwContentFilter(true);
                  return;
                }
                setNsfwDisableConfirmOpen(true);
              }}
            />
            <ConfirmDialog
              open={nsfwDisableConfirmOpen}
              title="İçerik engelini kapat?"
              description="Kapatırsan ekran paylaşımı ve kamera sırasında uygunsuz içerik otomatik engellenmez."
              confirmLabel="Engeli kapat"
              cancelLabel="Vazgeç"
              danger
              onCancel={() => setNsfwDisableConfirmOpen(false)}
              onConfirm={() => {
                voice.setNsfwContentFilter(false);
                setNsfwDisableConfirmOpen(false);
              }}
            />
            <SettingsSelect
              label="Çözünürlük"
              value={voice.audioSettings.screenShareResolution}
              options={SCREEN_SHARE_RESOLUTION_PRESETS.map((id) => ({
                value: id,
                label: SCREEN_SHARE_RESOLUTION_SPECS[id].label,
              }))}
              onChange={(v) => void voice.setScreenShareResolution(v as ScreenShareResolutionId)}
            />
            <SettingsSelect
              label="Kare hızı (FPS)"
              value={String(voice.audioSettings.screenShareFps)}
              options={SCREEN_SHARE_FPS_PRESETS.map((fps) => ({
                value: String(fps),
                label: `${fps} FPS${fps === 30 ? ' — Önerilen' : fps === 60 ? ' — Akıcı' : ''}`,
              }))}
              onChange={(v) => void voice.setScreenShareFps(Number(v) as ScreenShareFps)}
            />
            <SettingsSelect
              label="İzleme kalitesi"
              value={voice.audioSettings.screenShareViewQuality}
              options={SCREEN_SHARE_VIEW_QUALITY_PRESETS.map((id) => ({
                value: id,
                label: SCREEN_SHARE_VIEW_QUALITY_SPECS[id].label,
              }))}
              onChange={(v) =>
                voice.setScreenShareViewQuality(v as ScreenShareViewQualityId)
              }
            />
            {voice.screenSharing && (
              <SettingsNote>
                Şu an paylaşım açık — çözünürlük/FPS değişikliği paylaşımı yeniden başlatır.
              </SettingsNote>
            )}
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'appearance' && (
        <SettingsPageBody title="Görünüm" description="Tema ve medya önizleme tercihleri.">
          <SettingsSection title="Tema">
            <SettingsSelect
              label="Renk teması"
              description="Koyu Dracula veya açık görünüm."
              value={prefs.appearance.theme}
              options={[
                { value: 'dark', label: 'Koyu (Dracula)' },
                { value: 'light', label: 'Açık' },
              ]}
              onChange={(v) => setSection('appearance', { theme: v as 'dark' | 'light' })}
            />
            <SettingsSelect
              label="Mesaj yoğunluğu"
              value={prefs.appearance.messageDensity}
              options={[
                { value: 'cozy', label: 'Rahat' },
                { value: 'compact', label: 'Kompakt' },
              ]}
              onChange={(v) =>
                setSection('appearance', { messageDensity: v as 'cozy' | 'compact' })
              }
            />
          </SettingsSection>
          <SettingsSection title="Medya önizlemeleri">
            <SettingsToggle
              label="Link önizlemelerini sansürle"
              description="Mesajlardaki bağlantı kartları bulanık gelir."
              checked={Boolean(user?.censorLinkPreviews)}
              onChange={(v) => {
                void client.updateProfile({ censorLinkPreviews: v }).then((me) => {
                  setUser(me);
                  setMsg('Kaydedildi');
                });
              }}
            />
          </SettingsSection>
          <SettingsSection title="Sunucu görünümü (yalnızca sende)">
            <SettingsNote>
              Aktif sunucudayken sol panel tonu ve vurgu rengi yalnızca senin istemcinde
              değişir. Sunucu ayarlarından da düzenleyebilirsin.
            </SettingsNote>
          </SettingsSection>
          <SettingsSection>
            <SettingsNote>
              Kompakt yoğunluk satır aralığını sıkılaştırır ve mesaj gruplamasını kapatır.
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'accessibility' && (
        <SettingsPageBody
          title="Erişilebilirlik"
          description="Hareket, kontrast ve okunabilirlik tercihleri."
        >
          <SettingsSection title="Hareket">
            <SettingsToggle
              label="Azaltılmış hareket"
              description="Animasyonları ve geçişleri sadeleştir."
              checked={prefs.accessibility.reducedMotion}
              onChange={(v) => setSection('accessibility', { reducedMotion: v })}
            />
          </SettingsSection>
          <SettingsSection title="Görünürlük">
            <SettingsToggle
              label="Yüksek kontrast"
              checked={prefs.accessibility.highContrast}
              onChange={(v) => setSection('accessibility', { highContrast: v })}
            />
            <SettingsToggle
              label="Mesaj gruplama"
              description="Aynı yazardan ardışık mesajları birleştir."
              checked={prefs.accessibility.messageGrouping}
              onChange={(v) => setSection('accessibility', { messageGrouping: v })}
            />
            <SettingsToggle
              label="Bağlantıların altını çiz"
              checked={prefs.accessibility.underlineLinks}
              onChange={(v) => setSection('accessibility', { underlineLinks: v })}
            />
            <SettingsToggle
              label="Rol renklerini göster"
              checked={prefs.accessibility.roleColors}
              onChange={(v) => setSection('accessibility', { roleColors: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'system' && (
        <SettingsPageBody title="Sistem" description="Masaüstü ve performans tercihleri.">
          <SettingsSection>
            <SettingsToggle
              label="Başlangıçta aç"
              description="İşletim sistemi açılışında Dracord başlar (Windows / macOS / Linux)."
              checked={prefs.system.openOnStartup}
              onChange={(v) => setSection('system', { openOnStartup: v })}
            />
            <SettingsToggle
              label="Donanım hızlandırma"
              description="Kapalıyken ağır efektler kapatılır."
              checked={prefs.system.hardwareAcceleration}
              onChange={(v) => setSection('system', { hardwareAcceleration: v })}
            />
            <SettingsToggle
              label="Sistem tepsisine küçült"
              description="Kapatırken pencere gizlenir."
              checked={prefs.system.minimizeToTray}
              onChange={(v) => setSection('system', { minimizeToTray: v })}
            />
            <SettingsToggle
              label="Otomatik güncelleme"
              description="Yeni sürüm çıkınca arka planda indir; kurulum için onay istenir."
              checked={prefs.system.autoUpdate}
              onChange={(v) => {
                setSection('system', { autoUpdate: v });
                syncDesktopSystemPrefs({
                  ...prefs.system,
                  autoUpdate: v,
                });
              }}
            />
            <DesktopUpdateControls />
          </SettingsSection>
          <SettingsSection>
            <SettingsNote>
              Electron algılandı — başlangıç, tepsi ve güncelleme tercihleri anında uygulanır.
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'language' && (
        <SettingsPageBody
          title="Dil ve Zaman"
          description="Arayüz dili ile tarih/saat biçimi."
        >
          <SettingsSection>
            <SettingsSelect
              label="Dil"
              description="Ayarlar menüsü ve ortak etiketler bu dile uyar."
              value={prefs.language.locale}
              options={[
                { value: 'tr', label: 'Türkçe (tr-TR)' },
                { value: 'en', label: 'English (en-US)' },
              ]}
              onChange={(v) => setSection('language', { locale: v as 'tr' | 'en' })}
            />
            <SettingsToggle
              label="24 saat biçimi"
              checked={prefs.language.hour24}
              onChange={(v) => setSection('language', { hour24: v })}
            />
          </SettingsSection>
          <SettingsSection>
            <SettingsNote>
              Ayarlar navigasyonu ve ortak metinler çevrilir; sohbet gövdesi kullanıcı dilinde
              kalır.
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'developer' && (
        <SettingsPageBody
          title="Gelişmiş"
          description="Geliştirici araçları ve deneysel özellikler."
        >
          <SettingsSection>
            <SettingsToggle
              label="Geliştirici modu"
              description="Mesaj menüsünde ID kopyalama; kanal başlığında sunucu/kanal ID."
              checked={prefs.developer.developerMode}
              onChange={(v) => setSection('developer', { developerMode: v })}
            />
            <SettingsToggle
              label="Deneysel özellikler"
              description="Arayüzde deneysel çerçeve (kenarlık vurgusu) gösterir."
              checked={prefs.developer.experimental}
              onChange={(v) => setSection('developer', { experimental: v })}
            />
          </SettingsSection>
          {prefs.developer.developerMode && (
            <SettingsSection title="Kimlikler">
              <div className="px-space-md py-space-md flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Kullanıcı ID</p>
                  <p className="text-sm text-outline font-mono">{user?.id ?? '—'}</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-surface-container-high font-semibold hover:bg-surface-bright"
                  onClick={() => {
                    if (user?.id) void navigator.clipboard.writeText(user.id);
                  }}
                >
                  Kopyala
                </button>
              </div>
              <SettingsNote>
                Kanal ve sunucu ID’leri sohbet başlığındaki kimlik düğmelerinden kopyalanır.
              </SettingsNote>
            </SettingsSection>
          )}
        </SettingsPageBody>
      )}

      {tab === 'privacy-policy' && (
        <SettingsPageBody title="Gizlilik Politikası">
          <SettingsSection>
            <div className="px-space-md py-space-md space-y-3 text-sm text-on-surface-variant">
              <p>
                Güncel gizlilik politikamız herkese açık yasal sayfada yayınlanır. Hesap
                gerektiren ayarlar buradan yönetilir; metnin tamamı için yasal sayfaya gidin.
              </p>
              <a
                href={`${LEGAL_BASE}/privacy`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 px-3 items-center rounded-lg bg-primary-container text-on-primary-container font-semibold"
              >
                Gizlilik politikasını aç
              </a>
              <a
                href={`${LEGAL_BASE}/kvkk`}
                target="_blank"
                rel="noreferrer"
                className="block text-primary-container hover:underline font-semibold"
              >
                KVKK aydınlatma metni →
              </a>
            </div>
            <SettingsNote>Son güncelleme: 2026-04-01</SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'terms' && (
        <SettingsPageBody title="Hizmet Koşulları">
          <SettingsSection>
            <div className="px-space-md py-space-md space-y-3 text-sm text-on-surface-variant">
              <p>
                Hizmet koşullarının tam metni herkese açık yasal sayfada yer alır. Dracord’u
                kullanarak bu koşulları kabul etmiş olursunuz.
              </p>
              <a
                href={`${LEGAL_BASE}/terms`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 px-3 items-center rounded-lg bg-primary-container text-on-primary-container font-semibold"
              >
                Hizmet koşullarını aç
              </a>
              <a
                href={`${LEGAL_BASE}/community`}
                target="_blank"
                rel="noreferrer"
                className="block text-primary-container hover:underline font-semibold"
              >
                Topluluk kuralları →
              </a>
            </div>
            <SettingsNote>Son güncelleme: 2026-04-01</SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'kvkk' && (
        <SettingsPageBody title="KVKK">
          <SettingsSection>
            <div className="px-space-md py-space-md space-y-3 text-sm text-on-surface-variant">
              <p>Kişisel verilerin korunması aydınlatma metni yasal sayfada yayınlanır.</p>
              <a
                href={`${LEGAL_BASE}/kvkk`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 px-3 items-center rounded-lg bg-primary-container text-on-primary-container font-semibold"
              >
                KVKK metnini aç
              </a>
            </div>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'cookies' && (
        <SettingsPageBody title="Çerezler">
          <SettingsSection>
            <div className="px-space-md py-space-md space-y-3 text-sm text-on-surface-variant">
              <p>Çerez politikası ve tercihlerin özeti yasal sayfada yer alır.</p>
              <a
                href={`${LEGAL_BASE}/cookies`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 px-3 items-center rounded-lg bg-primary-container text-on-primary-container font-semibold"
              >
                Çerez politikasını aç
              </a>
            </div>
          </SettingsSection>
        </SettingsPageBody>
      )}
    </SettingsShell>
  );
}

function DesktopUpdateControls() {
  const [version, setVersion] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const versionRef = useRef(version);
  const userCheckRef = useRef(false);
  const desktop = typeof window !== 'undefined' ? window.dracordDesktop : undefined;
  versionRef.current = version;

  useEffect(() => {
    if (!desktop?.getAppVersion) {
      setVersion(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      void desktop
        .getAppVersion!()
        .then((v) => {
          if (cancelled) return;
          const s = String(v || '').trim();
          setVersion(s || null);
        })
        .catch(() => {
          if (!cancelled) setVersion(null);
        });
    };
    load();
    const t = window.setTimeout(load, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [desktop]);

  useEffect(() => {
    if (!desktop?.onUpdaterStatus) return;
    return desktop.onUpdaterStatus((payload) => {
      if (payload.currentVersion) {
        setVersion(String(payload.currentVersion));
      }
      const cur =
        payload.currentVersion ?? versionRef.current ?? '?';
      const next = payload.version ?? '?';
      const fromUser = Boolean(payload.manual || userCheckRef.current);

      if (payload.status === 'checking') {
        if (fromUser) setNote('Güncellemeler kontrol ediliyor…');
        return;
      }

      if (payload.status === 'not-available') {
        userCheckRef.current = false;
        setChecking(false);
        if (payload.dev) {
          setNote(
            `Geliştirme sürümü (v${cur}) — güncelleme kontrolü yalnızca kurulu uygulamada çalışır.`,
          );
        } else if (fromUser) {
          setNote(`Uygulama güncel (v${cur}). Yeni sürüm yok.`);
        }
        return;
      }

      if (payload.status === 'available') {
        userCheckRef.current = false;
        setChecking(false);
        setNote(`Yeni sürüm v${next} mevcut (şimdi: v${cur}).`);
        return;
      }
      if (payload.status === 'downloading') {
        setNote(`İndiriliyor… %${Math.round(payload.percent ?? 0)}`);
        return;
      }
      if (payload.status === 'downloaded') {
        userCheckRef.current = false;
        setChecking(false);
        setNote(`v${next} indirildi — yeniden başlatarak kur.`);
        return;
      }
      if (payload.status === 'error') {
        const wasUser = fromUser;
        userCheckRef.current = false;
        setChecking(false);
        if (wasUser) setNote(`Hata: ${payload.message ?? 'bilinmiyor'}`);
      }
    });
  }, [desktop]);

  if (!desktop?.isElectron) return null;

  return (
    <div className="px-space-md py-space-md space-y-2 border-t border-surface-container-high">
      <p className="font-body-sm text-on-surface">
        Uygulama sürümü:{' '}
        <span className="font-label-sm tabular-nums text-outline">
          {version ? `v${version}` : 'yükleniyor…'}
        </span>
      </p>
      <button
        type="button"
        disabled={checking}
        className="h-8 rounded-lg bg-surface-container-high px-3 font-label-sm text-on-surface hover:bg-surface-container-highest disabled:opacity-50"
        onClick={() => {
          userCheckRef.current = true;
          setChecking(true);
          setNote('Güncellemeler kontrol ediliyor…');
          void desktop
            .checkForUpdates?.()
            .then((r) => {
              if (r?.currentVersion) setVersion(String(r.currentVersion));
              if (r?.dev) {
                setNote(
                  `Geliştirme / paketlenmemiş sürüm (v${r.currentVersion || versionRef.current || '?'}) — güncelleme kontrolü yalnızca kurulu (installer) uygulamada çalışır.`,
                );
                userCheckRef.current = false;
                setChecking(false);
                return;
              }
              if (r && r.ok === false) {
                setNote(`Hata: ${r.error ?? 'kontrol başarısız'}`);
                userCheckRef.current = false;
                setChecking(false);
                return;
              }
              // Event gelmezse not takılı kalmasın
              window.setTimeout(() => {
                if (!userCheckRef.current) return;
                userCheckRef.current = false;
                setChecking(false);
                setNote((prev) =>
                  prev === 'Güncellemeler kontrol ediliyor…'
                    ? `Kontrol tamamlandı (v${versionRef.current || r?.currentVersion || '?'})`
                    : prev,
                );
              }, 28_000);
            })
            .catch(() => {
              setNote('Güncelleme kontrolü başarısız');
              userCheckRef.current = false;
              setChecking(false);
            });
        }}
      >
        {checking ? 'Kontrol ediliyor…' : 'Şimdi güncelleme kontrol et'}
      </button>
      {note ? <p className="font-body-sm text-on-surface-variant">{note}</p> : null}
    </div>
  );
}

function DesktopGamesLibrarySection() {
  const desktop = typeof window !== 'undefined' ? window.dracordDesktop : undefined;
  const canManage =
    Boolean(desktop?.scanGameLibrary) && Boolean(desktop?.getRegisteredGames);

  const [games, setGames] = useState<DracordRegisteredGame[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const refresh = useCallback(async () => {
    if (!desktop?.getRegisteredGames) return;
    try {
      const res = await desktop.getRegisteredGames();
      if (res.ok) setGames(res.games || []);
    } catch {
      /* ignore */
    }
  }, [desktop]);

  useEffect(() => {
    if (!canManage) return;
    void refresh();
  }, [canManage, refresh]);

  if (!canManage) return null;

  const sourceLabel = (g: DracordRegisteredGame) =>
    g.source === 'steam'
      ? g.steamAppId
        ? `Steam #${g.steamAppId}`
        : 'Steam'
      : g.source === 'epic'
        ? 'Epic'
        : g.source === 'manual'
          ? 'Manuel'
          : g.source || 'Oyun';

  return (
    <SettingsSection title="Oyun kütüphanesi">
      <div className="px-space-md py-space-md space-y-3">
        <p className="font-body-sm text-on-surface-variant">
          Steam kütüphanesini tara veya exe seçerek ekle. Steam’de oyun açıkken
          AppID ile otomatik “Oynuyor” görünür.
        </p>
        {msg ? <p className="font-body-sm text-secondary">{msg}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-40"
            onClick={() => {
              setBusy(true);
              setMsg(null);
              void desktop
                ?.importGameScan?.()
                .then((imp) => {
                  if (!imp?.ok) {
                    setMsg(imp?.error || 'Tarama başarısız');
                    return;
                  }
                  setGames(imp.games || []);
                  if ((imp.steamCount ?? 0) === 0 && (imp.epicCount ?? 0) === 0) {
                    setMsg(
                      imp.steamRoot
                        ? `Steam bulundu (${imp.steamRoot}) ama kurulu oyun manifesti yok.`
                        : 'Steam kurulumu bulunamadı. Exe ile manuel ekleyebilirsin.',
                    );
                  } else {
                    setMsg(
                      `Tarama tamam: ${imp.steamCount ?? 0} Steam, ${imp.epicCount ?? 0} Epic` +
                        (imp.added ? ` (+${imp.added} yeni)` : ' (liste güncellendi)'),
                    );
                  }
                })
                .catch(() => setMsg('Tarama başarısız'))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Taranıyor…' : 'Steam / Epic tara'}
          </button>
          <button
            type="button"
            disabled={busy}
            className="px-space-md py-space-sm rounded-lg bg-surface-container-high text-on-surface font-label-sm disabled:opacity-40"
            onClick={() => {
              setBusy(true);
              setMsg(null);
              void desktop
                ?.pickGameExe?.()
                .then((pick) => {
                  if (pick.canceled) return;
                  if (!pick.ok) {
                    setMsg(pick.error || 'Exe eklenemedi');
                    return;
                  }
                  if (pick.games) setGames(pick.games);
                  setEditingId(
                    pick.games?.find(
                      (g) =>
                        g.exePath?.toLowerCase() === pick.exePath?.toLowerCase(),
                    )?.appId ?? null,
                  );
                  setEditName(pick.name || '');
                  setMsg(
                    `"${pick.name}" eklendi — listeden adını düzenleyebilirsin.`,
                  );
                })
                .catch(() => setMsg('Exe seçilemedi'))
                .finally(() => setBusy(false));
            }}
          >
            Exe seç ve ekle
          </button>
        </div>
        {games.length === 0 ? (
          <SettingsNote>
            Henüz kayıtlı oyun yok. “Steam / Epic tara” veya “Exe seç ve ekle”.
          </SettingsNote>
        ) : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-outline-variant/20 rounded-lg bg-surface-container-lowest">
            {games.map((g) => (
              <li
                key={g.appId}
                className="flex items-center gap-2 px-space-sm py-space-sm"
              >
                {g.imageUrl ? (
                  <img
                    src={g.imageUrl}
                    alt=""
                    className="h-10 w-10 object-cover rounded-sm shrink-0 bg-surface-container"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-sm shrink-0 bg-surface-container" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  {editingId === g.appId ? (
                    <div className="flex gap-1">
                      <input
                        className="min-w-0 flex-1 rounded-md bg-surface-container px-space-sm py-1 font-body-sm text-on-surface"
                        value={editName}
                        autoFocus
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void desktop
                              ?.renameRegisteredGame?.(g.appId, editName)
                              .then((res) => {
                                if (res.ok) {
                                  setGames(res.games || []);
                                  setEditingId(null);
                                }
                              });
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button
                        type="button"
                        className="font-label-sm text-primary shrink-0 px-1"
                        onClick={() => {
                          void desktop
                            ?.renameRegisteredGame?.(g.appId, editName)
                            .then((res) => {
                              if (res.ok) {
                                setGames(res.games || []);
                                setEditingId(null);
                              }
                            });
                        }}
                      >
                        Kaydet
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="font-body-sm text-on-surface truncate text-left w-full hover:underline"
                      title="Adı düzenle"
                      onClick={() => {
                        setEditingId(g.appId);
                        setEditName(g.name);
                      }}
                    >
                      {g.name}
                    </button>
                  )}
                  <p className="font-label-sm text-on-surface-variant truncate">
                    {sourceLabel(g)}
                    {g.exeName ? ` · ${g.exeName}` : ''}
                  </p>
                </div>
                <label className="flex items-center gap-1 shrink-0 font-label-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={g.enabled !== false}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      void desktop
                        ?.setGameEnabled?.(g.appId, enabled)
                        .then((res) => {
                          if (res.ok) setGames(res.games || []);
                        });
                    }}
                  />
                  Algıla
                </label>
                <button
                  type="button"
                  className="font-label-sm text-error hover:underline shrink-0"
                  onClick={() => {
                    void desktop?.removeRegisteredGame?.(g.appId).then((res) => {
                      if (res.ok) setGames(res.games || []);
                    });
                  }}
                >
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSection>
  );
}

function SpotifyConnectionsSection({
  client,
}: {
  client: { getSpotifyStatus: () => Promise<{ configured: boolean; connected: boolean; authorizeUrl: string | null }>; startSpotifyOAuth: () => Promise<{ url: string | null; configured: boolean }>; disconnectSpotify: () => Promise<{ ok: true }> };
}) {
  const [spotify, setSpotify] = useState<{
    configured: boolean;
    connected: boolean;
    authorizeUrl: string | null;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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

  useEffect(() => {
    const unsub = window.dracordDesktop?.onSpotifyOAuthDone?.((payload) => {
      refresh();
      setMsg(
        payload?.status === 'error'
          ? 'Spotify bağlantısı başarısız'
          : 'Spotify bağlandı',
      );
    });
    return () => {
      unsub?.();
    };
  }, [refresh]);

  // Tarayıcı popup yolu (Electron dışı / window.open) — oauth sayfası ayrı origin olabilir
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { type?: string; status?: string } | null;
      if (data?.type !== 'dracord-spotify-oauth') return;
      refresh();
      setMsg(
        data.status === 'error'
          ? 'Spotify bağlantısı başarısız'
          : 'Spotify bağlandı',
      );
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [refresh]);

  return (
    <SettingsSection title="Spotify">
      <div className="px-space-md py-space-md space-y-2">
        {msg ? <p className="font-body-sm text-secondary">{msg}</p> : null}
        {!spotify?.configured ? (
          <SettingsNote>
            Spotify API anahtarları yapılandırılmamış (SPOTIFY_CLIENT_ID /
            SPOTIFY_CLIENT_SECRET).
          </SettingsNote>
        ) : spotify.connected ? (
          <>
            <p className="font-body-md text-on-surface">Spotify bağlı</p>
            <p className="font-body-sm text-on-surface-variant">
              Çalan parçan profilinde “Dinliyor” olarak görünür.
            </p>
            <button
              type="button"
              className="font-label-sm text-error hover:underline"
              onClick={() => {
                void client.disconnectSpotify().then(() => {
                  refresh();
                  setMsg('Spotify bağlantısı kesildi');
                });
              }}
            >
              Bağlantıyı kes
            </button>
          </>
        ) : (
          <>
            <p className="font-body-sm text-on-surface-variant">
              Hesabını bağla; Currently Playing ile dinlediğin şarkı profilde
              görünür.
            </p>
            <button
              type="button"
              disabled={!spotify.authorizeUrl}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-40"
              onClick={() => {
                if (!spotify.authorizeUrl) return;
                const desktop = window.dracordDesktop;
                if (desktop?.openOAuth) void desktop.openOAuth(spotify.authorizeUrl);
                else {
                  const w = window.open(
                    spotify.authorizeUrl,
                    'dracord-spotify',
                    'width=560,height=740',
                  );
                  if (!w) window.location.href = spotify.authorizeUrl;
                }
              }}
            >
              Spotify bağla
            </button>
          </>
        )}
      </div>
    </SettingsSection>
  );
}
