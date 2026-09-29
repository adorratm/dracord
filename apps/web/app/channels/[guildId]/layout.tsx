import type { ReactNode } from 'react';

/**
 * guildId layout'u kanal (channelId) geçişlerinde mount'ta kalır;
 * yalnızca page segment'i yenilenir — shell flaşını azaltır.
 */
export default function GuildIdLayout({ children }: { children: ReactNode }) {
  return children;
}
