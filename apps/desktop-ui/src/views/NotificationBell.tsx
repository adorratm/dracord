import { useEffect, useRef, useState } from 'react';
import type { NotificationDto } from '@dracord/types';
import { useAuth } from '../auth';

export function NotificationBell({ onOpenAll }: { onOpenAll?: () => void }) {
  const { client } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const reload = () => {
    void client.notificationsUnreadCount().then((r) => setCount(r.count)).catch(() => undefined);
    if (open) {
      void client.listNotifications({ limit: 12 }).then(setItems).catch(() => undefined);
    }
  };

  useEffect(() => {
    reload();
    const t = window.setInterval(reload, 60_000);
    return () => window.clearInterval(t);
  }, [client, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="relative h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        aria-label="Bildirimler"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-auto rounded-xl bg-surface-container-high border border-outline-variant shadow-lg z-[80]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant">
            <span className="font-label-md text-label-md text-on-surface">Bildirimler</span>
            <button
              type="button"
              className="text-xs text-primary-container hover:underline"
              onClick={() => void client.markAllNotificationsRead().then(reload)}
            >
              Tümünü okundu
            </button>
          </div>
          {items.length === 0 && (
            <p className="p-4 text-sm text-on-surface-variant">Bildirim yok</p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`block w-full text-left px-3 py-2.5 hover:bg-surface-container border-b border-outline-variant/40 ${
                n.readAt ? 'opacity-70' : ''
              }`}
              onClick={() => {
                if (!n.readAt) void client.markNotificationRead(n.id).then(reload);
              }}
            >
              <div className="font-medium text-sm text-on-surface">{n.title}</div>
              <div className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{n.body}</div>
            </button>
          ))}
          {onOpenAll && (
            <button
              type="button"
              className="w-full py-2.5 text-sm text-primary-container font-semibold hover:bg-surface-container"
              onClick={() => {
                setOpen(false);
                onOpenAll();
              }}
            >
              Tümünü gör
            </button>
          )}
        </div>
      )}
    </div>
  );
}
