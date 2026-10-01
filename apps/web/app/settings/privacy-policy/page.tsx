'use client';

import Link from 'next/link';
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
            Güncel gizlilik politikamız herkese açık yasal sayfada yayınlanır. Hesap
            gerektiren ayarlar buradan yönetilir; metnin tamamı için yasal sayfaya gidin.
          </p>
          <Link
            href="/legal/privacy"
            className="inline-flex h-9 px-3 items-center rounded-lg bg-primary-container text-on-primary-container font-label-sm"
          >
            Gizlilik politikasını aç
          </Link>
          <Link href="/legal/kvkk" className="block text-primary-container hover:underline font-label-sm">
            KVKK aydınlatma metni →
          </Link>
        </div>
        <SettingsNote>Son güncelleme: 2026-04-01</SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
