'use client';

import {
  ChatInput,
  MessageList,
  Modal,
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
import { useUserPreferences } from '@/lib/user-preferences';

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
  const { prefs } = useUserPreferences();
  const [title, setTitle] = useState('DM');
  const [friends, setFriends] = useState<
    Array<{ id: string; username: string; displayName: string; avatarUrl?: string | null }>
  >([]);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    authorName: string;
    contentPreview: string;
  } | null>(null);
  const [headingOpen, setHeadingOpen] = useState(false);
  const [headingText, setHeadingText] = useState('');
  const [forwardTarget, setForwardTarget] = useState<{
    id: string;
    contentPreview: string;
  } | null>(null);
  const [forwardChannelId, setForwardChannelId] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [dmTargets, setDmTargets] = useState<Array<{ id: string; name: string }>>([]);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [pins, setPins] = useState<
    Array<{ id: string; content: string; authorName: string }>
  >([]);
  const [msgBusy, setMsgBusy] = useState(false);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<{
    id: string;
    preview: string;
  } | null>(null);
  const [editMessageTarget, setEditMessageTarget] = useState<{
    id: string;
    content: string;
  } | null>(null);

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
    editMessage,
    deleteMessage,
    reactToMessage,
    hideMessage,
    unhideMessage,
    pinMessage,
    error,
  } = useChatChannel(channelId, aroundMessageId);

  useEffect(() => {
    setReplyTo(null);
    setPinsOpen(false);
    void client.markChannelRead(channelId).catch(() => undefined);
  }, [client, channelId]);

  useEffect(() => {
    void client.listDms().then((list) => {
      const ch = list.find((c) => c.id === channelId);
      if (ch) setTitle(ch.name);
      setDmTargets(list.filter((c) => c.id !== channelId).map((c) => ({ id: c.id, name: c.name })));
    });
  }, [client, channelId]);

  useEffect(() => {
    if (!pinsOpen) return;
    void client
      .listPinnedMessages(channelId)
      .then((list) =>
        setPins(
          list.map((m) => ({
            id: m.id,
            content: m.content.slice(0, 100),
            authorName: m.author.displayName,
          })),
        ),
      )
      .catch(() => setPins([]));
  }, [pinsOpen, channelId, client]);

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
          <button
            type="button"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
            aria-label="Sabitlenen mesajlar"
            onClick={() => setPinsOpen(true)}
          >
            <span className="material-symbols-outlined text-[18px]">push_pin</span>
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
            hideEmbeds={!prefs.messaging.autoEmbed}
            messageGrouping={
              prefs.accessibility.messageGrouping &&
              prefs.appearance.messageDensity !== 'compact'
            }
            hour24={prefs.language.hour24}
            locale={prefs.language.locale === 'en' ? 'en-US' : 'tr-TR'}
            messageActions={{
              currentUserId: user?.id,
              canManageMessages: true,
              isDm: true,
              developerMode: prefs.developer.developerMode,
              onEdit: (m) => setEditMessageTarget({ id: m.id, content: m.content }),
              onDelete: (m) =>
                setDeleteMessageTarget({
                  id: m.id,
                  preview: m.content.slice(0, 80) || 'Bu mesaj',
                }),
              onReact: (m, emoji) => void reactToMessage(m.id, emoji),
              onHide: (m, permanent) => void hideMessage(m.id, permanent),
              onUnhide: (m) => void unhideMessage(m.id),
              onBlockAuthor: (m) => {
                void client.blockUser(m.author.id).then(() => hideMessage(m.id, true));
              },
              onReply: (m) =>
                setReplyTo({
                  id: m.id,
                  authorName: m.author.displayName,
                  contentPreview: m.content.slice(0, 120) || 'Ek / medya',
                }),
              onForward: (m) => {
                setForwardTarget({ id: m.id, contentPreview: m.content.slice(0, 80) });
                setForwardChannelId(dmTargets[0]?.id ?? '');
                setForwardNote('');
              },
              onPin: (m, pin) => void pinMessage(m.id, pin),
              onCreateHeading: (m) => {
                setHeadingText(m.content.slice(0, 120));
                setHeadingOpen(true);
              },
              onMarkUnread: (m) => {
                void client
                  .markChannelRead(channelId, { messageId: m.id, unreadFrom: true })
                  .catch(() => undefined);
              },
              onJumpToMessage: (id) => {
                router.replace(`/channels/@me/${channelId}?messageId=${id}`, {
                  scroll: false,
                });
              },
            }}
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
          onSend={(content, meta) => {
            void sendMessage(
              content,
              undefined,
              meta?.replyToId ? { replyToId: meta.replyToId } : undefined,
            ).then(() => setReplyTo(null));
          }}
          onAttachFiles={(files) => void sendWithAttachments(files)}
          onSendMedia={(payload) => void sendMedia(payload)}
          onHeadingClick={() => {
            setHeadingText('');
            setHeadingOpen(true);
          }}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          searchGifs={searchGifs}
          loadFeaturedGifs={loadFeaturedGifs}
          mentionUsers={friends}
          spellCheck={prefs.messaging.spellcheck}
        />
      </div>

      <Modal
        open={headingOpen}
        title="Bölüm başlığı"
        onClose={() => setHeadingOpen(false)}
        footer={
          <button
            type="button"
            disabled={msgBusy || !headingText.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              const text = headingText.trim();
              if (!text) return;
              setMsgBusy(true);
              void sendMessage(text, undefined, { type: 'heading' })
                .then(() => {
                  setHeadingOpen(false);
                  setHeadingText('');
                })
                .finally(() => setMsgBusy(false));
            }}
          >
            Oluştur
          </button>
        }
      >
        <input
          value={headingText}
          onChange={(e) => setHeadingText(e.target.value.slice(0, 120))}
          maxLength={120}
          placeholder="Başlık"
          className="h-10 w-full px-space-sm rounded-lg bg-surface-container-highest outline-none"
          autoFocus
        />
      </Modal>

      <Modal
        open={Boolean(forwardTarget)}
        title="Mesajı ilet"
        onClose={() => setForwardTarget(null)}
        footer={
          <button
            type="button"
            disabled={msgBusy || !forwardTarget || !forwardChannelId}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              if (!forwardTarget || !forwardChannelId) return;
              setMsgBusy(true);
              void client
                .forwardMessage(
                  forwardTarget.id,
                  forwardChannelId,
                  forwardNote.trim() || undefined,
                )
                .then(() => {
                  setForwardTarget(null);
                  router.push(`/channels/@me/${forwardChannelId}`);
                })
                .catch(() => undefined)
                .finally(() => setMsgBusy(false));
            }}
          >
            İlet
          </button>
        }
      >
        <label className="flex flex-col gap-space-xs mb-space-md">
          <span className="font-label-sm text-on-surface-variant">Hedef DM</span>
          <select
            value={forwardChannelId}
            onChange={(e) => setForwardChannelId(e.target.value)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none"
          >
            <option value="">Seç…</option>
            {dmTargets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <textarea
          value={forwardNote}
          onChange={(e) => setForwardNote(e.target.value)}
          rows={2}
          placeholder="Not (isteğe bağlı)"
          className="w-full rounded-lg bg-surface-container-highest px-space-sm py-space-sm outline-none"
        />
      </Modal>

      <Modal open={pinsOpen} title="Sabitlenen mesajlar" onClose={() => setPinsOpen(false)}>
        {pins.length === 0 ? (
          <p className="font-body-sm text-outline">Sabitlenmiş mesaj yok.</p>
        ) : (
          <ul className="flex flex-col gap-space-sm max-h-80 overflow-y-auto">
            {pins.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full text-left rounded-lg px-space-sm py-space-sm hover:bg-surface-container-high"
                  onClick={() => {
                    setPinsOpen(false);
                    router.replace(`/channels/@me/${channelId}?messageId=${p.id}`, {
                      scroll: false,
                    });
                  }}
                >
                  <span className="block font-label-sm text-primary-container truncate">
                    {p.authorName}
                  </span>
                  <span className="block font-body-sm truncate">{p.content || 'Ek / medya'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal
        open={Boolean(editMessageTarget)}
        title="Mesajı düzenle"
        onClose={() => setEditMessageTarget(null)}
        footer={
          <button
            type="button"
            disabled={msgBusy || !editMessageTarget?.content.trim()}
            className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container disabled:opacity-50"
            onClick={() => {
              if (!editMessageTarget) return;
              setMsgBusy(true);
              void editMessage(editMessageTarget.id, editMessageTarget.content)
                .then(() => setEditMessageTarget(null))
                .finally(() => setMsgBusy(false));
            }}
          >
            Kaydet
          </button>
        }
      >
        <textarea
          value={editMessageTarget?.content ?? ''}
          onChange={(e) =>
            setEditMessageTarget((prev) =>
              prev ? { ...prev, content: e.target.value } : prev,
            )
          }
          rows={4}
          className="w-full rounded-lg bg-surface-container-highest px-space-sm py-space-sm outline-none"
        />
      </Modal>

      <Modal
        open={Boolean(deleteMessageTarget)}
        title="Mesajı sil"
        onClose={() => setDeleteMessageTarget(null)}
        footer={
          <button
            type="button"
            disabled={msgBusy}
            className="px-space-md py-space-sm rounded-lg bg-error text-on-error disabled:opacity-50"
            onClick={() => {
              if (!deleteMessageTarget) return;
              setMsgBusy(true);
              void deleteMessage(deleteMessageTarget.id)
                .then(() => setDeleteMessageTarget(null))
                .finally(() => setMsgBusy(false));
            }}
          >
            Sil
          </button>
        }
      >
        <p className="font-body-sm text-outline">
          {deleteMessageTarget?.preview} silinsin mi?
        </p>
      </Modal>
    </AppShell>
  );
}

interface PageProps {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ around?: string; messageId?: string }>;
}

export default function DmChannelPage({ params, searchParams }: PageProps) {
  const { channelId } = use(params);
  const sp = use(searchParams);
  return (
    <RequireAuth>
      <Suspense fallback={<div className="p-8 text-outline">Yükleniyor…</div>}>
        <DmChatInner
          channelId={channelId}
          aroundMessageId={sp.messageId ?? sp.around ?? null}
        />
      </Suspense>
    </RequireAuth>
  );
}
