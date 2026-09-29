'use client';

import { useState } from 'react';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';
import { newId } from '@/lib/totp';

function makeCode(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${part()}-${part()}-${part()}`;
}

export default function GiftsPage() {
  const { prefs, setSection } = useUserPreferences();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const createGift = (kind: 'nitro' | 'boost') => {
    const gift = {
      id: newId('gift'),
      kind,
      label: kind === 'nitro' ? 'Nitro hediyesi' : 'Takviye hediyesi',
      code: makeCode(),
      redeemed: false,
    };
    setSection('billing', { gifts: [gift, ...prefs.billing.gifts] });
  };

  const redeem = () => {
    setMsg(null);
    const normalized = code.trim().toUpperCase();
    const gift = prefs.billing.gifts.find(
      (g) => g.code === normalized && !g.redeemed,
    );
    if (!gift) {
      // Demo: DRACORD-NITRO / DRACORD-BOOST sabit kodları
      if (normalized === 'DRACORD-NITRO') {
        const expires = new Date();
        expires.setMonth(expires.getMonth() + 1);
        setSection('billing', {
          nitroPlan: 'nitro',
          nitroExpiresAt: expires.toISOString(),
        });
        setMsg('Nitro kodu kullanıldı!');
        setCode('');
        return;
      }
      if (normalized === 'DRACORD-BOOST') {
        setSection('billing', { boostCredits: prefs.billing.boostCredits + 1 });
        setMsg('Takviye kodu kullanıldı!');
        setCode('');
        return;
      }
      setMsg('Geçersiz veya kullanılmış kod.');
      return;
    }
    const gifts = prefs.billing.gifts.map((g) =>
      g.id === gift.id ? { ...g, redeemed: true } : g,
    );
    if (gift.kind === 'nitro') {
      const expires = new Date();
      expires.setMonth(expires.getMonth() + 1);
      setSection('billing', {
        gifts,
        nitroPlan: 'basic',
        nitroExpiresAt: expires.toISOString(),
      });
    } else {
      setSection('billing', {
        gifts,
        boostCredits: prefs.billing.boostCredits + 1,
      });
    }
    setMsg('Hediye kullanıldı!');
    setCode('');
  };

  return (
    <SettingsPage title="Hediye Envanteri" description="Hediye oluştur veya kod kullan.">
      <SettingsSection title="Kod kullan">
        <div className="px-space-md py-space-md flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX veya DRACORD-NITRO"
            className="flex-1 h-10 rounded-lg bg-surface-container-highest px-3 outline-none font-body-sm"
          />
          <button
            type="button"
            onClick={redeem}
            className="px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm"
          >
            Kullan
          </button>
        </div>
        {msg && <p className="px-space-md pb-space-md font-body-sm text-secondary">{msg}</p>}
      </SettingsSection>
      <SettingsSection title="Hediye oluştur">
        <div className="px-space-md py-space-md flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => createGift('nitro')}
            className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm"
          >
            Nitro hediyesi oluştur
          </button>
          <button
            type="button"
            onClick={() => createGift('boost')}
            className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm"
          >
            Takviye hediyesi oluştur
          </button>
        </div>
      </SettingsSection>
      <SettingsSection title="Envanter">
        {prefs.billing.gifts.length === 0 ? (
          <SettingsNote>Hediye yok.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {prefs.billing.gifts.map((g) => (
              <li key={g.id} className="px-space-md py-space-sm">
                <p className="font-body-md">
                  {g.label}{' '}
                  {g.redeemed && (
                    <span className="text-outline font-label-sm">(kullanıldı)</span>
                  )}
                </p>
                <p className="font-mono text-body-sm text-primary-container">{g.code}</p>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </SettingsPage>
  );
}
