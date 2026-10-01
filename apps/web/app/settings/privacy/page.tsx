'use client';

import Link from 'next/link';
import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsSelect,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useI18n } from '@/lib/i18n';
import { useUserPreferences } from '@/lib/user-preferences';

export default function PrivacySettingsPage() {
  const { prefs, setSection } = useUserPreferences();
  const { t, locale } = useI18n();

  return (
    <SettingsPage
      title={locale === 'en' ? 'Data & Privacy' : 'Veri ve Gizlilik'}
      description={
        locale === 'en'
          ? 'Control who can interact with you and what you share.'
          : 'Kimlerle etkileşime geçtiğini ve profil görünürlüğünü kontrol et.'
      }
    >
      <SettingsSection title={locale === 'en' ? 'Social' : 'Sosyal'}>
        <SettingsSelect
          label={locale === 'en' ? 'Direct message filter' : 'Direkt mesaj filtresi'}
          description={
            locale === 'en'
              ? 'Limit who can send you DMs.'
              : 'Kimlerden DM alabileceğini sınırla.'
          }
          value={prefs.messaging.whoCanDm}
          options={[
            { value: 'everyone', label: locale === 'en' ? 'Everyone' : 'Herkes' },
            { value: 'friends', label: locale === 'en' ? 'Friends' : 'Arkadaşlar' },
            { value: 'nobody', label: locale === 'en' ? 'Nobody' : 'Kimse' },
          ]}
          onChange={(v) => {
            const level = v as 'everyone' | 'friends' | 'nobody';
            setSection('messaging', { whoCanDm: level });
            setSection('privacy', { dmFilter: level });
          }}
        />
        <SettingsToggle
          label={
            locale === 'en' ? 'Allow friend requests' : 'Arkadaşlık isteklerine izin ver'
          }
          checked={prefs.privacy.allowFriendRequests}
          onChange={(v) => setSection('privacy', { allowFriendRequests: v })}
        />
        <p className="font-body-sm text-body-sm text-on-surface-variant px-1 pt-space-sm">
          {locale === 'en' ? (
            <>
              Manage blocked users in{' '}
              <Link href="/channels/me" className="text-primary-container hover:underline">
                Friends → Blocked
              </Link>
              .
            </>
          ) : (
            <>
              Engellenen kullanıcıları yönetmek için{' '}
              <Link href="/channels/me" className="text-primary-container hover:underline">
                Arkadaşlar → Engellenen
              </Link>{' '}
              sekmesine git.
            </>
          )}
        </p>
      </SettingsSection>
      <SettingsSection title={locale === 'en' ? 'Profile visibility' : 'Profil görünürlüğü'}>
        <SettingsToggle
          label={locale === 'en' ? 'Show bio' : 'Biyografi göster'}
          checked={prefs.privacy.showBio !== false}
          onChange={(v) => setSection('privacy', { showBio: v })}
        />
        <SettingsToggle
          label={locale === 'en' ? 'Show social links' : 'Sosyal bağlantıları göster'}
          checked={prefs.privacy.showSocialLinks !== false}
          onChange={(v) => setSection('privacy', { showSocialLinks: v })}
        />
        <SettingsToggle
          label={locale === 'en' ? 'Show banner' : 'Banner göster'}
          checked={prefs.privacy.showBanner !== false}
          onChange={(v) => setSection('privacy', { showBanner: v })}
        />
        <SettingsToggle
          label={locale === 'en' ? 'Show custom status' : 'Özel durum göster'}
          checked={prefs.privacy.showCustomStatus !== false}
          onChange={(v) => setSection('privacy', { showCustomStatus: v })}
        />
      </SettingsSection>
      <SettingsSection title={locale === 'en' ? 'Data & activity' : 'Veri ve etkinlik'}>
        <SettingsToggle
          label={t('privacy.data')}
          description={t('privacy.dataDesc')}
          checked={Boolean(prefs.privacy.dataCollection)}
          onChange={(v) => setSection('privacy', { dataCollection: v })}
        />
        <SettingsToggle
          label={t('privacy.ads')}
          description={t('privacy.adsDesc')}
          checked={Boolean(prefs.privacy.personalizeAds)}
          onChange={(v) => setSection('privacy', { personalizeAds: v })}
        />
        <SettingsToggle
          label={t('privacy.activity')}
          description={t('privacy.activityDesc')}
          checked={Boolean(prefs.privacy.shareActivityStatus)}
          onChange={(v) => {
            setSection('privacy', { shareActivityStatus: v });
            setSection('activity', { displayActivity: v });
          }}
        />
        <SettingsNote>
          {locale === 'en'
            ? 'Link preview censorship is under Appearance.'
            : 'Link önizleme sansürü Görünüm ayarlarında.'}
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
