'use client';

import {
  ChatInput,
  MessageList,
} from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { Suspense, use, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { DracoEmpty } from '@/components/Draco';
import { openMessageSearch } from '@/components/GlobalSearch';
import { RequireAuth } from '@/components/RequireAuth';
import { useChatChannel } from '@/hooks/useChatChannel';
import { useGuildNav } from '@/hooks/useGuildNav';

function DmChatInner({
  channelId,
  aroundMessageId,
}: {
  channelId: string;
  aroundMessageId?: string | null;
}) {
  const router = useRouter();
  const { client, user } = useAuth();
  const { guilds } = useGuildNav(undefined);
  const [title, setTitle] = useState('DM');
  const [friends, setFriends] = useState<
    Array<{ id: string; username: string; displayName: string; avatarUrl?: string | null }>
  >([]);
  const mentionNames = user
    ? [...new Set([user.username, user.displayName].filter(Boolean))]
    : [];

  const {
    messages,
    loading,
    loadingOlder,
    hasMore,
    pendingNewCount,
    setAtLiveEdge,
    loadOlder,
    jumpToPresent,
    sendMessage,
    sendWithAttachments,
    sendMedia,
    error,
  } = useChatChannel(channelId, aroundMessageId);

  useEffect(() => {
    void client.listDms().then((list) => {
      const ch = list.find((c) => c.id === channelId);
      if (ch) setTitle(ch.name);
    });
  }, [client, channelId]);

  useEffect(() => {
    if (!user) return;
    void client
      .getFriends()
      .then((list) =>
        setFriends(
          list.map((f) => ({
            id: f.id,
            username: f.username,
            displayName: f.displayName,
            avatarUrl: f.avatarUrl,
          })),
        ),
      )
      .catch(() => setFriends([]));
  }, [client, user]);

  const searchGifs = useCallback(
    async (q: string) => {
      const list = await client.searchGifs(q);
      return list.map((g) => ({
        id: g.id,
        url: g.url,
        previewUrl: g.previewUrl,
        label: g.label,
      }));
    },
    [client],
  );

  const loadFeaturedGifs = useCallback(async () => {
    const list = await client.featuredGifs();
    return list.map((g) => ({
      id: g.id,
      url: g.url,
      previewUrl: g.previewUrl,
      label: g.label,
    }));
  }, [client]);

  return (
    <AppShell guilds={guilds} homeActive titleBarNav="direct-messages">
      <div className="flex flex-1 min-w-0 min-h-0 flex-col bg-surface">
        <header className="h-12 px-space-md flex items-center gap-space-sm border-b border-surface-container-high shadow-bar shrink-0">
          <button
            type="button"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
            onClick={() => router.push('/channels/@me')}
            aria-label="Geri"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <span className="font-headline-md text-on-surface truncate">{title}</span>
          <button
            type="button"
            className="ml-auto h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
            onClick={() => openMessageSearch()}
            aria-label="Ara"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
          </button>
        </header>
        {error && <p className="px-space-md py-space-sm text-error font-body-sm">{error}</p>}
        {loading && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-outline">Yükleniyor…</div>
        ) : (
          <MessageList
            scrollKey={channelId}
            messages={messages}
            mentionNames={mentionNames}
            censorLinkPreviews={Boolean(user?.censorLinkPreviews)}
            hasMore={hasMore}
            loadingOlder={loadingOlder}
            pendingNewCount={pendingNewCount}
            highlightMessageId={aroundMessageId}
            onLoadOlder={() => void loadOlder()}
            onJumpToPresent={() => void jumpToPresent()}
            onLiveEdgeChange={setAtLiveEdge}
            onHighlightSettled={() => {
              if (!aroundMessageId) return;
              router.replace(`/channels/@me/${channelId}`, { scroll: false });
            }}
            emptyState={
              <DracoEmpty
                mood="happy"
                size={110}
                title="Henüz mesaj yok"
                description="Draco hazır — ilk mesajı sen at!"
              />
            }
          />
        )}
        <ChatInput
          key={channelId}
          placeholder={`@${title} kullanıcısına mesaj gönder`}
          onSend={(content) => void sendMessage(content)}
          onAttachFiles={(files) => void sendWithAttachments(files)}
          onSendMedia={(payload) => void sendMedia(payload)}
          searchGifs={searchGifs}
          loadFeaturedGifs={loadFeaturedGifs}
          mentionUsers={friends}
        />
      </div>
    </AppShell>
  );
}

interface PageProps {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ around?: string }>;
}

export default function DmChannelPage({ params, searchParams }: PageProps) {
  const { channelId } = use(params);
  const sp = use(searchParams);
  return (
    <RequireAuth>
      <Suspense fallback={<div className="p-8 text-outline">Yükleniyor…</div>}>
        <DmChatInner channelId={channelId} aroundMessageId={sp.around ?? null} />
      </Suspense>
    </RequireAuth>
  );
}
