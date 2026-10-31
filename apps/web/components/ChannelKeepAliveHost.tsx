'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GuildChannelView } from '@/components/GuildChannelView';
import { RequireAuth } from '@/components/RequireAuth';
import { markChannelVisited, shouldKeepChannelMounted } from '@/lib/channel-view-cache';

const MAX_KEEP = 5;

/**
 * Aynı sunucu içinde kanal geçişlerinde GuildChannelView’ı unmount etmeden
 * gizler — mesaj listesi / scroll state korunur.
 */
export function ChannelKeepAliveHost() {
  const params = useParams<{ guildId: string; channelId: string }>();
  const searchParams = useSearchParams();
  const guildId = params.guildId;
  const channelId = params.channelId;
  const aroundMessageId =
    searchParams.get('messageId') ?? searchParams.get('around') ?? null;
  const openThreadId = searchParams.get('thread') ?? null;

  const [mounted, setMounted] = useState<string[]>(() =>
    channelId ? [channelId] : [],
  );
  const orderRef = useRef<string[]>(channelId ? [channelId] : []);

  useEffect(() => {
    if (!channelId) return;
    markChannelVisited(channelId);
    const order = orderRef.current;
    const i = order.indexOf(channelId);
    if (i >= 0) order.splice(i, 1);
    order.push(channelId);
    while (order.length > MAX_KEEP) order.shift();
    orderRef.current = [...order];
    setMounted(() => {
      const keep = new Set(order);
      for (const id of order) {
        if (!shouldKeepChannelMounted(id, channelId) && id !== channelId) {
          keep.delete(id);
        }
      }
      keep.add(channelId);
      return order.filter((id) => keep.has(id));
    });
  }, [channelId]);

  if (!guildId || !channelId) return null;

  return (
    <RequireAuth>
      <>
        {mounted.map((id) => {
          const active = id === channelId;
          return (
            <div
              key={id}
              className={
                active
                  ? 'dracord-route-fade flex min-h-0 min-w-0 flex-1 flex-col'
                  : 'hidden'
              }
              aria-hidden={!active}
            >
              <GuildChannelView
                guildId={guildId}
                channelId={id}
                aroundMessageId={active ? aroundMessageId : null}
                openThreadId={active ? openThreadId : null}
              />
            </div>
          );
        })}
      </>
    </RequireAuth>
  );
}
