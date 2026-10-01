'use client';

import Link from 'next/link';
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
            Hizmet koşullarının tam metni herkese açık yasal sayfada yer alır. Dracord’u
            kullanarak bu koşulları kabul etmiş olursunuz.
          </p>
          <Link
            href="/legal/terms"
            className="inline-flex h-9 px-3 items-center rounded-lg bg-primary-container text-on-primary-container font-label-sm"
          >
            Hizmet koşullarını aç
          </Link>
          <Link
            href="/legal/community"
            className="block text-primary-container hover:underline font-label-sm"
          >
            Topluluk kuralları →
          </Link>
        </div>
        <SettingsNote>Son güncelleme: 2026-04-01</SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
