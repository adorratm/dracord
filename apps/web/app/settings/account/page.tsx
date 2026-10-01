'use client';

import type { PresenceStatus } from '@dracord/types';
import { presenceLabelTr } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { resetAppTour } from '@/lib/onboarding';

const STATUSES: PresenceStatus[] = ['ONLINE', 'IDLE', 'DND', 'OFFLINE'];

export default function AccountInfoPage() {
  const router = useRouter();
  const { user, client, setUser } = useAuth();
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? '');
  const [saving, setSaving] = useState(false);

  const applyStatus = async (status: PresenceStatus, custom?: string | null) => {
    setSaving(true);
    try {
      const me = await client.updatePresence({
        status,
        customStatus: custom !== undefined ? custom : customStatus.trim() || null,
      });
      setUser(me);
      setCustomStatus(me.customStatus ?? '');
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsPage
      title="Hesap Bilgileri"
      description="Profil özetin, durumun ve oturum bilgilerin."
    >
      <SettingsSection title="Hesap">
        <div className="px-space-md py-space-md space-y-space-sm">
          <p className="font-headline-md text-headline-md">
            {user?.displayName ?? '—'}
          </p>
          <p className="font-body-sm text-outline">@{user?.username ?? '—'}</p>
          <p className="font-body-sm text-on-surface-variant">
            Durum: {presenceLabelTr(user?.status ?? 'OFFLINE', user?.customStatus)}
          </p>
          <button
            type="button"
            className="mt-space-sm text-primary-container font-body-sm hover:underline"
            onClick={() => router.push('/settings/profile')}
          >
            Profili düzenle
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Durum">
        <div className="px-space-md py-space-md space-y-space-sm">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={saving}
                onClick={() => void applyStatus(s)}
                className={`px-3 py-1.5 rounded-lg font-label-sm ${
                  user?.status === s
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                }`}
              >
                {presenceLabelTr(s)}
              </button>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="font-label-sm text-on-surface-variant">Özel durum</span>
            <div className="flex gap-2">
              <input
                className="flex-1 h-10 rounded-lg bg-surface-container-highest px-3 text-on-surface outline-none"
                value={customStatus}
                maxLength={128}
                placeholder="Ne yapıyorsun?"
                onChange={(e) => setCustomStatus(e.target.value)}
              />
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void applyStatus(user?.status ?? 'ONLINE', customStatus.trim() || null)
                }
                className="px-4 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
              >
                Kaydet
              </button>
            </div>
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title="Yardım">
        <div className="px-space-md py-space-md space-y-space-sm">
          <p className="font-body-sm text-on-surface-variant">
            Arayüzü yeniden tanımak için kısa turu başlatabilirsin.
          </p>
          <button
            type="button"
            onClick={() => {
              resetAppTour();
              window.dispatchEvent(new Event('dracord:start-tour'));
              router.push('/channels/@me');
            }}
            className="px-space-lg py-space-sm rounded-lg bg-surface-container-high text-on-surface font-headline-md hover:bg-surface-bright"
          >
            Uygulama turunu başlat
          </button>
        </div>
        <SettingsNote>
          Çıkış yapmak için sol menüdeki “Çıkış Yap”ı kullan.
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
