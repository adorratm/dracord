'use client';

import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';

function addMonths(isoOrNow: string | null, months: number): string {
  const d = isoOrNow ? new Date(isoOrNow) : new Date();
  if (d.getTime() < Date.now()) d.setTime(Date.now());
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export default function NitroPage() {
  const { prefs, setSection } = useUserPreferences();
  const plan = prefs.billing.nitroPlan;
  const expires = prefs.billing.nitroExpiresAt
    ? new Date(prefs.billing.nitroExpiresAt).toLocaleDateString('tr-TR')
    : null;

  const subscribe = (next: 'basic' | 'nitro', label: string, amount: string) => {
    const expiresAt = addMonths(prefs.billing.nitroExpiresAt, 1);
    setSection('billing', {
      nitroPlan: next,
      nitroExpiresAt: expiresAt,
      invoices: [
        {
          id: newId('inv'),
          label,
          amount,
          at: new Date().toISOString(),
        },
        ...prefs.billing.invoices,
      ].slice(0, 20),
    });
  };

  const cancel = () => {
    setSection('billing', { nitroPlan: 'none', nitroExpiresAt: null });
  };

  return (
    <SettingsPage
      title="Nitro"
      description="Demo abonelik — gerçek ödeme alınmaz; hesabına kaydedilir."
    >
      <SettingsSection title="Durum">
        <div className="px-space-md py-space-md space-y-1">
          <p className="font-body-md">
            Plan:{' '}
            <span className="text-primary-container font-label-md">
              {plan === 'none' ? 'Yok' : plan === 'basic' ? 'Nitro Basic' : 'Nitro'}
            </span>
          </p>
          {expires && (
            <p className="font-body-sm text-on-surface-variant">Bitiş: {expires}</p>
          )}
          {plan !== 'none' && (
            <button
              type="button"
              onClick={cancel}
              className="mt-2 px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm"
            >
              Aboneliği iptal et
            </button>
          )}
        </div>
      </SettingsSection>
      <SettingsSection title="Planlar">
        <div className="px-space-md py-space-md space-y-space-sm">
          <div className="rounded-lg border border-surface-container-highest p-space-md">
            <p className="font-headline-md">Nitro Basic</p>
            <p className="font-body-sm text-on-surface-variant mt-1">
              Daha büyük yüklemeler ve özel emojiler (demo).
            </p>
            <button
              type="button"
              disabled={plan === 'basic'}
              onClick={() => subscribe('basic', 'Nitro Basic (demo)', '₺49')}
              className="mt-space-sm px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
            >
              {plan === 'basic' ? 'Aktif' : 'Etkinleştir (ücretsiz demo)'}
            </button>
          </div>
          <div className="rounded-lg border border-primary-container/40 p-space-md">
            <p className="font-headline-md">Nitro</p>
            <p className="font-body-sm text-on-surface-variant mt-1">
              HD video, sunucu takviyesi kredisi ve daha fazlası (demo).
            </p>
            <button
              type="button"
              disabled={plan === 'nitro'}
              onClick={() => {
                const expiresAt = addMonths(prefs.billing.nitroExpiresAt, 1);
                setSection('billing', {
                  nitroPlan: 'nitro',
                  nitroExpiresAt: expiresAt,
                  boostCredits: prefs.billing.boostCredits + 2,
                  invoices: [
                    {
                      id: newId('inv'),
                      label: 'Nitro (demo)',
                      amount: '₺99',
                      at: new Date().toISOString(),
                    },
                    ...prefs.billing.invoices,
                  ].slice(0, 20),
                });
              }}
              className="mt-space-sm px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
            >
              {plan === 'nitro' ? 'Aktif' : 'Etkinleştir (+2 takviye)'}
            </button>
          </div>
        </div>
        <SettingsNote>
          Nitro aktifken profilinde rozet gösterilir. Ödeme altyapısı yok — yalnızca demo.
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
