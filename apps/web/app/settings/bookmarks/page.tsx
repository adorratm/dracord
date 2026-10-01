'use client';

import type { MessageBookmarkDto } from '@dracord/types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  SettingsPage,
  SettingsSection,
  SettingsNote,
} from '@/components/settings/SettingsControls';

export default function BookmarksSettingsPage() {
  const { client } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<MessageBookmarkDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await client.listBookmarks(50);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yer imleri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const remove = useCallback(
    async (messageId: string) => {
      try {
        await client.unbookmarkMessage(messageId);
        setItems((prev) => prev.filter((b) => b.messageId !== messageId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kaldırılamadı');
      }
    },
    [client],
  );

  return (
    <SettingsPage
      title="Yer İmleri"
      description="Kaydettiğin mesajlara buradan hızlıca dön."
    >
      <SettingsSection title="Kayıtlı mesajlar">
        {loading && <p className="font-body-sm text-outline">Yükleniyor…</p>}
        {error && <SettingsNote>{error}</SettingsNote>}
        {!loading && items.length === 0 && (
          <p className="font-body-sm text-outline">
            Henüz yer imin yok. Mesaj menüsünden “Yer imine ekle” ile kaydedebilirsin.
          </p>
        )}
        <div className="space-y-space-sm">
          {items.map((b) => {
            const preview = (b.message.content || '').trim().slice(0, 140) || '(medya / boş)';
            const href = b.guildId
              ? `/channels/${b.guildId}/${b.channelId}?around=${b.messageId}`
              : `/channels/me/${b.channelId}?around=${b.messageId}`;
            return (
              <div
                key={b.id}
                className="rounded-xl bg-surface-container-highest px-space-md py-space-sm flex gap-space-sm items-start"
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => router.push(href)}
                >
                  <p className="font-label-sm text-on-surface-variant truncate">
                    {b.channelName ? `#${b.channelName}` : 'Kanal'} ·{' '}
                    {b.message.author.displayName}
                  </p>
                  <p className="font-body-sm text-on-surface line-clamp-2 mt-0.5">{preview}</p>
                </button>
                <button
                  type="button"
                  className="material-symbols-outlined text-[18px] text-outline hover:text-error shrink-0"
                  aria-label="Yer imini kaldır"
                  onClick={() => void remove(b.messageId)}
                >
                  bookmark_remove
                </button>
              </div>
            );
          })}
        </div>
      </SettingsSection>
    </SettingsPage>
  );
}
