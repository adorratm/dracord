'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

export default function AppearanceSettingsPage() {
  const { user, client, setUser } = useAuth();
  const [censor, setCensor] = useState(Boolean(user?.censorLinkPreviews));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setCensor(Boolean(user?.censorLinkPreviews));
  }, [user?.censorLinkPreviews]);

  const toggleCensor = async (next: boolean) => {
    setCensor(next);
    setBusy(true);
    setSaved(false);
    try {
      const me = await client.updateProfile({ censorLinkPreviews: next });
      setUser(me);
      setSaved(true);
    } catch {
      setCensor(Boolean(user?.censorLinkPreviews));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl px-space-xl py-space-xl space-y-space-lg">
      <section>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-space-sm">Görünüm</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-space-md">
          Dracord varsayılan olarak koyu Dracula temasını kullanır.
        </p>
        <div className="rounded-xl bg-surface-container-low p-space-lg space-y-space-md">
          <label className="flex items-center justify-between gap-space-md">
            <span className="font-body-md text-body-md">Tema</span>
            <select
              className="bg-surface-container-high rounded-lg px-space-md py-space-sm text-on-surface font-body-sm"
              defaultValue="dark"
              disabled
            >
              <option value="dark">Koyu (Dracula)</option>
            </select>
          </label>
          <p className="font-body-sm text-body-sm text-outline">
            Açık tema ve özel vurgu renkleri yakında eklenecek.
          </p>
        </div>
      </section>

      <section>
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-space-sm">
          Medya önizlemeleri
        </h2>
        <div className="rounded-xl bg-surface-container-low p-space-lg space-y-space-md">
          <label className="flex items-start justify-between gap-space-md cursor-pointer">
            <div className="min-w-0">
              <p className="font-body-md text-on-surface">Link önizlemelerini sansürle</p>
              <p className="font-body-sm text-on-surface-variant mt-1">
                Mesajlardaki bağlantı kartları ve görseller bulanık gelir; tıklayınca açılır.
              </p>
            </div>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-primary-container"
              checked={censor}
              disabled={busy || !user}
              onChange={(e) => void toggleCensor(e.target.checked)}
            />
          </label>
          {saved && (
            <p className="font-label-sm text-secondary">Kaydedildi</p>
          )}
        </div>
      </section>
    </div>
  );
}
