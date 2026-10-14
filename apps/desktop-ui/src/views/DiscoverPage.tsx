import { useEffect, useState } from 'react';
import type { GuildSummary } from '@dracord/types';
import { useAuth } from '../auth';

export function DiscoverPage({ onJoined }: { onJoined?: (guildId: string) => void }) {
  const { client } = useAuth();
  const [list, setList] = useState<GuildSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void client
      .discoverGuilds()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Keşfet yüklenemedi'));
  }, [client]);

  return (
    <div className="p-6 overflow-auto h-full">
      <h2 className="font-headline-lg text-headline-lg mt-0 mb-4">Keşfet</h2>
      {error && <p className="text-error mb-3">{error}</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {list.map((g) => (
          <button
            key={g.id}
            type="button"
            disabled={busyId === g.id}
            onClick={() => {
              setBusyId(g.id);
              setError(null);
              void client
                .joinDiscoverableGuild(g.id)
                .then((joined) => onJoined?.(joined.id))
                .catch((e) => setError(e instanceof Error ? e.message : 'Katılınamadı'))
                .finally(() => setBusyId(null));
            }}
            className="text-left rounded-xl overflow-hidden bg-surface-container border border-outline-variant hover:border-primary-container transition-colors disabled:opacity-70"
          >
            <div
              className="h-24 bg-cover bg-center"
              style={{
                backgroundImage: `url(${g.bannerUrl || 'https://dracord.com.tr/guild-banner-default.webp'})`,
              }}
            />
            <div className="p-3 font-bold text-on-surface">{g.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
