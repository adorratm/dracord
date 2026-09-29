'use client';

import type { MessageAttachment, MessageDto } from '@dracord/types';
import { SocketEvents } from '@dracord/sdk';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { dataUrlToFile, type ChatMediaPayload } from '@dracord/ui';

function mediaId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChatChannel(channelId: string | undefined) {
  const { client, user } = useAuth();
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!channelId || !user) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    client.connectSocket();
    client.joinChannel(channelId);

    void client
      .getMessages(channelId)
      .then((list) => {
        if (!cancelled) setMessages(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Mesajlar yüklenemedi');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const socket = client.socket;
    const onCreate = (message: MessageDto) => {
      if (message.channelId !== channelId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    };

    socket?.on(SocketEvents.MESSAGE_CREATE, onCreate);

    return () => {
      cancelled = true;
      client.leaveChannel(channelId);
      socket?.off(SocketEvents.MESSAGE_CREATE, onCreate);
    };
  }, [channelId, client, user]);

  const sendMessage = useCallback(
    async (content: string, attachments?: MessageAttachment[]) => {
      if (!channelId) return;
      const message = await client.sendMessage(channelId, content, attachments);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    },
    [channelId, client],
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

  return { messages, loading, error, sendMessage, sendWithAttachments, sendMedia };
}
