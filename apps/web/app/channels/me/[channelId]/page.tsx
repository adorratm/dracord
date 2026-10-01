'use client';

import {
  ChatInput,
  MessageList,
  Modal,
} from '@dracord/ui';
import { useRouter } from 'next/navigation';
import { Suspense, use, useCallback, useEffect, useMemo, useState } from 'react';
import type { MessageDto } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { DracoEmpty } from '@/components/Draco';
import { openMessageSearch } from '@/components/GlobalSearch';
import { RequireAuth } from '@/components/RequireAuth';
import { PinnedMessageBar } from '@/components/PinnedMessageBar';
import { DmCallControls } from '@/components/DmCallControls';
import { useChatChannel } from '@/hooks/useChatChannel';
import { useGuildNav } from '@/hooks/useGuildNav';
import {
  filterMessageContent,
  isSuspiciousUrl,
} from '@/lib/content-filter';
import { getDmReturnPath } from '@/lib/settings-return';
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
  const [selfNotes, setSelfNotes] = useState(false);
  const [peerStatus, setPeerStatus] = useState<string | null>(null);
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
  const [latestPin, setLatestPin] = useState<MessageDto | null>(null);
  const [pinCount, setPinCount] = useState(0);
  const [msgBusy, setMsgBusy] = useState(false);
  const [deleteMessageTarget, setDeleteMessageTarget] = useState<{
    id: string;
    preview: string;
  } | null>(null);
  const [editMessageTarget, setEditMessageTarget] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [threadRoot, setThreadRoot] = useState<MessageDto | null>(null);
  const [threadMessages, setThreadMessages] = useState<MessageDto[]>([]);
  const [threadDraft, setThreadDraft] = useState('');
  const [threadBusy, setThreadBusy] = useState(false);
  const [threadSending, setThreadSending] = useState(false);
  const [threadScrollEl, setThreadScrollEl] = useState<HTMLDivElement | null>(null);

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
    bookmarkMessage,
    error,
    typingUsers,
    notifyTyping,
  } = useChatChannel(channelId, aroundMessageId);

  const displayMessages = useMemo(() => {
    if (!prefs.messaging.filterExplicit) return messages;
    return messages.map((msg) => {
      const content = filterMessageContent(msg.content, true);
      const embeds = msg.embeds?.filter((e) => {
        const probe = [e.url, e.imageUrl, e.title, e.description]
          .filter(Boolean)
          .join(' ');
        return !isSuspiciousUrl(probe);
      });
      if (content === msg.content && embeds?.length === (msg.embeds?.length ?? 0)) {
        return msg;
      }
      return { ...msg, content, embeds };
    });
  }, [messages, prefs.messaging.filterExplicit]);

  useEffect(() => {
    setReplyTo(null);
    setPinsOpen(false);
    setThreadRoot(null);
    setThreadDraft('');
    void client.markChannelRead(channelId).catch(() => undefined);
  }, [client, channelId]);

  useEffect(() => {
    if (!threadRoot) {
      setThreadMessages([]);
      return;
    }
    setThreadBusy(true);
    void client
      .getMessageThread(threadRoot.id)
      .then((page) => setThreadMessages(page.items))
      .catch(() => setThreadMessages([threadRoot]))
      .finally(() => setThreadBusy(false));
  }, [threadRoot, client]);

  useEffect(() => {
    if (!threadRoot) return;
    const sock = client.connectSocket();
    const onCreate = (message: MessageDto) => {
      if (message.threadRootId !== threadRoot.id && message.id !== threadRoot.id) return;
      setThreadMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };
    sock.on(SocketEvents.MESSAGE_CREATE, onCreate);
    return () => {
      sock.off(SocketEvents.MESSAGE_CREATE, onCreate);
    };
  }, [threadRoot, client]);

  useEffect(() => {
    if (!threadScrollEl) return;
    threadScrollEl.scrollTop = threadScrollEl.scrollHeight;
  }, [threadMessages.length, threadRoot?.id, threadScrollEl]);

  useEffect(() => {
    void client.listDms().then((list) => {
      const ch = list.find((c) => c.id === channelId);
      if (ch) {
        setTitle(ch.name);
        setSelfNotes(Boolean(ch.selfNotes));
        setPeerStatus(ch.peerStatus ?? null);
      }
      setDmTargets(list.filter((c) => c.id !== channelId).map((c) => ({ id: c.id, name: c.name })));
    });
  }, [client, channelId]);

  useEffect(() => {
    if (!user) return;
    const sock = client.connectSocket();
    const onPresence = (payload: { userId: string; status: string }) => {
      void client.listDms().then((list) => {
        const ch = list.find((c) => c.id === channelId);
        if (ch?.peerUserId === payload.userId) {
          setPeerStatus(payload.status);
        }
      });
    };
    sock.on(SocketEvents.PRESENCE_UPDATE, onPresence);
    return () => {
      sock.off(SocketEvents.PRESENCE_UPDATE, onPresence);
    };
  }, [client, user, channelId]);

  const refreshPins = useCallback(async () => {
    try {
      const list = await client.listPinnedMessages(channelId);
      setPinCount(list.length);
      setLatestPin(list[0] ?? null);
      setPins(
        list.map((m) => ({
          id: m.id,
          content: m.content.slice(0, 100),
          authorName: m.author.displayName,
        })),
      );
    } catch {
      setLatestPin(null);
      setPinCount(0);
      setPins([]);
    }
  }, [client, channelId]);

  useEffect(() => {
    void refreshPins();
  }, [refreshPins]);

  useEffect(() => {
    const sock = client.connectSocket();
    const onUpdate = (message: MessageDto) => {
      if (message.channelId !== channelId) return;
      if (message.pinnedAt || latestPin?.id === message.id) void refreshPins();
    };
    const onDelete = (payload: { id: string; channelId: string }) => {
      if (payload.channelId !== channelId) return;
      if (latestPin?.id === payload.id) void refreshPins();
    };
    sock.on(SocketEvents.MESSAGE_UPDATE, onUpdate);
    sock.on(SocketEvents.MESSAGE_DELETE, onDelete);
    return () => {
      sock.off(SocketEvents.MESSAGE_UPDATE, onUpdate);
      sock.off(SocketEvents.MESSAGE_DELETE, onDelete);
    };
  }, [client, channelId, refreshPins, latestPin?.id]);

  useEffect(() => {
    if (!pinsOpen) return;
    void refreshPins();
  }, [pinsOpen, refreshPins]);

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
            onClick={() => router.push(getDmReturnPath('/channels/@me'))}
            aria-label="Geri"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <span className="font-headline-md text-on-surface truncate">{title}</span>
          <div className="ml-auto flex items-center gap-1 relative">
            <DmCallControls
              channelId={channelId}
              selfNotes={selfNotes}
              friends={friends}
              peerStatus={peerStatus}
            />
            <button
              type="button"
              className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container"
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
          </div>
        </header>
        {latestPin && (
          <PinnedMessageBar
            message={latestPin}
            pinCount={pinCount}
            onJump={() => {
              router.replace(`/channels/me/${channelId}?messageId=${latestPin.id}`, {
                scroll: false,
              });
            }}
            onViewAll={() => setPinsOpen(true)}
          />
        )}
        {error && <p className="px-space-md py-space-sm text-error font-body-sm">{error}</p>}
        {loading && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-outline">Yükleniyor…</div>
        ) : (
          <MessageList
            scrollKey={channelId}
            messages={displayMessages}
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
              onReport: (m) => {
                void hideMessage(m.id, true);
              },
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
              onPin: (m, pin) => {
                void pinMessage(m.id, pin).then(() => void refreshPins());
              },
              onBookmark: (m, bookmark) => void bookmarkMessage(m.id, bookmark),
              onOpenThread: (m) => {
                setThreadRoot(m);
                setThreadDraft('');
              },
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
        <div className="relative shrink-0">
          {typingUsers.length > 0 && (
            <p className="px-space-md pb-1 font-label-sm text-outline truncate">
              {typingUsers.length === 1
                ? `${typingUsers[0]!.username} yazıyor…`
                : `${typingUsers.length} kişi yazıyor…`}
            </p>
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
          onTyping={notifyTyping}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          searchGifs={searchGifs}
          loadFeaturedGifs={loadFeaturedGifs}
          mentionUsers={friends}
          spellCheck={prefs.messaging.spellcheck}
          uploadStickerFile={async (file) => {
            const uploaded = await client.uploadFile(file, 'stickers');
            return { url: uploaded.url, contentType: uploaded.contentType };
          }}
        />
        </div>
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

      <Modal
        open={Boolean(threadRoot)}
        title={
          threadRoot ? `Thread · ${threadRoot.author.displayName}` : 'Thread'
        }
        onClose={() => {
          setThreadRoot(null);
          setThreadDraft('');
        }}
      >
        {threadRoot && (
          <p className="font-body-sm text-outline mb-space-sm line-clamp-2">
            {threadRoot.content.trim() || 'Ek / medya'}
          </p>
        )}
        {threadBusy && <p className="font-body-sm text-outline mb-space-sm">Yükleniyor…</p>}
        <div
          ref={setThreadScrollEl}
          className="max-h-72 overflow-y-auto space-y-space-sm mb-space-md"
        >
          {threadMessages.map((m, idx) => {
            const isRoot = idx === 0 && m.id === threadRoot?.id;
            return (
              <div
                key={m.id}
                className={
                  isRoot
                    ? 'rounded-lg border border-primary-container/40 bg-primary-container/10 px-space-sm py-space-xs'
                    : 'rounded-lg bg-surface-container-highest px-space-sm py-space-xs'
                }
              >
                <p className="font-label-sm text-primary-container truncate flex items-center gap-1">
                  {m.author.displayName}
                  {isRoot && (
                    <span className="text-outline font-normal">· başlangıç</span>
                  )}
                </p>
                <p className="font-body-sm text-on-surface whitespace-pre-wrap break-words">
                  {m.content || 'Ek / medya'}
                </p>
              </div>
            );
          })}
          {!threadBusy && threadMessages.length === 0 && (
            <p className="font-body-sm text-outline">Henüz yanıt yok — ilk yanıtı sen yaz.</p>
          )}
        </div>
        <div className="flex gap-space-sm">
          <input
            value={threadDraft}
            onChange={(e) => setThreadDraft(e.target.value)}
            placeholder="Thread’e yanıt yaz…"
            disabled={threadSending}
            className="flex-1 h-10 px-space-sm rounded-lg bg-surface-container-highest outline-none disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && threadDraft.trim() && threadRoot && !threadSending) {
                e.preventDefault();
                setThreadSending(true);
                void sendMessage(threadDraft.trim(), undefined, {
                  threadRootId: threadRoot.id,
                })
                  .then(() => setThreadDraft(''))
                  .finally(() => setThreadSending(false));
              }
            }}
          />
          <button
            type="button"
            disabled={!threadDraft.trim() || !threadRoot || threadSending}
            className="h-10 px-space-md rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
            onClick={() => {
              if (!threadRoot || !threadDraft.trim() || threadSending) return;
              setThreadSending(true);
              void sendMessage(threadDraft.trim(), undefined, {
                threadRootId: threadRoot.id,
              })
                .then(() => setThreadDraft(''))
                .finally(() => setThreadSending(false));
            }}
          >
            Gönder
          </button>
        </div>
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
