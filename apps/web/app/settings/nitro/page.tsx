'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useUserPreferences } from '@/lib/user-preferences';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';

type BillingSnap = {
  nitroPlan: 'none' | 'basic' | 'nitro';
  nitroExpiresAt: string | null;
  boostCredits: number;
};

export default function NitroPage() {
  const { client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [billing, setBilling] = useState<BillingSnap>({
    nitroPlan: prefs.billing.nitroPlan,
    nitroExpiresAt: prefs.billing.nitroExpiresAt,
    boostCredits: prefs.billing.boostCredits,
  });
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await client.requestBillingMe();
      setBilling({
        nitroPlan: me.billing.nitroPlan,
        nitroExpiresAt: me.billing.nitroExpiresAt,
        boostCredits: me.billing.boostCredits,
      });
      setPaymentsEnabled(Boolean(me.paymentsEnabled));
      setSection('billing', {
        nitroPlan: me.billing.nitroPlan,
        nitroExpiresAt: me.billing.nitroExpiresAt,
        boostCredits: me.billing.boostCredits,
        invoices: me.billing.invoices ?? prefs.billing.invoices,
      });
    } catch {
      /* offline — local prefs */
    }
  }, [client, prefs.billing.invoices, setSection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = async (plan: 'basic' | 'nitro') => {
    setBusy(true);
    setError(null);
    try {
      if (paymentsEnabled) {
        const checkout = await client.checkoutNitro(plan);
        void client.trackFunnel('nitro_checkout', { plan }).catch(() => undefined);
        if (checkout.mode === 'paytr' && checkout.iframeUrl) {
          window.location.href = checkout.iframeUrl;
          return;
        }
        setError(checkout.message || 'PayTR checkout hazır değil');
        return;
      }
      const res = await client.subscribeNitro(plan);
      setBilling({
        nitroPlan: res.billing.nitroPlan,
        nitroExpiresAt: res.billing.nitroExpiresAt,
        boostCredits: res.billing.boostCredits,
      });
      setSection('billing', {
        nitroPlan: res.billing.nitroPlan,
        nitroExpiresAt: res.billing.nitroExpiresAt,
        boostCredits: res.billing.boostCredits,
        invoices: res.billing.invoices,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Abonelik başarısız');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await client.cancelNitro();
      setBilling({
        nitroPlan: res.billing.nitroPlan,
        nitroExpiresAt: res.billing.nitroExpiresAt,
        boostCredits: res.billing.boostCredits,
      });
      setSection('billing', {
        nitroPlan: 'none',
        nitroExpiresAt: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İptal başarısız');
    } finally {
      setBusy(false);
    }
  };

  const plan = billing.nitroPlan;
  const expires = billing.nitroExpiresAt
    ? new Date(billing.nitroExpiresAt).toLocaleDateString('tr-TR')
    : null;

  return (
    <SettingsPage
      title="Nitro"
      description={
        paymentsEnabled
          ? 'Sunucu tarafı abonelik — PayTR ile ödeme açık.'
          : 'Sunucu tarafı entitlement (demo). PayTR için NITRO_PAYMENTS=true.'
      }
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
          <p className="font-body-sm text-on-surface-variant">
            Boost kredisi: {billing.boostCredits}
          </p>
          {error && <p className="font-body-sm text-error">{error}</p>}
          {plan !== 'none' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancel()}
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
            <ul className="mt-2 space-y-1 font-body-sm text-on-surface-variant list-disc pl-5">
              <li>Özel emoji kullanımı</li>
              <li>Daha büyük dosya yükleme</li>
              <li>1 boost kredisi</li>
            </ul>
            <button
              type="button"
              disabled={busy || plan === 'basic'}
              onClick={() => void subscribe('basic')}
              className="mt-3 px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
            >
              {plan === 'basic' ? 'Aktif' : 'Basic al'}
            </button>
          </div>
          <div className="rounded-lg border border-primary-container/40 p-space-md">
            <p className="font-headline-md">Nitro</p>
            <ul className="mt-2 space-y-1 font-body-sm text-on-surface-variant list-disc pl-5">
              <li>Aurora tema paketi</li>
              <li>2 boost kredisi</li>
              <li>Tüm Basic özellikleri</li>
            </ul>
            <button
              type="button"
              disabled={busy || plan === 'nitro'}
              onClick={() => void subscribe('nitro')}
              className="mt-3 px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
            >
              {plan === 'nitro' ? 'Aktif' : 'Nitro al'}
            </button>
          </div>
        </div>
        <SettingsNote>
          Gerçek kart çekimi için sunucuda PayTR anahtarları + NITRO_PAYMENTS=true gerekir.
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
