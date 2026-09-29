'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsSelect,
  SettingsToggle,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

export default function LanguageSettingsPage() {
  const { prefs, setSection } = useUserPreferences();

  return (
    <SettingsPage
      title={prefs.language.locale === 'en' ? 'Language & Time' : 'Dil ve Zaman'}
      description={
        prefs.language.locale === 'en'
          ? 'App language and clock format.'
          : 'Arayüz dili ve saat biçimi.'
      }
    >
      <SettingsSection>
        <SettingsSelect
          label={prefs.language.locale === 'en' ? 'Language' : 'Dil'}
          description={
            prefs.language.locale === 'en'
              ? 'Changes document language and date/time formatting.'
              : 'Belge dili ve tarih/saat biçimini değiştirir.'
          }
          value={prefs.language.locale}
          options={[
            { value: 'tr', label: 'Türkçe' },
            { value: 'en', label: 'English' },
          ]}
          onChange={(v) => setSection('language', { locale: v as 'tr' | 'en' })}
        />
        <SettingsToggle
          label={prefs.language.locale === 'en' ? '24-hour clock' : '24 saat biçimi'}
          checked={prefs.language.hour24}
          onChange={(v) => setSection('language', { hour24: v })}
        />
      </SettingsSection>
      <SettingsSection>
        <SettingsNote>
          {prefs.language.locale === 'en'
            ? 'Message timestamps and notification times follow this setting immediately.'
            : 'Mesaj saatleri ve bildirim zamanları bu tercihe hemen uyar.'}
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
