'use client';

import type { SearchHit, SearchHitMessage } from '@dracord/types';
import { DRACORD_BOT_USER_ID } from '@dracord/types';
import { QuickSwitcher, SearchPanel, type SearchScope } from '@dracord/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';

const OPEN_MESSAGE_SEARCH = 'dracord:open-message-search';
const OPEN_QUICK_SEARCH = 'dracord:open-quick-search';

export function openMessageSearch() {
  window.dispatchEvent(new Event(OPEN_MESSAGE_SEARCH));
}

/** TitleBar arama butonu / Ctrl+K */
export function openQuickSearch() {
  window.dispatchEvent(new Event(OPEN_QUICK_SEARCH));
}

export function GlobalSearch() {
  const { client, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isEmbed = Boolean(pathname?.startsWith('/embed'));

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
  const [quickError, setQuickError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  useEffect(() => {
    const onOpenPanel = () => {
      setPanelOpen(true);
      setQuickOpen(false);
      setScope(channelId ? 'channel' : guildId ? 'guild' : 'everywhere');
    };
    const onOpenQuick = () => {
      setQuickOpen(true);
      setPanelOpen(false);
    };
    window.addEventListener(OPEN_MESSAGE_SEARCH, onOpenPanel);
    window.addEventListener(OPEN_QUICK_SEARCH, onOpenQuick);
    return () => {
      window.removeEventListener(OPEN_MESSAGE_SEARCH, onOpenPanel);
      window.removeEventListener(OPEN_QUICK_SEARCH, onOpenQuick);
    };
  }, [channelId, guildId]);

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
        setScope(channelId ? 'channel' : guildId ? 'guild' : 'everywhere');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [channelId, guildId]);

  useEffect(() => {
    if (!quickOpen || !user || quickQ.trim().length < 1) {
      setQuickHits([]);
      setQuickError(null);
      return;
    }
    const t = window.setTimeout(() => {
      setLoadingQuick(true);
      setQuickError(null);
      void client
        .search({ q: quickQ, types: ['guilds', 'channels', 'users'], limit: 20 })
        .then((r) => setQuickHits(r.hits ?? []))
        .catch((e) => {
          setQuickHits([]);
          setQuickError(
            e instanceof Error ? e.message : 'Arama şu an kullanılamıyor',
          );
        })
        .finally(() => setLoadingQuick(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [quickOpen, quickQ, client, user]);

  useEffect(() => {
    if (!panelOpen || !user || panelQ.trim().length < 1) {
      setPanelHits([]);
      setPanelError(null);
      return;
    }
    const t = window.setTimeout(() => {
      setLoadingPanel(true);
      setPanelError(null);
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
          const list = r.hits ?? [];
          if (scope === 'dms') {
            setPanelHits(list.filter((h) => h.type === 'message' && h.dmChannelId));
          } else {
            setPanelHits(list);
          }
        })
        .catch((e) => {
          setPanelHits([]);
          setPanelError(
            e instanceof Error ? e.message : 'Mesaj araması şu an kullanılamıyor',
          );
        })
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
        if (hit.id === DRACORD_BOT_USER_ID) return;
        try {
          const ch = await client.openDm(hit.id);
          router.push(`/channels/me/${ch.id}`);
        } catch {
          router.push('/channels/me');
        }
      }
    },
    [client, router],
  );

  const onSelectMessage = (hit: SearchHitMessage) => {
    setPanelOpen(false);
    setPanelQ('');
    const threadId = hit.threadRootId || undefined;
    const aroundId = threadId ? threadId : hit.id;
    const qs = new URLSearchParams();
    qs.set('around', aroundId);
    if (threadId) {
      qs.set('thread', threadId);
      if (hit.id !== threadId) qs.set('threadMessage', hit.id);
    }
    const path = hit.guildId
      ? `/channels/${hit.guildId}/${hit.channelId}`
      : `/channels/me/${hit.channelId}`;
    router.push(`${path}?${qs.toString()}`);
  };

  if (isEmbed) return null;

  return (
    <>
      <QuickSwitcher
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        query={quickQ}
        onQueryChange={setQuickQ}
        hits={quickHits}
        loading={loadingQuick}
        error={quickError}
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
        error={panelError}
        onSelectMessage={onSelectMessage}
      />
    </>
  );
}
