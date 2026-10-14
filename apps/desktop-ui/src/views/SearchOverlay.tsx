import { useEffect, useState } from 'react';
import type { SearchHit, SearchHitMessage, SearchResponse } from '@dracord/types';
import { QuickSwitcher, SearchPanel, type SearchScope } from '@dracord/ui';
import { useAuth } from '../auth';

export function SearchOverlay({
  open,
  onClose,
  onOpenChannel,
}: {
  open: boolean;
  onClose: () => void;
  onOpenChannel: (guildId: string, channelId: string) => void;
}) {
  const { client } = useAuth();
  const [mode, setMode] = useState<'quick' | 'full'>('quick');
  const [q, setQ] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<SearchScope>('everywhere');

  useEffect(() => {
    if (!open) {
      setQ('');
      setResult(null);
      setMode('quick');
      setScope('everywhere');
    }
  }, [open]);

  const runSearch = (query: string) => {
    if (!query.trim()) {
      setResult(null);
      return;
    }
    setBusy(true);
    void client
      .search({ q: query.trim(), limit: 24 })
      .then(setResult)
      .finally(() => setBusy(false));
  };

  const selectHit = (hit: SearchHit) => {
    if (hit.type === 'channel' && hit.guildId) {
      onOpenChannel(hit.guildId, hit.id);
      onClose();
    } else if (hit.type === 'message' && hit.guildId) {
      onOpenChannel(hit.guildId, hit.channelId);
      onClose();
    } else if (hit.type === 'guild') {
      void client.getGuildChannels(hit.id).then((chs) => {
        const first = chs.find((c) => c.type === 'TEXT') ?? chs[0];
        if (first) {
          onOpenChannel(hit.id, first.id);
          onClose();
        }
      });
    }
  };

  if (!open) return null;

  if (mode === 'full') {
    return (
      <SearchPanel
        open
        onClose={onClose}
        query={q}
        onQueryChange={(query) => {
          setQ(query);
          runSearch(query);
        }}
        scope={scope}
        onScopeChange={setScope}
        hits={result?.hits ?? []}
        loading={busy}
        onSelectMessage={(hit: SearchHitMessage) => selectHit(hit)}
      />
    );
  }

  return (
    <QuickSwitcher
      open
      onClose={onClose}
      query={q}
      onQueryChange={(query) => {
        setQ(query);
        if (query.trim().length >= 2) runSearch(query);
        else setResult(null);
      }}
      hits={result?.hits ?? []}
      loading={busy}
      onSelect={(hit) => {
        if (hit.type === 'user') {
          setMode('full');
          return;
        }
        selectHit(hit);
      }}
    />
  );
}
