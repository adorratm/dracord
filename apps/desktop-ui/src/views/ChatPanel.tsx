import { useEffect, useRef, useState } from 'react';
import type { ChannelSummary, MessageAttachment, MessageDto, PublicUser } from '@dracord/types';
import { SocketEvents } from '@dracord/types';
import { ChatInput, MessageList } from '@dracord/ui';
import { useAuth } from '../auth';

export function ChatPanel({
  guildId,
  channel,
  members = [],
  showMembersToggle,
}: {
  guildId: string;
  channel: ChannelSummary;
  members?: PublicUser[];
  showMembersToggle?: () => void;
}) {
  const { client, user } = useAuth();
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  const [editing, setEditing] = useState<MessageDto | null>(null);
  const [pins, setPins] = useState<MessageDto[]>([]);
  const [showPins, setShowPins] = useState(false);
  const [threadRoot, setThreadRoot] = useState<MessageDto | null>(null);
  const [threadMsgs, setThreadMsgs] = useState<MessageDto[]>([]);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState('Evet\nHayır');
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    client.joinChannel(channel.id);
    void client.getMessages(channel.id).then((page) => {
      setMessages([...(page.items ?? [])].reverse());
    });
    void client.listPinnedMessages(channel.id).then(setPins).catch(() => setPins([]));
    const sock = client.connectSocket();
    const onMsg = (msg: MessageDto) => {
      if (msg.channelId !== channel.id) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    };
    const onUpdate = (msg: MessageDto) => {
      if (msg.channelId !== channel.id) return;
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };
    const onDelete = (payload: { id: string; channelId: string }) => {
      if (payload.channelId !== channel.id) return;
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
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
  }, [client, channel.id]);

  const sendText = async (content: string, meta?: { replyToId?: string }) => {
    if (editing) {
      await client.updateMessage(editing.id, content);
      setEditing(null);
      return;
    }
    await client.sendMessage(channel.id, content, undefined, undefined, {
      replyToId: meta?.replyToId ?? replyTo?.id,
      threadRootId: threadRoot?.id,
    });
    setReplyTo(null);
    if (threadRoot) {
      const page = await client.getMessageThread(threadRoot.id);
      setThreadMsgs([...(page.items ?? [])].reverse());
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const attachments: MessageAttachment[] = [];
    for (const file of list) {
      attachments.push(await client.uploadFile(file));
    }
    if (attachments.length) {
      await client.sendMessage(
        channel.id,
        '',
        attachments,
        undefined,
        { replyToId: replyTo?.id, threadRootId: threadRoot?.id },
      );
      setReplyTo(null);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="h-12 shrink-0 border-b border-outline-variant flex items-center gap-2 px-4">
          <span className="material-symbols-outlined text-on-surface-variant text-[22px]">tag</span>
          <strong className="font-headline-md text-headline-md truncate">{channel.name}</strong>
          {channel.topic && (
            <span className="text-sm text-on-surface-variant truncate hidden md:inline">
              — {channel.topic}
            </span>
          )}
          <div className="flex-1" />
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

        <div className="flex-1 min-h-0 flex">
          <MessageList
            className="flex-1 min-h-0"
            messages={messages}
            scrollKey={channel.id}
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
              onOpenThread: (m) => {
                setThreadRoot(m);
                void client.getMessageThread(m.id).then((page) => {
                  setThreadMsgs([...(page.items ?? [])].reverse());
                });
              },
              onVotePoll: (m, optionId) => void client.votePoll(m.id, optionId),
              onAuthorClick: (author) => {
                void client.openDm(author.id);
              },
            }}
            emptyState={
              <div className="p-8 text-on-surface-variant text-center">
                #{channel.name} kanalına hoş geldin. İlk mesajı sen yaz.
              </div>
            }
          />

          {threadRoot && (
            <aside className="w-80 shrink-0 border-l border-outline-variant flex flex-col min-h-0 bg-surface-container-low">
              <div className="h-10 px-3 flex items-center justify-between border-b border-outline-variant text-sm font-semibold">
                Thread · {threadRoot.author?.displayName}
                <button
                  type="button"
                  className="text-on-surface-variant"
                  onClick={() => {
                    setThreadRoot(null);
                    setThreadMsgs([]);
                  }}
                >
                  ✕
                </button>
              </div>
              <MessageList
                className="flex-1 min-h-0"
                messages={[threadRoot, ...threadMsgs]}
                scrollKey={`thread-${threadRoot.id}`}
                messageActions={{
                  currentUserId: user?.id,
                  onReact: (m, emoji) => void client.toggleReaction(m.id, emoji),
                  onVotePoll: (m, optionId) => void client.votePoll(m.id, optionId),
                }}
              />
            </aside>
          )}
        </div>

        {pollOpen && (
          <div className="p-3 border-t border-outline-variant bg-surface-container-low space-y-2">
            <input
              value={pollQ}
              onChange={(e) => setPollQ(e.target.value)}
              placeholder="Anket sorusu"
              className="w-full h-9 px-3 rounded-lg bg-surface-container-highest outline-none"
            />
            <textarea
              value={pollOpts}
              onChange={(e) => setPollOpts(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-highest outline-none"
              placeholder="Seçenekler (satır satır)"
            />
            <button
              type="button"
              className="h-9 px-4 rounded-lg bg-primary-container text-on-primary-container font-bold"
              onClick={() => {
                const options = pollOpts
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean);
                if (!pollQ.trim() || options.length < 2) return;
                void client
                  .sendMessage(channel.id, pollQ.trim(), undefined, {
                    question: pollQ.trim(),
                    options,
                  })
                  .then(() => {
                    setPollOpen(false);
                    setPollQ('');
                    setPollOpts('Evet\nHayır');
                  });
              }}
            >
              Anket gönder
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*,.pdf"
          multiple
          hidden
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = '';
            if (files?.length) void uploadFiles(files);
          }}
        />

        <div className="shrink-0 border-t border-outline-variant">
          <ChatInput
            channelName={channel.name}
            placeholder={
              editing
                ? 'Mesajı düzenle…'
                : `Message #${channel.name}`
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
            mentionUsers={members.map((m) => ({
              id: m.id,
              username: m.username,
              displayName: m.displayName,
              avatarUrl: m.avatarUrl,
            }))}
            mentionChannels={[{ id: channel.id, name: channel.name, type: channel.type }]}
            searchGifs={(q) =>
              client.searchGifs(q).then((list) =>
                list.map((g) => ({
                  id: g.id,
                  url: g.url,
                  previewUrl: g.previewUrl ?? g.url,
                  label: g.label ?? g.id,
                })),
              )
            }
            loadFeaturedGifs={() =>
              client.featuredGifs().then((list) =>
                list.map((g) => ({
                  id: g.id,
                  url: g.url,
                  previewUrl: g.previewUrl ?? g.url,
                  label: g.label ?? g.id,
                })),
              )
            }
            onTyping={() => {
              client.startTyping(channel.id);
              if (typingTimer.current) clearTimeout(typingTimer.current);
              typingTimer.current = setTimeout(() => undefined, 2000);
            }}
            onAttachClick={() => fileRef.current?.click()}
            onAttachFiles={(files) => void uploadFiles(files)}
            onPollClick={() => setPollOpen((v) => !v)}
            onSend={(text, meta) => {
              if (editing) {
                void sendText(text);
                return;
              }
              void sendText(text, meta);
            }}
            onSendMedia={(payload) => {
              if (payload.type === 'gif' || payload.type === 'sticker-image') {
                void client.sendMessage(channel.id, payload.url);
              } else if (payload.type === 'sticker') {
                void client.sendMessage(channel.id, payload.emoji);
              }
            }}
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
      </div>
    </div>
  );
}
