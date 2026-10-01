'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsToggle,
  SettingsSelect,
} from '@/components/settings/SettingsControls';
import { useI18n } from '@/lib/i18n';
import { useUserPreferences } from '@/lib/user-preferences';

export default function MessagingPermissionsPage() {
  const { prefs, setSection } = useUserPreferences();
  const { t, locale } = useI18n();

  return (
    <SettingsPage title={t('msg.title')} description={t('msg.desc')}>
      <SettingsSection title={locale === 'en' ? 'Permissions' : 'İzinler'}>
        <SettingsSelect
          label={locale === 'en' ? 'Who can DM you' : 'Kimler DM atabilir'}
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
          label={locale === 'en' ? 'Link embeds' : 'Bağlantı gömme (embed)'}
          description={
            locale === 'en'
              ? 'Show preview cards for pasted links.'
              : 'Yapıştırılan linkler için önizleme kartı göster.'
          }
          checked={prefs.messaging.autoEmbed}
          onChange={(v) => setSection('messaging', { autoEmbed: v })}
        />
        <SettingsToggle
          label={locale === 'en' ? 'Spellcheck' : 'Yazım denetimi'}
          checked={prefs.messaging.spellcheck}
          onChange={(v) => setSection('messaging', { spellcheck: v })}
        />
      </SettingsSection>
      <SettingsSection title={locale === 'en' ? 'Content filter' : 'İçerik filtresi'}>
        <SettingsToggle
          label={t('msg.filter')}
          description={t('msg.filterDesc')}
          checked={Boolean(prefs.messaging.filterExplicit)}
          onChange={(v) => setSection('messaging', { filterExplicit: v })}
        />
      </SettingsSection>
    </SettingsPage>
  );
}
