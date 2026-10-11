'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { GuildSummary } from '@dracord/types';
import { guildBoostLevel } from '@dracord/types';
import { AppShell } from '@/components/AppShell';
import { RequireAuth } from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { useGuildNav } from '@/hooks/useGuildNav';
import { useUserPreferences } from '@/lib/user-preferences';
import { cn } from '@dracord/ui';

const LEVELS = [
  {
    level: 1,
    need: 2,
    perks: ['+50 Emoji', '720p 60fps yayın', '10 MB yükleme', 'Animasyonlu simge'],
  },
  {
    level: 2,
    need: 7,
    perks: ['+100 Emoji', '1440p 60fps', '50 MB yükleme', 'Sunucu afişi', 'Rol simgeleri'],
  },
  {
    level: 3,
    need: 14,
    perks: ['+250 Emoji', '100 MB yükleme', '384 kbps ses', 'Özel davet URL', 'Hareketli afiş'],
  },
] as const;

export default function GuildBoostPage() {
  const params = useParams();
  const guildId = String(params.guildId ?? '');
  const router = useRouter();
  const { client } = useAuth();
  const { guilds, reload } = useGuildNav(guildId);
  const { prefs, update } = useUserPreferences();
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const g = await client.getGuild(guildId);
      setGuild(g);
    } catch {
      setGuild(null);
    }
  }, [client, guildId]);

  useEffect(() => {
    void load();
  }, [load]);

  const count = guild?.boostCount ?? 0;
  const level = guild?.boostLevel ?? guildBoostLevel(count);
  const mine = prefs.billing.boostAssignments.some((a) => a.guildId === guildId);

  const boost = async () => {
    setBusy(true);
    setError(null);
    try {
      const g = await client.boostGuild(guildId);
      setGuild(g);
      const settings = await client.getClientSettings();
      update({ billing: settings.billing });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Takviye yapılamadı');
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequireAuth>
      <AppShell
        guilds={guilds}
        activeGuildId={guildId}
        subtitle={guild?.name ?? 'Takviye'}
        onGuildsChanged={() => void reload()}
      >
        <div className="flex-1 min-h-0 overflow-y-auto bg-surface">
          <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-6">
                <button
                  type="button"
                  className="h-9 w-9 rounded-lg hover:bg-surface-container flex items-center justify-center"
                  onClick={() => router.back()}
                  aria-label="Geri"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <span className="material-symbols-outlined text-primary-container">diamond</span>
                <h1 className="font-headline-lg text-on-surface">Sunucu Takviyeleri</h1>
              </div>

              <h2 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-3">
                Seviyeler
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
                {LEVELS.map((l) => (
                  <div
                    key={l.level}
                    className={cn(
                      'rounded-xl border p-4 bg-surface-container-low',
                      level >= l.level
                        ? 'border-primary-container/50'
                        : 'border-surface-container-highest',
                    )}
                  >
                    <p className="font-headline-md text-on-surface mb-2">{l.level}. Seviye</p>
                    <ul className="space-y-1.5 mb-4">
                      {l.perks.map((p) => (
                        <li
                          key={p}
                          className="font-body-sm text-on-surface-variant flex items-start gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px] mt-0.5 text-primary-container">
                            check
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                    <p className="font-label-sm text-outline">{l.need} Takviye</p>
                  </div>
                ))}
              </div>

              <h2 className="font-label-md text-on-surface-variant uppercase tracking-wider mb-3">
                Ek Avantajlar
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { t: 'Sunucu Etiketi', d: '2+ Takviye' },
                  { t: 'Rozet Paketleri', d: '7+ Takviye' },
                  { t: 'Geliştirilmiş Rol Stilleri', d: '14+ Takviye' },
                ].map((c) => (
                  <div
                    key={c.t}
                    className="rounded-xl bg-surface-container-low border border-surface-container-highest p-4"
                  >
                    <p className="font-label-md text-on-surface">{c.t}</p>
                    <p className="font-body-sm text-outline mt-1">{c.d}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="w-full lg:w-72 shrink-0 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: 'Mevcut', v: count },
                  { l: 'Harcandı', v: mine ? 1 : 0 },
                  { l: 'Toplam', v: count },
                ].map((s) => (
                  <div
                    key={s.l}
                    className="rounded-lg bg-surface-container-low border border-surface-container-highest p-2 text-center"
                  >
                    <p className="font-label-sm text-outline">{s.l}</p>
                    <p className="font-headline-md text-on-surface">{s.v}</p>
                  </div>
                ))}
              </div>
              {error && <p className="font-body-sm text-error">{error}</p>}
              <button
                type="button"
                disabled={busy || mine || prefs.billing.boostCredits < 1}
                onClick={() => void boost()}
                className="w-full h-11 rounded-lg bg-primary-container text-on-primary-container font-label-md inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined">diamond</span>
                {mine ? 'Takviye verdin' : 'Bu Sunucuya Takviye Yap'}
              </button>
              <p className="font-body-sm text-on-surface-variant">
                Kredin: {prefs.billing.boostCredits}. Daha fazla için{' '}
                <button
                  type="button"
                  className="text-primary-container underline"
                  onClick={() => router.push('/settings/boost')}
                >
                  Ayarlar → Takviye
                </button>
              </p>
              <div className="rounded-xl bg-surface-container-low border border-surface-container-highest p-3">
                <p className="font-label-sm text-outline uppercase tracking-wider mb-2">
                  Bildirimler
                </p>
                <p className="font-body-sm text-on-surface-variant">
                  Takviyeler sunucu özelliklerini herkes için yükseltir. Seviye {level} /
                  hedef sonraki eşik {level >= 3 ? '—' : LEVELS[level]?.need ?? 2}.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
