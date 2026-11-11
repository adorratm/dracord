'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';

export default function BillingPage() {
  const { client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [last4, setLast4] = useState('');
  const [brand, setBrand] = useState('Visa');
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await client.requestBillingMe();
      setPaymentsEnabled(Boolean(me.paymentsEnabled));
      setSection('billing', {
        nitroPlan: me.billing.nitroPlan,
        nitroExpiresAt: me.billing.nitroExpiresAt,
        boostCredits: me.billing.boostCredits,
        invoices: me.billing.invoices ?? prefs.billing.invoices,
        paymentMethods:
          me.billing.paymentMethods?.length
            ? me.billing.paymentMethods
            : prefs.billing.paymentMethods,
      });
    } catch {
      /* offline */
    }
  }, [client, prefs.billing.invoices, prefs.billing.paymentMethods, setSection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addCard = () => {
    const digits = last4.replace(/\D/g, '').slice(-4);
    if (digits.length !== 4) return;
    setSection('billing', {
      paymentMethods: [
        { id: newId('pm'), brand, last4: digits },
        ...prefs.billing.paymentMethods,
      ],
    });
    setLast4('');
  };

  const removeCard = (id: string) => {
    setSection('billing', {
      paymentMethods: prefs.billing.paymentMethods.filter((p) => p.id !== id),
    });
  };

  return (
    <SettingsPage
      title="Faturalandırma"
      description="Ödeme yöntemleri ve fatura geçmişi."
    >
      <SettingsSection title="Plan özeti">
        <div className="px-space-md py-space-md space-y-1 font-body-sm">
          <p>
            Nitro:{' '}
            <span className="text-on-surface font-label-md">
              {prefs.billing.nitroPlan === 'none'
                ? 'yok'
                : prefs.billing.nitroPlan}
            </span>
            {' · '}
            <Link href="/settings/nitro" className="text-primary-container hover:underline">
              Yönet
            </Link>
          </p>
          <p>
            Takviye kredisi:{' '}
            <span className="text-on-surface font-label-md">
              {prefs.billing.boostCredits}
            </span>
            {' · '}
            <Link href="/settings/boost" className="text-primary-container hover:underline">
              Takviye
            </Link>
          </p>
          <p className="text-outline">
            {paymentsEnabled
              ? 'PayTR ödemeleri açık.'
              : 'Ödeme kapalı (demo abonelik). NITRO_PAYMENTS ile açılır.'}
          </p>
        </div>
      </SettingsSection>
      <SettingsSection title="Ödeme yöntemi ekle">
        <div className="px-space-md py-space-md space-y-space-sm">
          <SettingsNote>
            Kartlar yalnızca istemci tercihlerinde saklanır; gerçek çekim yapılmaz.
            Canlı ödeme PayTR checkout ile Nitro sayfasındadır.
          </SettingsNote>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Kart türü"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
            >
              <option>Visa</option>
              <option>Mastercard</option>
              <option>Troy</option>
            </select>
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              placeholder="Son 4 hane"
              maxLength={4}
              className="h-10 w-28 px-space-sm rounded-lg bg-surface-container-highest outline-none"
            />
            <button
              type="button"
              onClick={addCard}
              className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            >
              Kaydet
            </button>
          </div>
        </div>
      </SettingsSection>
      <SettingsSection title="Kayıtlı yöntemler">
        {prefs.billing.paymentMethods.length === 0 ? (
          <SettingsNote>Kayıtlı ödeme yöntemi yok.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {prefs.billing.paymentMethods.map((p) => (
              <li
                key={p.id}
                className="px-space-md py-space-sm flex justify-between items-center"
              >
                <span className="font-body-md">
                  {p.brand} ···· {p.last4}
                </span>
                <button
                  type="button"
                  onClick={() => removeCard(p.id)}
                  className="font-label-sm text-error hover:underline"
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
      <SettingsSection title="Fatura geçmişi">
        {prefs.billing.invoices.length === 0 ? (
          <SettingsNote>Henüz fatura yok.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {prefs.billing.invoices.map((inv) => (
              <li key={inv.id} className="px-space-md py-space-sm flex justify-between gap-2">
                <div>
                  <p className="font-body-md">{inv.label}</p>
                  <p className="font-label-sm text-outline">
                    {new Date(inv.at).toLocaleString('tr-TR')}
                  </p>
                </div>
                <span className="font-label-md text-primary-container">{inv.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}