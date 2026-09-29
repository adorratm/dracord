'use client';

import type { MessageDto } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { dataUrlToFile, type ChatMediaPayload } from '@dracord/ui';
import type { MessageAttachment } from '@dracord/types';

function mediaId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type ChannelCache = {
  items: MessageDto[];
  hasMore: boolean;
};

const messageCache = new Map<string, ChannelCache>();
const MAX_CACHED_CHANNELS = 20;

function remember(channelId: string, data: ChannelCache) {
  messageCache.set(channelId, data);
  if (messageCache.size > MAX_CACHED_CHANNELS) {
    const oldest = messageCache.keys().next().value;
    if (oldest) messageCache.delete(oldest);
  }
}

export function useChatChannel(channelId: string | undefined, aroundMessageId?: string | null) {
  const { client, user } = useAuth();
  const cached = channelId ? messageCache.get(channelId) : undefined;
  const [messages, setMessages] = useState<MessageDto[]>(cached?.items ?? []);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [loading, setLoading] = useState(() => Boolean(channelId && user && !cached));
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atLiveEdge, setAtLiveEdge] = useState(true);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const channelRef = useRef(channelId);
  const atLiveRef = useRef(true);
  channelRef.current = channelId;
  atLiveRef.current = atLiveEdge;

  const applyPage = useCallback((channel: string, items: MessageDto[], more: boolean) => {
    const seen = new Set<string>();
    const unique = items.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    setMessages(unique);
    setHasMore(more);
    remember(channel, { items: unique, hasMore: more });
  }, []);

  useEffect(() => {
    if (!channelId || !user) {
      setMessages([]);
      setHasMore(false);
      setLoading(false);
      setPendingNewCount(0);
      return;
    }

    let cancelled = false;
    const hit = aroundMessageId ? undefined : messageCache.get(channelId);
    if (hit && !aroundMessageId) {
      setMessages(hit.items);
      setHasMore(hit.hasMore);
      setLoading(false);
    } else {
      setMessages([]);
      setLoading(true);
    }
    setError(null);
    setAtLiveEdge(!aroundMessageId);
    setPendingNewCount(0);

    client.connectSocket();
    client.joinChannel(channelId);

    void client
      .getMessages(channelId, {
        limit: 50,
        around: aroundMessageId || undefined,
      })
      .then((page) => {
        if (cancelled || channelRef.current !== channelId) return;
        applyPage(channelId, page.items, page.hasMore);
        setAtLiveEdge(!aroundMessageId);
      })
      .catch((err: Error) => {
        if (cancelled || channelRef.current !== channelId) return;
        setError(err.message || 'Mesajlar yüklenemedi');
      })
      .finally(() => {
        if (!cancelled && channelRef.current === channelId) setLoading(false);
      });

    const socket = client.socket;
    const onCreate = (message: MessageDto) => {
      if (message.channelId !== channelId) return;
      if (!atLiveRef.current) {
        setPendingNewCount((n) => n + 1);
        return;
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        const next = [...prev, message];
        remember(channelId, {
          items: next,
          hasMore: messageCache.get(channelId)?.hasMore ?? false,
        });
        return next;
      });
    };

    socket?.on(SocketEvents.MESSAGE_CREATE, onCreate);
    const onUpdate = (message: MessageDto) => {
      if (message.channelId !== channelId) return;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === message.id ? message : m));
        remember(channelId, {
          items: next,
          hasMore: messageCache.get(channelId)?.hasMore ?? false,
        });
        return next;
      });
    };
    const onDelete = (payload: { id: string; channelId: string }) => {
      if (payload.channelId !== channelId) return;
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== payload.id);
        remember(channelId, {
          items: next,
          hasMore: messageCache.get(channelId)?.hasMore ?? false,
        });
        return next;
      });
    };
    socket?.on(SocketEvents.MESSAGE_UPDATE, onUpdate);
    socket?.on(SocketEvents.MESSAGE_DELETE, onDelete);

    return () => {
      cancelled = true;
      client.leaveChannel(channelId);
      socket?.off(SocketEvents.MESSAGE_CREATE, onCreate);
      socket?.off(SocketEvents.MESSAGE_UPDATE, onUpdate);
      socket?.off(SocketEvents.MESSAGE_DELETE, onDelete);
    };
  }, [channelId, client, user, aroundMessageId, applyPage]);

  const loadOlder = useCallback(async () => {
    if (!channelId || loadingOlder || !hasMore || messages.length === 0) return;
    setLoadingOlder(true);
    const before = messages[0]?.id;
    try {
      const page = await client.getMessages(channelId, { limit: 50, before });
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const merged = [...page.items.filter((m) => !ids.has(m.id)), ...prev];
        remember(channelId, { items: merged, hasMore: page.hasMore });
        return merged;
      });
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eski mesajlar yüklenemedi');
    } finally {
      setLoadingOlder(false);
    }
  }, [channelId, client, hasMore, loadingOlder, messages]);

  const jumpToPresent = useCallback(async () => {
    if (!channelId) return;
    setLoading(true);
    setPendingNewCount(0);
    try {
      const page = await client.getMessages(channelId, { limit: 50 });
      applyPage(channelId, page.items, page.hasMore);
      setAtLiveEdge(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Güncel mesajlar alınamadı');
    } finally {
      setLoading(false);
    }
  }, [channelId, client, applyPage]);

  const sendMessage = useCallback(
    async (
      content: string,
      attachments?: MessageAttachment[],
      opts?: { replyToId?: string; type?: 'default' | 'heading' },
    ) => {
      if (!channelId) return;
      const message = await client.sendMessage(
        channelId,
        content,
        attachments,
        undefined,
        opts,
      );
      setAtLiveEdge(true);
      setPendingNewCount(0);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        const next = [...prev, message];
        remember(channelId, { items: next, hasMore });
        return next;
      });
      void client.markChannelRead(channelId).catch(() => undefined);
    },
    [channelId, client, hasMore],
  );

  const sendWithAttachments = useCallback(
    async (files: FileList | File[]) => {
      if (!channelId) return;
      try {
        const list = Array.from(files as ArrayLike<File>);
        if (list.length === 0) return;
        const uploaded: MessageAttachment[] = [];
        for (const file of list) {
          uploaded.push(await client.uploadFile(file, 'attachments'));
        }
        const content =
          uploaded.length === 1 ? '' : uploaded.map((a) => a.filename).join(', ');
        await sendMessage(content || uploaded[0]!.filename, uploaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Dosya yüklenemedi');
      }
    },
    [channelId, client, sendMessage],
  );

  const sendMedia = useCallback(
    async (payload: ChatMediaPayload) => {
      if (!channelId) return;
      try {
        if (payload.type === 'sticker') {
          await sendMessage(`sticker:${payload.emoji}`);
          return;
        }
        if (payload.type === 'sticker-image') {
          if (payload.url.startsWith('data:')) {
            const file = await dataUrlToFile(payload.url, payload.label || 'sticker');
            const uploaded = await client.uploadFile(file, 'attachments');
            await sendMessage('', [uploaded]);
            return;
          }
          const attachment: MessageAttachment = {
            id: mediaId(),
            url: payload.url,
            filename: `${payload.label || 'sticker'}.gif`,
            contentType: payload.contentType || 'image/gif',
            size: 0,
          };
          await sendMessage('', [attachment]);
          return;
        }
        const attachment: MessageAttachment = {
          id: mediaId(),
          url: payload.url,
          filename: `${payload.label || 'gif'}.gif`,
          contentType: 'image/gif',
          size: 0,
        };
        await sendMessage(payload.label || 'GIF', [attachment]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Medya gönderilemedi');
      }
    },
    [channelId, client, sendMessage],
  );

  const patchMessage = useCallback(
    (message: MessageDto) => {
      if (!channelId) return;
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === message.id ? message : m));
        remember(channelId, { items: next, hasMore });
        return next;
      });
    },
    [channelId, hasMore],
  );

  const removeMessageLocal = useCallback(
    (messageId: string) => {
      if (!channelId) return;
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== messageId);
        remember(channelId, { items: next, hasMore });
        return next;
      });
    },
    [channelId, hasMore],
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const message = await client.updateMessage(messageId, content);
      patchMessage(message);
      return message;
    },
    [client, patchMessage],
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const res = await client.deleteMessage(messageId);
      removeMessageLocal(res.id);
      return res;
    },
    [client, removeMessageLocal],
  );

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      const message = await client.toggleReaction(messageId, emoji);
      patchMessage(message);
      return message;
    },
    [client, patchMessage],
  );

  const votePoll = useCallback(
    async (messageId: string, optionId: string) => {
      const message = await client.votePoll(messageId, optionId);
      patchMessage(message);
      return message;
    },
    [client, patchMessage],
  );

  const hideMessage = useCallback(
    async (messageId: string, permanent: boolean) => {
      await client.hideMessage(messageId, permanent);
      if (permanent) removeMessageLocal(messageId);
      else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, viewerHide: 'hidden', content: '', attachments: undefined, embeds: undefined, poll: null, reactions: [] }
              : m,
          ),
        );
      }
    },
    [client, removeMessageLocal],
  );

  const unhideMessage = useCallback(
    async (messageId: string) => {
      await client.unhideMessage(messageId);
      if (!channelId) return;
      const page = await client.getMessages(channelId, { limit: 50, around: messageId });
      applyPage(channelId, page.items, page.hasMore);
    },
    [client, channelId, applyPage],
  );

  const sendPoll = useCallback(
    async (question: string, options: string[], multi = false) => {
      if (!channelId) return;
      const message = await client.sendMessage(channelId, question, undefined, {
        question,
        options,
        multi,
      });
      setAtLiveEdge(true);
      setPendingNewCount(0);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        const next = [...prev, message];
        remember(channelId, { items: next, hasMore });
        return next;
      });
    },
    [channelId, client, hasMore],
  );

  const pinMessage = useCallback(
    async (messageId: string, pin: boolean) => {
      if (!channelId) return;
      const message = pin
        ? await client.pinMessage(messageId)
        : await client.unpinMessage(messageId);
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === message.id ? message : m));
        remember(channelId, { items: next, hasMore });
        return next;
      });
    },
    [channelId, client, hasMore],
  );

  const upsertMessage = useCallback(
    (message: MessageDto) => {
      if (!channelId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          const next = prev.map((m) => (m.id === message.id ? message : m));
          remember(channelId, { items: next, hasMore });
          return next;
        }
        const next = [...prev, message];
        remember(channelId, { items: next, hasMore });
        return next;
      });
    },
    [channelId, hasMore],
  );

  return {
    messages,
    loading,
    loadingOlder,
    hasMore,
    error,
    atLiveEdge,
    pendingNewCount,
    setAtLiveEdge,
    loadOlder,
    jumpToPresent,
    sendMessage,
    sendWithAttachments,
    sendMedia,
    sendPoll,
    editMessage,
    deleteMessage,
    reactToMessage,
    votePoll,
    hideMessage,
    unhideMessage,
    pinMessage,
    upsertMessage,
  };
}
