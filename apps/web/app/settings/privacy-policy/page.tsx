'use client';

import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';

export default function PrivacyPolicyPage() {
  return (
    <SettingsPage title="Gizlilik Politikası">
      <SettingsSection>
        <div className="px-space-md py-space-md space-y-space-sm font-body-sm text-on-surface-variant">
          <p>
            Dracord, sohbet deneyimini sunmak için hesap bilgilerinizi, mesajlarınızı ve
            teknik günlükleri işler. Verileriniz mümkün olduğunca şifreli saklanır ve
            üçüncü taraflarla satılmaz.
          </p>
          <p>
            İletişim tercihlerinizi Ayarlar → Veri ve Gizlilik bölümünden yönetebilirsiniz.
            Resmi metin güncellendikçe burada yayınlanır.
          </p>
        </div>
        <SettingsNote>Son güncelleme: 2026-09-29</SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
