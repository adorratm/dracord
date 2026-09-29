'use client';

import { useState } from 'react';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';

export default function BillingPage() {
  const { prefs, setSection } = useUserPreferences();
  const [last4, setLast4] = useState('');
  const [brand, setBrand] = useState('Visa');

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
      description="Demo ödeme yöntemleri ve fatura geçmişi (gerçek kart çekilmez)."
    >
      <SettingsSection title="Ödeme yöntemi ekle">
        <div className="px-space-md py-space-md space-y-space-sm">
          <div className="flex flex-wrap gap-2">
            <select
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
