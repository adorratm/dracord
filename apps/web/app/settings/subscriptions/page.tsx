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

export default function SubscriptionsPage() {
  const { client } = useAuth();
  const { prefs, setSection } = useUserPreferences();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await client.requestBillingMe();
      setSection('billing', {
        nitroPlan: me.billing.nitroPlan,
        nitroExpiresAt: me.billing.nitroExpiresAt,
        boostCredits: me.billing.boostCredits,
        boostAssignments: me.billing.boostAssignments ?? prefs.billing.boostAssignments,
        invoices: me.billing.invoices ?? prefs.billing.invoices,
      });
    } catch {
      /* offline */
    }
  }, [client, prefs.billing.boostAssignments, prefs.billing.invoices, setSection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cancelNitro = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await client.cancelNitro();
      setSection('billing', {
        nitroPlan: res.billing.nitroPlan,
        nitroExpiresAt: res.billing.nitroExpiresAt,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İptal başarısız');
    } finally {
      setBusy(false);
    }
  };

  const items: Array<{ id: string; label: string; onCancel: () => void }> = [];

  if (prefs.billing.nitroPlan !== 'none') {
    items.push({
      id: 'nitro',
      label: `Nitro ${prefs.billing.nitroPlan === 'basic' ? 'Basic' : ''} · bitiş ${
        prefs.billing.nitroExpiresAt
          ? new Date(prefs.billing.nitroExpiresAt).toLocaleDateString('tr-TR')
          : '—'
      }`,
      onCancel: () => void cancelNitro(),
    });
  }

  for (const a of prefs.billing.boostAssignments) {
    items.push({
      id: `boost-${a.guildId}`,
      label: `Takviye · ${a.guildName}`,
      onCancel: () =>
        setSection('billing', {
          boostCredits: prefs.billing.boostCredits + 1,
          boostAssignments: prefs.billing.boostAssignments.filter(
            (x) => x.guildId !== a.guildId,
          ),
        }),
    });
  }

  return (
    <SettingsPage title="Abonelikler" description="Aktif planların ve takviyelerin.">
      <SettingsSection>
        {error && (
          <p className="px-space-md pt-space-md font-body-sm text-error">{error}</p>
        )}
        {items.length === 0 ? (
          <SettingsNote>
            Aktif aboneliğin yok.{' '}
            <Link href="/settings/nitro" className="text-primary-container hover:underline">
              Nitro
            </Link>{' '}
            veya{' '}
            <Link href="/settings/boost" className="text-primary-container hover:underline">
              takviye
            </Link>{' '}
            ekle.
          </SettingsNote>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {items.map((it) => (
              <li
                key={it.id}
                className="px-space-md py-space-sm flex items-center justify-between gap-space-md"
              >
                <span className="font-body-md">{it.label}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={it.onCancel}
                  className="font-label-sm text-error hover:underline disabled:opacity-50"
                >
                  İptal
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
      <SettingsSection>
        <SettingsNote>
          Ödeme yöntemleri:{' '}
          <Link href="/settings/billing" className="text-primary-container hover:underline">
            Faturalandırma
          </Link>
          . Hediyeler:{' '}
          <Link href="/settings/gifts" className="text-primary-container hover:underline">
            Hediye envanteri
          </Link>
          .
        </SettingsNote>
      </SettingsSection>
    </SettingsPage>
  );
}
