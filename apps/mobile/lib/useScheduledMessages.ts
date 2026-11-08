import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageAttachment, ScheduledMessageDto } from '@dracord/types';

/** @dracord/sdk DracordClient alt kümesi */
export type ScheduledMessagesClient = {
  createScheduledMessage(
    channelId: string,
    input: { content?: string; sendAt: string; attachments?: MessageAttachment[]; replyToId?: string },
  ): Promise<ScheduledMessageDto>;
  listScheduledMessages(channelId?: string): Promise<ScheduledMessageDto[]>;
  sendScheduledMessageNow(id: string): Promise<ScheduledMessageDto>;
  cancelScheduledMessage(id: string): Promise<{ ok: true }>;
};

export type ScheduledMessagesController = {
  items: ScheduledMessageDto[];
  loading: boolean;
  schedule: (
    text: string,
    sendAt: Date,
    meta?: { replyToId?: string },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  cancel: (id: string) => Promise<void>;
  sendNow: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

function errText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'İşlem başarısız';
}

/**
 * Mobil kopya — kaynak: packages/ui/src/lib/use-scheduled-messages.ts
 * Kanal bazlı zamanlanmış mesajlar. ChatInput'a `scheduler` olarak verilir.
 * Bekleyenler dakikada bir (ve zamanı geçince) yenilenir.
 */
export function useScheduledMessages(
  client: ScheduledMessagesClient | null | undefined,
  channelId: string | null | undefined,
): ScheduledMessagesController {
  const [items, setItems] = useState<ScheduledMessageDto[]>([]);
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!client || !channelId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const list = await client.listScheduledMessages(channelId);
      if (alive.current) setItems(list.filter((m) => m.status === 'pending'));
    } catch {
      /* sessiz: özellik kapalı / ağ */
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [client, channelId]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const t = setInterval(() => void refresh(), 60_000);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [refresh]);

  // En yakın gönderim zamanı geçince listeyi tazele (gönderildi → listeden düşer)
  useEffect(() => {
    if (!items.length) return;
    const next = Math.min(...items.map((m) => new Date(m.sendAt).getTime()));
    const ms = Math.max(5_000, next - Date.now() + 25_000);
    const t = setTimeout(() => void refresh(), Math.min(ms, 2_147_000_000));
    return () => clearTimeout(t);
  }, [items, refresh]);

  const schedule = useCallback<ScheduledMessagesController['schedule']>(
    async (text, sendAt, meta) => {
      if (!client || !channelId) return { ok: false, error: 'Bağlantı yok' };
      try {
        const row = await client.createScheduledMessage(channelId, {
          content: text,
          sendAt: sendAt.toISOString(),
          replyToId: meta?.replyToId,
        });
        setItems((prev) =>
          [...prev, row].sort((a, b) => a.sendAt.localeCompare(b.sendAt)),
        );
        return { ok: true };
      } catch (e) {
        return { ok: false, error: errText(e) };
      }
    },
    [client, channelId],
  );

  const cancel = useCallback(
    async (id: string) => {
      if (!client) return;
      setItems((prev) => prev.filter((m) => m.id !== id));
      try {
        await client.cancelScheduledMessage(id);
      } catch {
        void refresh();
      }
    },
    [client, refresh],
  );

  const sendNow = useCallback(
    async (id: string) => {
      if (!client) return;
      setItems((prev) => prev.filter((m) => m.id !== id));
      try {
        await client.sendScheduledMessageNow(id);
      } catch {
        void refresh();
      }
    },
    [client, refresh],
  );

  return { items, loading, schedule, cancel, sendNow, refresh };
}

/** "Bugün 21:30", "Yarın 09:00", "12 Kas 14:00" */
export function formatScheduleTime(iso: string | Date, now = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const hm = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = Math.round((day - today) / 86_400_000);
  if (diff === 0) return `Bugün ${hm}`;
  if (diff === 1) return `Yarın ${hm}`;
  return `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${hm}`;
}
