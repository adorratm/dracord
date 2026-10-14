import { useEffect, useState } from 'react';
import type { GuildSummary } from '@dracord/types';
import { guildBoostLevel } from '@dracord/types';
import { useAuth } from '../auth';

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

export function GuildBoostPage({
  guildId,
  onBack,
}: {
  guildId: string;
  onBack: () => void;
}) {
  const { client } = useAuth();
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client.getGuild(guildId).then(setGuild).catch(() => setGuild(null));
  }, [client, guildId]);

  const count = guild?.boostCount ?? 0;
  const level = guild?.boostLevel ?? guildBoostLevel(count);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-surface p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            className="h-9 w-9 rounded-lg hover:bg-surface-container flex items-center justify-center"
            onClick={onBack}
            aria-label="Geri"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="material-symbols-outlined text-primary-container">diamond</span>
          <h1 className="font-headline-lg text-on-surface m-0">Sunucu Takviyeleri</h1>
        </div>

        {error && <p className="text-error mb-3">{error}</p>}

        <div className="rounded-xl bg-surface-container-low border border-surface-container-highest p-4 mb-6">
          <p className="font-label-md text-on-surface">{guild?.name ?? 'Sunucu'}</p>
          <p className="text-on-surface-variant mt-1">
            Seviye {level} · {count} takviye
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 h-10 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
            onClick={() => {
              setBusy(true);
              setError(null);
              void client
                .boostGuild(guildId)
                .then(setGuild)
                .catch((e) => setError(e instanceof Error ? e.message : 'Takviye yapılamadı'))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Gönderiliyor…' : 'Bu sunucuyu takviye et'}
          </button>
        </div>

        <div className="grid gap-3">
          {LEVELS.map((lv) => (
            <div
              key={lv.level}
              className={`rounded-xl border p-4 ${
                level >= lv.level
                  ? 'border-primary-container bg-primary-container/10'
                  : 'border-surface-container-highest bg-surface-container-low'
              }`}
            >
              <p className="font-semibold">
                Seviye {lv.level} · {lv.need} takviye
              </p>
              <ul className="mt-2 text-sm text-on-surface-variant list-disc pl-5">
                {lv.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
