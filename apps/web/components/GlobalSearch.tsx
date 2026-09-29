'use client';

import type { SearchHit, SearchHitMessage } from '@dracord/types';
import { QuickSwitcher, SearchPanel, type SearchScope } from '@dracord/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

const OPEN_MESSAGE_SEARCH = 'dracord:open-message-search';

export function openMessageSearch() {
  window.dispatchEvent(new Event(OPEN_MESSAGE_SEARCH));
}

export function GlobalSearch() {
  const { client, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const { guildId, channelId } = useMemo(() => {
    const parts = pathname?.split('/') ?? [];
    if (parts[1] === 'channels' && parts[2] && parts[3]) {
      return {
        guildId: parts[2] === '@me' || parts[2] === 'me' ? undefined : parts[2],
        channelId: parts[3],
      };
    }
    return { guildId: undefined, channelId: undefined };
  }, [pathname]);

  const [quickOpen, setQuickOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [quickQ, setQuickQ] = useState('');
  const [panelQ, setPanelQ] = useState('');
  const [scope, setScope] = useState<SearchScope>('everywhere');
  const [quickHits, setQuickHits] = useState<SearchHit[]>([]);
  const [panelHits, setPanelHits] = useState<SearchHit[]>([]);
  const [loadingQuick, setLoadingQuick] = useState(false);
  const [loadingPanel, setLoadingPanel] = useState(false);

  useEffect(() => {
    const onOpen = () => setPanelOpen(true);
    window.addEventListener(OPEN_MESSAGE_SEARCH, onOpen);
    return () => window.removeEventListener(OPEN_MESSAGE_SEARCH, onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickOpen(true);
        setPanelOpen(false);
      }
      if (meta && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setPanelOpen(true);
        setQuickOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!quickOpen || !user || quickQ.trim().length < 1) {
      setQuickHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setLoadingQuick(true);
      void client
        .search({ q: quickQ, types: ['guilds', 'channels', 'users'], limit: 20 })
        .then((r) => setQuickHits(r.hits))
        .catch(() => setQuickHits([]))
        .finally(() => setLoadingQuick(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [quickOpen, quickQ, client, user]);

  useEffect(() => {
    if (!panelOpen || !user || panelQ.trim().length < 1) {
      setPanelHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setLoadingPanel(true);
      const opts: Parameters<typeof client.search>[0] = {
        q: panelQ,
        types: ['messages'],
        limit: 30,
      };
      if (scope === 'guild' && guildId) opts.guildId = guildId;
      if (scope === 'channel' && channelId) opts.channelId = channelId;
      void client
        .search(opts)
        .then((r) => {
          if (scope === 'dms') {
            setPanelHits(r.hits.filter((h) => h.type === 'message' && h.dmChannelId));
          } else {
            setPanelHits(r.hits);
          }
        })
        .catch(() => setPanelHits([]))
        .finally(() => setLoadingPanel(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [panelOpen, panelQ, scope, client, user, guildId, channelId]);

  const onSelectQuick = useCallback(
    async (hit: SearchHit) => {
      setQuickOpen(false);
      setQuickQ('');
      if (hit.type === 'guild') {
        try {
          const channels = await client.getGuildChannels(hit.id);
          const text = channels.find((c) => c.type === 'TEXT') ?? channels[0];
          if (text) router.push(`/channels/${hit.id}/${text.id}`);
        } catch {
          router.push(`/channels/${hit.id}`);
        }
        return;
      }
      if (hit.type === 'channel') {
        if (hit.guildId) router.push(`/channels/${hit.guildId}/${hit.id}`);
        return;
      }
      if (hit.type === 'user') {
        try {
          const ch = await client.openDm(hit.id);
          router.push(`/channels/@me/${ch.id}`);
        } catch {
          router.push('/channels/@me');
        }
      }
    },
    [client, router],
  );

  const onSelectMessage = (hit: SearchHitMessage) => {
    setPanelOpen(false);
    setPanelQ('');
    if (hit.guildId) {
      router.push(`/channels/${hit.guildId}/${hit.channelId}?around=${hit.id}`);
    } else {
      router.push(`/channels/@me/${hit.channelId}?around=${hit.id}`);
    }
  };

  return (
    <>
      <QuickSwitcher
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        query={quickQ}
        onQueryChange={setQuickQ}
        hits={quickHits}
        loading={loadingQuick}
        onSelect={(h) => void onSelectQuick(h)}
      />
      <SearchPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        query={panelQ}
        onQueryChange={setPanelQ}
        scope={scope}
        onScopeChange={setScope}
        hits={panelHits}
        loading={loadingPanel}
        onSelectMessage={onSelectMessage}
      />
    </>
  );
}
