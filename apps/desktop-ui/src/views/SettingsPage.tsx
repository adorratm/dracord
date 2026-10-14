import { useCallback, useEffect, useState } from 'react';
import type { ClientSettings } from '@dracord/types';
import { SettingsShell } from '@dracord/ui';
import { API_URL } from '../config';
import { useAuth } from '../auth';
import {
  applyPrefsDom,
  DEFAULT_CLIENT_SETTINGS,
  mergeClientSettings,
} from '../lib/client-settings';
import {
  SettingsNote,
  SettingsPageBody,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
} from '../components/settings/SettingsControls';

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

const STORAGE_KEY = 'dracord.userPreferences.v1';

function loadLocal(): ClientSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CLIENT_SETTINGS;
    return mergeClientSettings(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return DEFAULT_CLIENT_SETTINGS;
  }
}

export function SettingsPage({ onClose }: { onClose?: () => void }) {
  const { user, logout, client } = useAuth();
  const [tab, setTab] = useState<Tab>('account');
  const [prefs, setPrefs] = useState<ClientSettings>(loadLocal);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    applyPrefsDom(prefs);
  }, [prefs]);

  useEffect(() => {
    void client
      .getClientSettings()
      .then((remote) => {
        const merged = mergeClientSettings(remote as unknown as Record<string, unknown>);
        setPrefs(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        applyPrefsDom(merged);
      })
      .catch(() => {
        /* yerel prefs yeterli */
      });
  }, [client]);

  const setSection = useCallback(
    <K extends keyof ClientSettings>(key: K, value: Partial<ClientSettings[K]>) => {
      setPrefs((prev) => {
        const next = {
          ...prev,
          [key]: { ...(prev[key] as object), ...value },
        } as ClientSettings;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        applyPrefsDom(next);
        void client.updateClientSettings({ [key]: next[key] } as Partial<ClientSettings>).catch(() => {});
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
            item('account', 'Hesabım', 'person'),
            item('profile', 'Profil', 'badge'),
            item('password', 'Şifre', 'lock'),
            item('account-status', 'Hesap durumu', 'manage_accounts'),
            item('privacy', 'Gizlilik', 'shield'),
            item('messaging', 'Mesajlaşma', 'forum'),
            item('bookmarks', 'Yer imleri', 'bookmark'),
            item('notifications', 'Bildirimler', 'notifications'),
          ],
        },
        {
          id: 'billing',
          title: 'Faturalandırma',
          items: [
            item('nitro', 'Nitro', 'workspace_premium'),
            item('boost', 'Boost', 'diamond'),
            item('subscriptions', 'Abonelikler', 'receipt_long'),
            item('gifts', 'Hediyeler', 'card_giftcard'),
          ],
        },
        {
          id: 'experience',
          title: 'Uygulama',
          items: [
            item('voice', 'Ses ve görüntü', 'mic'),
            item('appearance', 'Görünüm', 'palette'),
            item('accessibility', 'Erişilebilirlik', 'accessibility_new'),
            item('system', 'Sistem', 'dns'),
            item('language', 'Dil', 'language'),
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
              label: 'Çıkış yap',
              icon: 'logout',
              variant: 'danger' as const,
              onClick: () => logout(),
            },
            item('privacy-policy', 'Gizlilik politikası', 'policy'),
            item('terms', 'Kullanım şartları', 'gavel'),
            item('kvkk', 'KVKK', 'verified_user'),
            item('cookies', 'Çerezler', 'cookie'),
          ],
        },
      ]}
    >
      {error && <p className="text-error mb-3">{error}</p>}
      {msg && <p className="text-primary-container mb-3">{msg}</p>}

      {tab === 'account' && (
        <SettingsPageBody title="Hesabım" description="Hesap bilgilerin ve güvenlik özeti.">
          <SettingsSection>
            <SettingsNote>
              <p className="mb-1">@{user?.username}</p>
              <p className="mb-1">API: {API_URL}</p>
              <p>2FA: {user?.twoFactorEnabled ? 'Açık' : 'Kapalı'}</p>
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'profile' && (
        <SettingsPageBody title="Profil" description="Diğer kullanıcılara görünen profil bilgilerin.">
          <SettingsSection title="Kimlik">
            <div className="px-space-md py-space-md space-y-3">
              <label className="block">
                <span className="text-xs text-on-surface-variant">Görünen ad</span>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-on-surface-variant">Bio</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-highest outline-none"
                />
              </label>
              <button
                type="button"
                className="h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
                onClick={() => {
                  setError(null);
                  void client
                    .updateProfile({ displayName: displayName.trim(), bio })
                    .then(() => setMsg('Profil güncellendi'))
                    .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
                }}
              >
                Kaydet
              </button>
            </div>
          </SettingsSection>
          <SettingsSection title="Link önizleme">
            <SettingsToggle
              label="Link önizlemelerini sansürle"
              checked={Boolean(user?.censorLinkPreviews)}
              onChange={(v) => {
                void client.updateProfile({ censorLinkPreviews: v }).then(() => setMsg('Güncellendi'));
              }}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'password' && (
        <SettingsPageBody title="Şifre" description="Hesap şifreni güncelle.">
          <SettingsSection>
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
        </SettingsPageBody>
      )}

      {tab === 'account-status' && (
        <SettingsPageBody title="Hesap durumu">
          <SettingsSection>
            <SettingsNote>
              Plan: {prefs.billing.nitroPlan === 'none' ? 'Ücretsiz' : prefs.billing.nitroPlan}
              <br />
              Boost kredisi: {prefs.billing.boostCredits}
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'privacy' && (
        <SettingsPageBody
          title="Veri ve gizlilik"
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
        </SettingsPageBody>
      )}

      {tab === 'messaging' && (
        <SettingsPageBody title="Mesajlaşma">
          <SettingsSection>
            <SettingsToggle
              label="Açık içerik filtresi"
              checked={prefs.messaging.filterExplicit}
              onChange={(v) => setSection('messaging', { filterExplicit: v })}
            />
            <SettingsToggle
              label="Otomatik gömülü önizleme"
              checked={prefs.messaging.autoEmbed}
              onChange={(v) => setSection('messaging', { autoEmbed: v })}
            />
            <SettingsToggle
              label="Yazım denetimi"
              checked={prefs.messaging.spellcheck}
              onChange={(v) => setSection('messaging', { spellcheck: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'bookmarks' && (
        <SettingsPageBody title="Yer imleri" description="Kaydettiğin mesajlara web üzerinden erişebilirsin.">
          <SettingsSection>
            <SettingsNote>Yer imleri listesi sunucudan senkronlanır; desktop’ta okuma yakında.</SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'notifications' && (
        <SettingsPageBody title="Bildirimler">
          <SettingsSection>
            <SettingsToggle
              label="Masaüstü bildirimleri"
              checked={prefs.notifications.desktopEnabled}
              onChange={(v) => setSection('notifications', { desktopEnabled: v })}
            />
            <SettingsToggle
              label="Ses"
              checked={prefs.notifications.soundEnabled}
              onChange={(v) => setSection('notifications', { soundEnabled: v })}
            />
            <SettingsToggle
              label="Okunmamış rozeti"
              checked={prefs.notifications.unreadBadge}
              onChange={(v) => setSection('notifications', { unreadBadge: v })}
            />
            <SettingsToggle
              label="Yalnızca bahsetmeler"
              checked={prefs.notifications.mentionsOnly}
              onChange={(v) => setSection('notifications', { mentionsOnly: v })}
            />
            <SettingsToggle
              label="Sessiz saatler"
              checked={prefs.notifications.quietHours}
              onChange={(v) => setSection('notifications', { quietHours: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {(tab === 'nitro' || tab === 'boost' || tab === 'subscriptions' || tab === 'gifts') && (
        <SettingsPageBody
          title={
            tab === 'nitro'
              ? 'Nitro'
              : tab === 'boost'
                ? 'Boost'
                : tab === 'subscriptions'
                  ? 'Abonelikler'
                  : 'Hediyeler'
          }
          description="Faturalandırma web ile aynı hesap üzerinden yönetilir."
        >
          <SettingsSection>
            <SettingsNote>
              Plan: {prefs.billing.nitroPlan}
              <br />
              Boost: {prefs.billing.boostCredits}
              <br />
              Hediyeler: {prefs.billing.gifts?.length ?? 0}
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'voice' && (
        <SettingsPageBody
          title="Ses ve görüntü"
          description="Mikrofon, kulaklık ve kamera tercihleri ses odası sahnesinden yönetilir (LiveKit)."
        >
          <SettingsSection title="Etkinlik">
            <SettingsToggle
              label="Etkinliği göster"
              checked={prefs.activity.displayActivity}
              onChange={(v) => setSection('activity', { displayActivity: v })}
            />
            <SettingsToggle
              label="Oyunları paylaş"
              checked={prefs.activity.shareGames}
              onChange={(v) => setSection('activity', { shareGames: v })}
            />
            <SettingsToggle
              label="Katılma isteklerine izin ver"
              checked={prefs.activity.allowJoinRequests}
              onChange={(v) => setSection('activity', { allowJoinRequests: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'appearance' && (
        <SettingsPageBody title="Görünüm">
          <SettingsSection>
            <SettingsSelect
              label="Tema"
              value={prefs.appearance.theme}
              options={[
                { value: 'dark', label: 'Koyu' },
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
        </SettingsPageBody>
      )}

      {tab === 'accessibility' && (
        <SettingsPageBody title="Erişilebilirlik">
          <SettingsSection>
            <SettingsToggle
              label="Hareketi azalt"
              checked={prefs.accessibility.reducedMotion}
              onChange={(v) => setSection('accessibility', { reducedMotion: v })}
            />
            <SettingsToggle
              label="Yüksek kontrast"
              checked={prefs.accessibility.highContrast}
              onChange={(v) => setSection('accessibility', { highContrast: v })}
            />
            <SettingsToggle
              label="Mesaj gruplama"
              checked={prefs.accessibility.messageGrouping}
              onChange={(v) => setSection('accessibility', { messageGrouping: v })}
            />
            <SettingsToggle
              label="Bağlantıların altını çiz"
              checked={prefs.accessibility.underlineLinks}
              onChange={(v) => setSection('accessibility', { underlineLinks: v })}
            />
            <SettingsToggle
              label="Rol renkleri"
              checked={prefs.accessibility.roleColors}
              onChange={(v) => setSection('accessibility', { roleColors: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'system' && (
        <SettingsPageBody title="Sistem" description="Masaüstü istemci davranışları.">
          <SettingsSection>
            <SettingsToggle
              label="Açılışta başlat"
              checked={prefs.system.openOnStartup}
              onChange={(v) => {
                setSection('system', { openOnStartup: v });
                localStorage.setItem('dracord.desktop.startup', v ? '1' : '0');
              }}
            />
            <SettingsToggle
              label="Donanım hızlandırma"
              checked={prefs.system.hardwareAcceleration}
              onChange={(v) => setSection('system', { hardwareAcceleration: v })}
            />
            <SettingsToggle
              label="Tepsiye küçült"
              checked={prefs.system.minimizeToTray}
              onChange={(v) => setSection('system', { minimizeToTray: v })}
            />
            <SettingsToggle
              label="Otomatik güncelleme"
              checked={prefs.system.autoUpdate}
              onChange={(v) => setSection('system', { autoUpdate: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'language' && (
        <SettingsPageBody title="Dil">
          <SettingsSection>
            <SettingsSelect
              label="Arayüz dili"
              value={prefs.language.locale}
              options={[
                { value: 'tr', label: 'Türkçe' },
                { value: 'en', label: 'English' },
              ]}
              onChange={(v) => setSection('language', { locale: v as 'tr' | 'en' })}
            />
            <SettingsToggle
              label="24 saat formatı"
              checked={prefs.language.hour24}
              onChange={(v) => setSection('language', { hour24: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {tab === 'developer' && (
        <SettingsPageBody title="Gelişmiş">
          <SettingsSection>
            <SettingsToggle
              label="Geliştirici modu"
              description="Kimlikleri kopyalama ve ek hata ayrıntıları."
              checked={prefs.developer.developerMode}
              onChange={(v) => setSection('developer', { developerMode: v })}
            />
            <SettingsToggle
              label="Deneysel arayüz"
              checked={prefs.developer.experimental}
              onChange={(v) => setSection('developer', { experimental: v })}
            />
          </SettingsSection>
        </SettingsPageBody>
      )}

      {(tab === 'privacy-policy' || tab === 'terms' || tab === 'kvkk' || tab === 'cookies') && (
        <SettingsPageBody
          title={
            tab === 'privacy-policy'
              ? 'Gizlilik politikası'
              : tab === 'terms'
                ? 'Kullanım şartları'
                : tab === 'kvkk'
                  ? 'KVKK'
                  : 'Çerezler'
          }
        >
          <SettingsSection>
            <SettingsNote>
              Yasal metinler için https://dracord.com.tr/legal adresini ziyaret et.
            </SettingsNote>
          </SettingsSection>
        </SettingsPageBody>
      )}
    </SettingsShell>
  );
}
