import { useEffect, useState } from 'react';
import type { NotificationDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../auth';

export function NotificationsPanel() {
  const { client } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    client
      .listNotifications({ limit: 50 })
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Yüklenemedi'));

  useEffect(() => {
    void reload();
  }, [client]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          height: 48,
          borderBottom: `1px solid ${colors.surfaceHigh}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <strong>Bildirimler</strong>
        <button
          type="button"
          onClick={() => void client.markAllNotificationsRead().then(() => reload())}
          style={{
            border: 'none',
            background: colors.surfaceHigh,
            color: colors.text,
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Tümünü okundu işaretle
        </button>
      </header>
      {error && <p style={{ color: colors.danger, padding: 16 }}>{error}</p>}
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => {
              if (!n.readAt) void client.markNotificationRead(n.id).then(() => reload());
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              border: 'none',
              borderRadius: 10,
              padding: 12,
              marginBottom: 8,
              background: n.readAt ? colors.surface : colors.surfaceHigh,
              color: colors.text,
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700 }}>{n.title}</div>
            <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>{n.body}</div>
            <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
              {new Date(n.createdAt).toLocaleString('tr-TR')} · {n.type}
            </div>
          </button>
        ))}
        {items.length === 0 && !error && (
          <p style={{ color: colors.textMuted, padding: 8 }}>Bildirim yok</p>
        )}
      </div>
    </div>
  );
}
