/**
 * Kanal görünümü soft-cache — unmount yerine gizleyerek geçiş flaşını azaltır.
 * En fazla MAX giriş; LRU benzeri dokunuş sırası.
 */

const MAX = 6;
const order: string[] = [];
const alive = new Set<string>();

export function touchChannelCache(channelId: string) {
  const i = order.indexOf(channelId);
  if (i >= 0) order.splice(i, 1);
  order.push(channelId);
  alive.add(channelId);
  while (order.length > MAX) {
    const drop = order.shift();
    if (drop) alive.delete(drop);
  }
}

export function shouldKeepChannelMounted(channelId: string, activeId: string | undefined) {
  if (!channelId) return false;
  if (channelId === activeId) {
    touchChannelCache(channelId);
    return true;
  }
  return alive.has(channelId);
}

export function markChannelVisited(channelId: string) {
  touchChannelCache(channelId);
}
