'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';
import { useUserPreferences } from '@/lib/user-preferences';

type GiftRow = {
  id: string;
  kind: 'nitro' | 'boost';
  label: string;
  code: string;
  redeemed: boolean;
  createdAt: string;
};

export default function GiftsPage() {
  const { client } = useAuth();
  const { setSection } = useUserPreferences();
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await client.listGifts();
      setGifts(res.gifts ?? []);
    } catch {
      /* offline */
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const createGift = async (kind: 'nitro' | 'boost') => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await client.createGift(kind);
      setGifts((prev) => [res.gift, ...prev]);
      setMsg(`Kod oluşturuldu: ${res.gift.code}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Oluşturma başarısız');
    } finally {
      setBusy(false);
    }
  };

  const redeem = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await client.redeemGift(code);
      setSection('billing', {
        nitroPlan: res.billing.nitroPlan,
        nitroExpiresAt: res.billing.nitroExpiresAt,
        boostCredits: res.billing.boostCredits,
      });
      setMsg(
        res.kind === 'nitro'
          ? 'Nitro hediyesi kullanıldı!'
          : 'Takviye hediyesi kullanıldı!',
      );
      setCode('');
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kod kullanılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage title="Hediye Envanteri" description="Hediye oluştur veya kod kullan.">
      <SettingsSection title="Kod kullan">
        <div className="px-space-md py-space-md flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX veya DRACORD-NITRO"
            className="flex-1 h-10 rounded-lg bg-surface-container-highest px-3 outline-none font-body-sm"
          />
          <button
            type="button"
            disabled={busy || !code.trim()}
            onClick={() => void redeem()}
            className="px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
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
            disabled={busy}
            onClick={() => void createGift('nitro')}
            className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm disabled:opacity-50"
          >
            Nitro hediyesi oluştur
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createGift('boost')}
            className="px-space-md py-space-sm rounded-lg bg-surface-container-high font-label-sm disabled:opacity-50"
          >
            Takviye hediyesi oluştur
          </button>
        </div>
        <SettingsNote>
          Kodlar sunucuda saklanır; başka bir hesaba hediye edebilirsin. Kendi
          kodunu kullanamazsın.
        </SettingsNote>
      </SettingsSection>
      <SettingsSection title="Envanter">
        {gifts.length === 0 ? (
          <SettingsNote>Hediye yok.</SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {gifts.map((g) => (
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
