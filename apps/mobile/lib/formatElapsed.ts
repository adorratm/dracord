import { useEffect, useState } from 'react';

/** Web ChannelSidebar `formatElapsed` — m:ss veya h:mm:ss */
export function formatElapsed(joinedAt: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(joinedAt).getTime()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function useElapsedLabel(joinedAt?: string | null): string {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!joinedAt) {
      setLabel('');
      return;
    }
    const tick = () => setLabel(formatElapsed(joinedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [joinedAt]);
  return label;
}
