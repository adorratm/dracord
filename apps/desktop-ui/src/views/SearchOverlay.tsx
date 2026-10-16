import { useEffect, useMemo, useState } from 'react';
import type {
  ChannelSummary,
  GuildSummary,
  SearchHit,
  SearchHitMessage,
} from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import { QuickSwitcher, SearchPanel, type SearchScope } from '@dracord/ui';
import { useAuth } from '../auth';

function localQuickHits(
  query: string,
  guilds: GuildSummary[],
  channels: ChannelSummary[],
  activeGuildId: string | null | undefined,
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: SearchHit[] = [];
  for (const g of guilds) {
    if (g.name.toLowerCase().includes(q)) {
      out.push({
        type: 'guild',
        id: g.id,
        name: g.name,
        iconUrl: g.iconUrl ?? null,
      });
    }
  }
  for (const c of channels) {
    if (!c.name.toLowerCase().includes(q)) continue;
    out.push({
      type: 'channel',
      id: c.id,
      guildId: activeGuildId ?? null,
      name: c.name,
      channelType: c.type,
    });
  }
  return out.slice(0, 20);
}

function mergeHits(primary: SearchHit[], fallback: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of [...primary, ...fallback]) {
    const key = `${h.type}:${h.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

export function SearchOverlay({
  open,
  onClose,
  onOpenChannel,
  onOpenDm,
  guildId,
  channelId,
  guilds = [],
  channels = [],
  initialMode = 'quick',
}: {
  open: boolean;
  onClose: () => void;
  onOpenChannel: (guildId: string, channelId: string, opts?: { around?: string }) => void;
  onOpenDm: (channelId: string, opts?: { around?: string }) => void;
  guildId?: string | null;
  channelId?: string | null;
  guilds?: GuildSummary[];
  channels?: ChannelSummary[];
  initialMode?: 'quick' | 'full';
}) {
  const { client, user } = useAuth();
  const [mode, setMode] = useState<'quick' | 'full'>(initialMode);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<SearchScope>('everywhere');
  const [error, setError] = useState<string | null>(null);

  const localHits = useMemo(
    () => localQuickHits(q, guilds, channels, guildId),
    [q, guilds, channels, guildId],
  );

  useEffect(() => {
    if (!open) {
      setQ('');
      setHits([]);
      setMode(initialMode);
      setScope('everywhere');
      setBusy(false);
      setError(null);
      return;
    }
    setMode(initialMode);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open || !user || q.trim().length < 1) {
      setHits(mode === 'quick' ? localHits : []);
      setError(null);
      return;
    }
    const query = q.trim();
    const t = window.setTimeout(() => {
      setBusy(true);
      setError(null);
      if (mode === 'quick') {
        void client
          .search({ q: query, types: ['guilds', 'channels', 'users'], limit: 20 })
          .then((r) => {
            setHits(mergeHits(r.hits ?? [], localHits));
          })
          .catch(() => {
            // ES kapalıysa yerel sunucu/kanal listesiyle devam
            setHits(localHits);
            if (localHits.length === 0) {
              setError('Sunucu araması şu an kullanılamıyor; yerel sonuç da yok.');
            }
          })
          .finally(() => setBusy(false));
        return;
      }
      const opts: Parameters<typeof client.search>[0] = {
        q: query,
        types: ['messages'],
        limit: 30,
      };
      if (scope === 'guild' && guildId) opts.guildId = guildId;
      if (scope === 'channel' && channelId) opts.channelId = channelId;
      void client
        .search(opts)
        .then((r) => {
          const list = r.hits ?? [];
          if (scope === 'dms') {
            setHits(list.filter((h) => h.type === 'message' && h.dmChannelId));
          } else {
            setHits(list);
          }
        })
        .catch(() => {
          setHits([]);
          setError('Mesaj araması şu an kullanılamıyor.');
        })
        .finally(() => setBusy(false));
    }, mode === 'quick' ? 200 : 250);
    return () => window.clearTimeout(t);
  }, [
    open,
    q,
    mode,
    scope,
    client,
    user,
    guildId,
    channelId,
    localHits,
  ]);

  const selectQuick = (hit: SearchHit) => {
    if (hit.type === 'guild') {
      void client.getGuildChannels(hit.id).then((chs) => {
        const first = chs.find((c) => c.type === 'TEXT') ?? chs[0];
        if (first) {
          onOpenChannel(hit.id, first.id);
          onClose();
        }
      });
      return;
    }
    if (hit.type === 'channel' && hit.guildId) {
      onOpenChannel(hit.guildId, hit.id);
      onClose();
      return;
    }
    if (hit.type === 'user') {
      if (hit.id === DRACORD_BOT_USER_ID) return;
      void client
        .openDm(hit.id)
        .then((ch) => {
          onOpenDm(ch.id);
          onClose();
        })
        .catch(() => onClose());
    }
  };

  const selectMessage = (hit: SearchHitMessage) => {
    const around = hit.threadRootId || hit.id;
    if (hit.guildId) {
      onOpenChannel(hit.guildId, hit.channelId, { around });
    } else {
      onOpenDm(hit.channelId, { around });
    }
    onClose();
  };

  if (!open) return null;

  if (mode === 'full') {
    return (
      <div className="fixed inset-0 z-[200]">
        <SearchPanel
          open
          onClose={onClose}
          query={q}
          onQueryChange={setQ}
          scope={scope}
          onScopeChange={setScope}
          hits={hits}
          loading={busy}
          error={error}
          onSelectMessage={selectMessage}
        />
        <button
          type="button"
          className="fixed top-[12vh] right-[max(1rem,calc(50%-20rem))] z-[201] h-8 px-2 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container"
          onClick={() => setMode('quick')}
        >
          Hızlı ara
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200]">
      <QuickSwitcher
        open
        onClose={onClose}
        query={q}
        onQueryChange={setQ}
        hits={hits}
        loading={busy}
        error={error}
        onSelect={selectQuick}
      />
      <div className="fixed top-[calc(12vh+3.25rem)] left-1/2 z-[201] w-full max-w-xl -translate-x-1/2 px-3 flex items-center justify-between gap-2 pointer-events-none">
        <p className="text-[11px] text-outline truncate pointer-events-none">
          {busy ? '' : 'Sunucu, kanal veya kullanıcı'}
        </p>
        <button
          type="button"
          className="pointer-events-auto h-7 px-2 rounded-md text-[11px] font-semibold text-primary-container hover:bg-surface-container-high"
          onClick={() => setMode('full')}
        >
          Mesajlarda ara
        </button>
      </div>
    </div>
  );
}
