'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';

export default function TermsPage() {
  return (
    <SettingsPage title="Hizmet Koşulları">
      <SettingsSection>
        <div className="px-space-md py-space-md space-y-space-sm font-body-sm text-on-surface-variant">
          <p>
            Dracord’u kullanarak topluluk kurallarımıza uymayı kabul edersiniz: taciz,
            yasa dışı içerik ve spam yasaktır. Hesap güvenliğinden siz sorumlusunuz.
          </p>
          <p>
            Hizmet “olduğu gibi” sunulur; özellikler değişebilir. Ödeme gerektiren
            özellikler ayrı koşullara tabi olacaktır.
          </p>
        </div>
        <SettingsNote>Son güncelleme: 2026-09-29</SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
