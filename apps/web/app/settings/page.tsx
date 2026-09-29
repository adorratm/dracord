'use client';

import type { PresenceStatus } from '@dracord/types';
import { presenceLabelTr } from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { resetAppTour } from '@/lib/onboarding';

const STATUSES: PresenceStatus[] = ['ONLINE', 'IDLE', 'DND', 'OFFLINE'];

export default function SettingsAccountPage() {
  const router = useRouter();
  const { user, logout, client, setUser } = useAuth();
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? '');
  const [saving, setSaving] = useState(false);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

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
    <div className="max-w-2xl px-space-xl py-space-xl space-y-space-lg">
      <section>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-space-sm">Hesabım</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
          Profil bilgilerin ve oturum yönetimi.
        </p>
        <div className="rounded-xl bg-surface-container-low p-space-lg space-y-space-sm">
          <p className="font-headline-md text-headline-md">{user?.displayName ?? '—'}</p>
          <p className="font-body-sm text-body-sm text-outline">@{user?.username ?? '—'}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
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
      </section>

      <section>
        <h3 className="font-headline-md text-headline-md mb-space-sm">Durum</h3>
        <div className="rounded-xl bg-surface-container-low p-space-lg space-y-space-sm">
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
                onClick={() => void applyStatus(user?.status ?? 'ONLINE', customStatus.trim() || null)}
                className="px-4 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
              >
                Kaydet
              </button>
            </div>
          </label>
        </div>
      </section>

      <section>
        <h3 className="font-headline-md text-headline-md mb-space-sm">Yardım</h3>
        <div className="rounded-xl bg-surface-container-low p-space-lg space-y-space-sm">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
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
      </section>

      <section>
        <h3 className="font-headline-md text-headline-md mb-space-sm">Oturum</h3>
        <button
          type="button"
          onClick={handleLogout}
          className="px-space-lg py-space-sm rounded-lg bg-error-container text-on-error-container font-headline-md hover:opacity-90"
        >
          Çıkış yap
        </button>
      </section>
    </div>
  );
}
