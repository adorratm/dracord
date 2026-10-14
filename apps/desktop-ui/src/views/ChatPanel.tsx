import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChannelSummary,
  MessageAttachment,
  MessageDto,
  PublicUser,
  SearchHit,
  SearchHitMessage,
} from '@dracord/types';
import { DRACORD_BOT_USER_ID, SocketEvents } from '@dracord/types';
import {
  ChatInput,
  MessageList,
  Modal,
  SearchPanel,
  dataUrlToFile,
  type ChatMediaPayload,
  type SearchScope,
} from '@dracord/ui';
import { MusicPlayerBar } from '@/components/MusicPlayerBar';
import { DracoEmpty } from '../components/Draco';
import { useAuth } from '../auth';
import { useVoiceSession } from '../voice/VoiceSession';

export function ChatPanel({
  guildId,
  channel,
  members = [],
  showMembersToggle,
  hideHeader = false,
  titleOverride,
  className,
}: {
  guildId: string;
  channel: ChannelSummary;
  members?: PublicUser[];
  showMembersToggle?: () => void;
  /** Ses / aktivite yan panelinde üst başlığı gizle */
  hideHeader?: boolean;
  titleOverride?: string;
  className?: string;
}) {
  const { client, user } = useAuth();
  const voice = useVoiceSession();
  const inVoice = Boolean(voice.voiceChannelId);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [editing, setEditing] = useState<MessageDto | null>(null);
  const [pins, setPins] = useState<MessageDto[]>([]);
  const [showPins, setShowPins] = useState(false);
  const [threadRoot, setThreadRoot] = useState<MessageDto | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<MessageDto[]>([]);
  const [threadBusy, setThreadBusy] = useState(false);
  const [threadReplyTo, setThreadReplyTo] = useState<MessageDto | null>(null);
  const [threadEditing, setThreadEditing] = useState<MessageDto | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState('Evet\nHayır');
  const [threadsPreviewOpen, setThreadsPreviewOpen] = useState(false);
  const [threadsPreview, setThreadsPreview] = useState<MessageDto[]>([]);
  const [threadsPreviewBusy, setThreadsPreviewBusy] = useState(false);
  const [channelSearchOpen, setChannelSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('channel');
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeThread = useCallback(() => {
    setThreadRoot(null);
    setThreadMsgs([]);
    setThreadBusy(false);
    setThreadReplyTo(null);
    setThreadEditing(null);
  }, []);

  useEffect(() => {
    client.joinChannel(channel.id);
    void client.getMessages(channel.id).then((page) => {
      setMessages(page.items ?? []);
    });
    void client.listPinnedMessages(channel.id).then(setPins).catch(() => setPins([]));
    closeThread();
    setThreadsPreviewOpen(false);
    setThreadsPreview([]);
    const sock = client.connectSocket();
    const onMsg = (msg: MessageDto) => {
      if (msg.channelId !== channel.id) return;
      if (msg.threadRootId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.threadRootId
              ? { ...m, threadReplyCount: (m.threadReplyCount ?? 0) + 1 }
              : m,
          ),
        );
        return;
      }
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    const onUpdate = (msg: MessageDto) => {
      if (msg.channelId !== channel.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      setThreadMsgs((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };
    const onDelete = (payload: { id: string; channelId: string }) => {
      if (payload.channelId !== channel.id) return;
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
      setThreadMsgs((prev) => prev.filter((m) => m.id !== payload.id));
    };
    sock.on(SocketEvents.MESSAGE_CREATE, onMsg);
    sock.on(SocketEvents.MESSAGE_UPDATE, onUpdate);
    sock.on(SocketEvents.MESSAGE_DELETE, onDelete);
    return () => {
      sock.off(SocketEvents.MESSAGE_CREATE, onMsg);
      sock.off(SocketEvents.MESSAGE_UPDATE, onUpdate);
      sock.off(SocketEvents.MESSAGE_DELETE, onDelete);
      client.leaveChannel(channel.id);
    };
  }, [client, channel.id, closeThread]);

  // Thread yükle + canlı yanıtlar (web GuildChannelView parity)
  useEffect(() => {
    if (!threadRoot) {
      setThreadMsgs([]);
      return;
    }
    setThreadBusy(true);
    void client
      .getMessageThread(threadRoot.id)
      .then((page) => setThreadMsgs(page.items ?? []))
      .catch(() => setThreadMsgs([threadRoot]))
      .finally(() => setThreadBusy(false));
  }, [threadRoot, client]);

  useEffect(() => {
    if (!threadRoot) return;
    const sock = client.connectSocket();
    const onCreate = (message: MessageDto) => {
      if (message.threadRootId !== threadRoot.id && message.id !== threadRoot.id) return;
      setThreadMsgs((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };
    sock.on(SocketEvents.MESSAGE_CREATE, onCreate);
    return () => {
      sock.off(SocketEvents.MESSAGE_CREATE, onCreate);
    };
  }, [threadRoot, client]);

  const openThread = useCallback((m: MessageDto) => {
    setThreadRoot(m);
    setReplyTo(null);
    setEditing(null);
    setThreadReplyTo(null);
    setThreadEditing(null);
  }, []);

  const patchThreadMsg = useCallback((msg: MessageDto) => {
    setThreadMsgs((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
  }, []);

  const openThreadsPreview = useCallback(() => {
    setThreadsPreviewOpen(true);
    setThreadsPreviewBusy(true);
    void client
      .listChannelThreads(channel.id, 10)
      .then((page) => setThreadsPreview(page.items ?? []))
      .catch(() => setThreadsPreview([]))
      .finally(() => setThreadsPreviewBusy(false));
  }, [client, channel.id]);

  const runChannelSearch = useCallback(
    (query: string, scope: SearchScope) => {
      if (!query.trim()) {
        setSearchHits([]);
        return;
      }
      setSearchBusy(true);
      void client
        .search({
          q: query.trim(),
          limit: 24,
          types: ['message'],
          guildId: scope === 'guild' || scope === 'channel' ? guildId : undefined,
          channelId: scope === 'channel' ? channel.id : undefined,
        })
        .then((res) => setSearchHits(res.hits ?? []))
        .catch(() => setSearchHits([]))
        .finally(() => setSearchBusy(false));
    },
    [client, guildId, channel.id],
  );

  const sendText = async (
    content: string,
    meta?: { replyToId?: string; threadRootId?: string },
  ) => {
    if (editing && !meta?.threadRootId) {
      await client.updateMessage(editing.id, content);
      setEditing(null);
      return;
    }
    await client.sendMessage(channel.id, content, undefined, undefined, {
      replyToId: meta?.replyToId ?? (meta?.threadRootId ? undefined : replyTo?.id),
      threadRootId: meta?.threadRootId,
    });
    if (!meta?.threadRootId) setReplyTo(null);
  };

  const uploadFiles = async (
    files: FileList | File[],
    opts?: { replyToId?: string; threadRootId?: string },
  ) => {
    const list = Array.from(files);
    const attachments: MessageAttachment[] = [];
    for (const file of list) {
      attachments.push(await client.uploadFile(file));
    }
    if (attachments.length) {
      await client.sendMessage(channel.id, '', attachments, undefined, {
        replyToId: opts?.replyToId ?? (opts?.threadRootId ? undefined : replyTo?.id),
        threadRootId: opts?.threadRootId,
      });
      if (!opts?.threadRootId) setReplyTo(null);
    }
  };

  const sendMedia = async (
    payload: ChatMediaPayload,
    opts?: { threadRootId?: string },
  ) => {
    if (payload.type === 'sticker') {
      await client.sendMessage(
        channel.id,
        `sticker:${payload.emoji}`,
        undefined,
        undefined,
        opts,
      );
      return;
    }
    if (payload.type === 'sticker-image') {
      if (payload.url.startsWith('data:')) {
        const file = await dataUrlToFile(payload.url, payload.label || 'sticker');
        const uploaded = await client.uploadFile(file, 'stickers');
        await client.sendMessage(
          channel.id,
          `sticker:${uploaded.url}`,
          undefined,
          undefined,
          opts,
        );
        return;
      }
      await client.sendMessage(
        channel.id,
        `sticker:${payload.url}`,
        undefined,
        undefined,
        opts,
      );
      return;
    }
    const attachment: MessageAttachment = {
      id: `gif-${Date.now()}`,
      url: payload.url,
      filename: `${payload.label || 'gif'}.gif`,
      contentType: 'image/gif',
      size: 0,
    };
    await client.sendMessage(channel.id, payload.label || 'GIF', [attachment], undefined, opts);
  };

  const isForumView = channel.type === 'FORUM';

  const sharedInputProps = {
    channelName: channel.name,
    mentionUsers: members.map((m) => ({
      id: m.id,
      username: m.username,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl,
    })),
    mentionChannels: [{ id: channel.id, name: channel.name, type: channel.type }],
    searchGifs: (q: string) =>
      client.searchGifs(q).then((list) =>
        list.map((g) => ({
          id: g.id,
          url: g.url,
          previewUrl: g.previewUrl ?? g.url,
          label: g.label ?? g.id,
        })),
      ),
    loadFeaturedGifs: () =>
      client.featuredGifs().then((list) =>
        list.map((g) => ({
          id: g.id,
          url: g.url,
          previewUrl: g.previewUrl ?? g.url,
          label: g.label ?? g.id,
        })),
      ),
    uploadStickerFile: async (file: File) => {
      const uploaded = await client.uploadFile(file, 'stickers');
      return { url: uploaded.url, contentType: uploaded.contentType };
    },
    onTyping: () => {
      client.startTyping(channel.id);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => undefined, 2000);
    },
    onPollClick: () => setPollOpen(true),
  };

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 h-full ${className ?? ''}`}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!hideHeader && (
          <header className="h-12 shrink-0 border-b border-outline-variant flex items-center gap-2 px-4">
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">tag</span>
            <strong className="font-headline-md text-headline-md truncate">
              {titleOverride ?? channel.name}
            </strong>
            {channel.topic && (
              <span className="text-sm text-on-surface-variant truncate hidden md:inline">
                — {channel.topic}
              </span>
            )}
            <div className="flex-1" />
            <button
              type="button"
              className="h-8 w-8 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex items-center justify-center"
              aria-label="Mesajlarda ara"
              title="Mesajlarda ara"
              onClick={() => {
                setSearchScope('channel');
                setSearchQ('');
                setSearchHits([]);
                setChannelSearchOpen(true);
              }}
            >
              <span className="material-symbols-outlined text-[18px]">search</span>
            </button>
            <button
              type="button"
              className="h-8 px-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex items-center gap-1 text-sm"
              onClick={() => {
                setShowPins((v) => !v);
                void client.listPinnedMessages(channel.id).then(setPins);
              }}
            >
              <span className="material-symbols-outlined text-[18px]">push_pin</span>
              {pins.length}
            </button>
            <button
              type="button"
              className="h-8 w-8 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex items-center justify-center"
              aria-label="Son threadler"
              title="Son threadler"
              onClick={() => openThreadsPreview()}
            >
              <span className="material-symbols-outlined text-[18px]">forum</span>
            </button>
            {showMembersToggle && (
              <button
                type="button"
                className="h-8 w-8 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface flex items-center justify-center"
                onClick={showMembersToggle}
                title="Üyeler"
              >
                <span className="material-symbols-outlined text-[20px]">group</span>
              </button>
            )}
          </header>
        )}

        {showPins && (
          <div className="max-h-40 overflow-auto border-b border-outline-variant bg-surface-container-low px-3 py-2">
            {pins.map((p) => (
              <div key={p.id} className="text-sm py-1">
                <strong className="text-primary-container">{p.author?.displayName}</strong>
                <span className="text-on-surface-variant">: {p.content}</span>
              </div>
            ))}
            {pins.length === 0 && (
              <div className="text-sm text-on-surface-variant">Pin yok</div>
            )}
          </div>
        )}

        {threadRoot ? (
          <div className="flex flex-1 min-h-0 min-w-0 flex-col bg-surface-container-low">
            <div className="h-12 px-4 flex items-center gap-2 border-b border-outline-variant shrink-0">
              <button
                type="button"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                aria-label="Kanala dön"
                onClick={closeThread}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
              <span className="material-symbols-outlined text-[18px] text-primary-container">
                forum
              </span>
              <span className="font-headline-sm text-on-surface truncate flex-1">
                {isForumView ? 'Gönderi' : 'Thread'} · {threadRoot.author?.displayName}
              </span>
              <button
                type="button"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                aria-label="Thread’i kapat"
                onClick={closeThread}
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="px-4 pt-2 font-body-sm text-on-surface-variant line-clamp-2 shrink-0">
              {threadRoot.content?.trim() || 'Ek / medya'}
            </p>
            {threadBusy && (
              <p className="px-4 py-2 font-body-sm text-on-surface-variant">Yükleniyor…</p>
            )}
            <MessageList
              className="flex-1 min-h-0"
              messages={
                threadMsgs.some((m) => m.id === threadRoot.id)
                  ? threadMsgs
                  : [threadRoot, ...threadMsgs]
              }
              scrollKey={`thread-${threadRoot.id}`}
              mentionNames={members.map((m) => m.username)}
              channelNames={[channel.name]}
              censorLinkPreviews={Boolean(user?.censorLinkPreviews)}
              messageActions={{
                currentUserId: user?.id,
                guildId: guildId || null,
                canManageMessages: true,
                onEdit: (m) => {
                  setThreadEditing(m);
                  setThreadReplyTo(null);
                },
                onDelete: (m) => {
                  if (confirm('Mesaj silinsin mi?')) {
                    void client.deleteMessage(m.id).then(() => {
                      setThreadMsgs((prev) => prev.filter((x) => x.id !== m.id));
                    });
                  }
                },
                onReact: (m, emoji) => {
                  void client.toggleReaction(m.id, emoji).then(patchThreadMsg);
                },
                onReply: (m) => {
                  setThreadReplyTo(m);
                  setThreadEditing(null);
                },
                onPin: (m, pin) => {
                  void (pin ? client.pinMessage(m.id) : client.unpinMessage(m.id))
                    .then(patchThreadMsg)
                    .then(() => client.listPinnedMessages(channel.id).then(setPins));
                },
                onBookmark: (m, bookmark) => {
                  void (bookmark
                    ? client.bookmarkMessage(m.id)
                    : client.unbookmarkMessage(m.id)
                  ).then(patchThreadMsg);
                },
                onVotePoll: (m, optionId) => {
                  void client.votePoll(m.id, optionId).then(patchThreadMsg);
                },
                onAuthorClick: (author) => {
                  if (author.isBot || author.id === DRACORD_BOT_USER_ID) return;
                  void client.openDm(author.id);
                },
              }}
              emptyState={
                <DracoEmpty
                  mood="peek"
                  size={88}
                  title="Henüz yanıt yok"
                  description="İlk yanıtı sen yaz — Draco dinliyor."
                />
              }
            />
            <div className="shrink-0 border-t border-outline-variant relative z-[100]">
              <ChatInput
                key={`thread-${threadRoot.id}`}
                placeholder={
                  threadEditing ? 'Mesajı düzenle…' : 'Thread’e yanıt yaz…'
                }
                {...sharedInputProps}
                replyTo={
                  threadReplyTo
                    ? {
                        id: threadReplyTo.id,
                        authorName: threadReplyTo.author?.displayName ?? 'üye',
                        contentPreview: threadReplyTo.content.slice(0, 80),
                      }
                    : null
                }
                onCancelReply={() => {
                  setThreadReplyTo(null);
                  setThreadEditing(null);
                }}
                onSend={(text, meta) => {
                  if (threadEditing) {
                    void client.updateMessage(threadEditing.id, text).then((msg) => {
                      patchThreadMsg(msg);
                      setThreadEditing(null);
                    });
                    return;
                  }
                  void sendText(text, {
                    threadRootId: threadRoot.id,
                    replyToId: meta?.replyToId ?? threadReplyTo?.id,
                  }).then(() => setThreadReplyTo(null));
                }}
                onAttachFiles={(files) =>
                  void uploadFiles(files, {
                    threadRootId: threadRoot.id,
                    replyToId: threadReplyTo?.id,
                  }).then(() => setThreadReplyTo(null))
                }
                onSendMedia={(payload) =>
                  void sendMedia(payload, { threadRootId: threadRoot.id })
                }
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-1 min-h-0 min-w-0 flex-col">
              <MessageList
                className="flex-1 min-h-0"
                messages={messages}
                scrollKey={channel.id}
                highlightMessageId={highlightMessageId}
                onHighlightSettled={() => setHighlightMessageId(null)}
                mentionNames={members.map((m) => m.username)}
                channelNames={[channel.name]}
                censorLinkPreviews={Boolean(user?.censorLinkPreviews)}
                messageActions={{
                  currentUserId: user?.id,
                  guildId: guildId || null,
                  onEdit: (m) => {
                    setEditing(m);
                    setReplyTo(null);
                  },
                  onDelete: (m) => {
                    if (confirm('Mesaj silinsin mi?')) void client.deleteMessage(m.id);
                  },
                  onReact: (m, emoji) => void client.toggleReaction(m.id, emoji),
                  onReply: (m) => {
                    setReplyTo(m);
                    setEditing(null);
                  },
                  onPin: (m, pin) => {
                    void (pin ? client.pinMessage(m.id) : client.unpinMessage(m.id)).then(() =>
                      client.listPinnedMessages(channel.id).then(setPins),
                    );
                  },
                  onBookmark: (m, bookmark) => {
                    void (bookmark ? client.bookmarkMessage(m.id) : client.unbookmarkMessage(m.id));
                  },
                  onOpenThread: (m) => openThread(m),
                  onVotePoll: (m, optionId) => void client.votePoll(m.id, optionId),
                  onAuthorClick: (author) => {
                    if (author.isBot || author.id === DRACORD_BOT_USER_ID) return;
                    void client.openDm(author.id);
                  },
                }}
                emptyState={
                  !guildId ? (
                    <DracoEmpty
                      mood="happy"
                      size={110}
                      title="Henüz mesaj yok"
                      description="Draco hazır — ilk mesajı sen at!"
                    />
                  ) : (
                    <DracoEmpty
                      mood="idle"
                      size={120}
                      title={isForumView ? 'Henüz gönderi yok' : 'Henüz mesaj yok'}
                      description={
                        isForumView
                          ? 'İlk konuyu aç — yanıtlar thread panelinde toplanır.'
                          : 'Draco dinliyor — sohbeti sen başlat!'
                      }
                    />
                  )
                }
              />
            </div>

            <div className="shrink-0 border-t border-outline-variant relative z-[100]">
              {inVoice && !hideHeader && (
                <MusicPlayerBar
                  guildId={guildId}
                  textChannelId={channel.id}
                  variant="chat"
                />
              )}
              <ChatInput
                key={channel.id}
                {...sharedInputProps}
                placeholder={
                  editing
                    ? 'Mesajı düzenle…'
                    : isForumView
                      ? `Yeni gönderi · #${channel.name}`
                      : !guildId
                        ? `@${titleOverride ?? channel.name ?? 'DM'} kullanıcısına mesaj gönder`
                        : undefined
                }
                replyTo={
                  replyTo
                    ? {
                        id: replyTo.id,
                        authorName: replyTo.author?.displayName ?? 'üye',
                        contentPreview: replyTo.content.slice(0, 80),
                      }
                    : null
                }
                onCancelReply={() => {
                  setReplyTo(null);
                  setEditing(null);
                }}
                onAttachFiles={(files) => void uploadFiles(files)}
                onSend={(text, meta) => {
                  if (editing) {
                    void sendText(text);
                    return;
                  }
                  void sendText(text, meta);
                }}
                onSendMedia={(payload) => void sendMedia(payload)}
              />
              {editing && (
                <div className="px-4 pb-2 text-xs text-on-surface-variant flex justify-between">
                  <span>Düzenleniyor — gönder ile kaydet</span>
                  <button type="button" onClick={() => setEditing(null)}>
                    İptal
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <SearchPanel
        open={channelSearchOpen}
        onClose={() => setChannelSearchOpen(false)}
        query={searchQ}
        onQueryChange={(q) => {
          setSearchQ(q);
          runChannelSearch(q, searchScope);
        }}
        scope={searchScope}
        onScopeChange={(s) => {
          setSearchScope(s);
          runChannelSearch(searchQ, s);
        }}
        hits={searchHits}
        loading={searchBusy}
        channelName={channel.name}
        onSelectMessage={(hit: SearchHitMessage) => {
          setChannelSearchOpen(false);
          setHighlightMessageId(hit.id);
        }}
      />

      <Modal
        open={pollOpen}
        title="Anket oluştur"
        onClose={() => setPollOpen(false)}
        footer={
          <button
            type="button"
            disabled={!pollQ.trim()}
            className="h-9 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold disabled:opacity-50"
            onClick={() => {
              const options = pollOpts
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
              if (!pollQ.trim() || options.length < 2) return;
              void client
                .sendMessage(
                  channel.id,
                  pollQ.trim(),
                  undefined,
                  { question: pollQ.trim(), options },
                  threadRoot ? { threadRootId: threadRoot.id } : undefined,
                )
                .then(() => {
                  setPollOpen(false);
                  setPollQ('');
                  setPollOpts('Evet\nHayır');
                });
            }}
          >
            Gönder
          </button>
        }
      >
        <label className="flex flex-col gap-1 mb-3">
          <span className="text-sm text-on-surface-variant">Soru</span>
          <input
            value={pollQ}
            onChange={(e) => setPollQ(e.target.value)}
            className="h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-on-surface-variant">Seçenekler (her satır bir seçenek)</span>
          <textarea
            value={pollOpts}
            onChange={(e) => setPollOpts(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-surface-container-highest outline-none"
          />
        </label>
      </Modal>

      <Modal
        open={threadsPreviewOpen}
        title="Son threadler"
        onClose={() => setThreadsPreviewOpen(false)}
      >
        {threadsPreviewBusy && (
          <p className="font-body-sm text-on-surface-variant mb-2">Yükleniyor…</p>
        )}
        {!threadsPreviewBusy && threadsPreview.length === 0 && (
          <DracoEmpty
            mood="confused"
            size={80}
            title="Henüz thread yok"
            description="Bu kanalda henüz thread açılmamış."
          />
        )}
        {threadsPreview.length > 0 && (
          <ul className="flex flex-col gap-1">
            {threadsPreview.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full text-left rounded-lg px-2 py-2 hover:bg-surface-container-highest"
                  onClick={() => {
                    setThreadsPreviewOpen(false);
                    openThread(m);
                  }}
                >
                  <p className="text-sm text-primary-container truncate">
                    {m.author?.displayName}
                    {(m.threadReplyCount ?? 0) > 0
                      ? ` · ${m.threadReplyCount} yanıt`
                      : ''}
                  </p>
                  <p className="text-sm text-on-surface line-clamp-2">
                    {m.content?.trim() || 'Ek / medya'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}
