'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useI18n } from '@/lib/i18n';
import { useUserPreferences } from '@/lib/user-preferences';

export default function LanguageSettingsPage() {
  const { prefs, setSection } = useUserPreferences();
  const { t } = useI18n();

  return (
    <SettingsPage title={t('lang.title')} description={t('lang.desc')}>
      <SettingsSection>
        <SettingsSelect
          label={t('lang.locale')}
          description={t('lang.localeDesc')}
          value={prefs.language.locale}
          options={[
            { value: 'tr', label: 'Türkçe (tr-TR)' },
            { value: 'en', label: 'English (en-US)' },
          ]}
          onChange={(v) => setSection('language', { locale: v as 'tr' | 'en' })}
        />
        <SettingsToggle
          label={t('lang.hour24')}
          checked={prefs.language.hour24}
          onChange={(v) => setSection('language', { hour24: v })}
        />
      </SettingsSection>
      <SettingsSection>
        <SettingsNote>{t('lang.note')}</SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
