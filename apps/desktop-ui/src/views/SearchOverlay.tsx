import { useEffect, useState } from 'react';
import type { SearchHit, SearchHitMessage } from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import { QuickSwitcher, SearchPanel, type SearchScope } from '@dracord/ui';
import { useAuth } from '../auth';

export function SearchOverlay({
  open,
  onClose,
  onOpenChannel,
  onOpenDm,
  guildId,
  channelId,
  initialMode = 'quick',
}: {
  open: boolean;
  onClose: () => void;
  onOpenChannel: (guildId: string, channelId: string, opts?: { around?: string }) => void;
  onOpenDm: (channelId: string, opts?: { around?: string }) => void;
  guildId?: string | null;
  channelId?: string | null;
  initialMode?: 'quick' | 'full';
}) {
  const { client, user } = useAuth();
  const [mode, setMode] = useState<'quick' | 'full'>(initialMode);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<SearchScope>('everywhere');

  useEffect(() => {
    if (!open) {
      setQ('');
      setHits([]);
      setMode(initialMode);
      setScope('everywhere');
      setBusy(false);
      return;
    }
    setMode(initialMode);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open || !user || q.trim().length < 1) {
      setHits([]);
      return;
    }
    const query = q.trim();
    const t = window.setTimeout(() => {
      setBusy(true);
      if (mode === 'quick') {
        void client
          .search({ q: query, types: ['guilds', 'channels', 'users'], limit: 20 })
          .then((r) => setHits(r.hits ?? []))
          .catch(() => setHits([]))
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
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, mode === 'quick' ? 200 : 250);
    return () => window.clearTimeout(t);
  }, [open, q, mode, scope, client, user, guildId, channelId]);

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
      <SearchPanel
        open
        onClose={onClose}
        query={q}
        onQueryChange={setQ}
        scope={scope}
        onScopeChange={setScope}
        hits={hits}
        loading={busy}
        onSelectMessage={selectMessage}
      />
    );
  }

  return (
    <QuickSwitcher
      open
      onClose={onClose}
      query={q}
      onQueryChange={setQ}
      hits={hits}
      loading={busy}
      onSelect={selectQuick}
    />
  );
}
