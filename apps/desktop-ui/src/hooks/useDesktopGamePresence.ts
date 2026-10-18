import { useEffect, useRef } from 'react';
import type { ClientSettings } from '@dracord/types';
import { useAuth } from '../auth';

/** Opt-in: masaüstü / Steam oyun sürecini tara ve PUT /users/me/activity */
export function useDesktopGamePresence(prefs: ClientSettings | null) {
  const { client, user } = useAuth();
  const lastApp = useRef<string | null>(null);

  useEffect(() => {
    // Varsayılan açık; yalnızca açıkça kapatıldıysa dur
    if (!user || !prefs || prefs.activity.shareDesktopActivity === false) {
      if (lastApp.current) {
        lastApp.current = null;
        void client.clearUserActivity('desktop').catch(() => undefined);
      }
      return;
    }
    const detectGames = window.dracordDesktop?.detectGames;
    if (!detectGames) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await detectGames();
        if (cancelled || !res.ok) return;
        const game = res.games[0];
        if (!game) {
          if (lastApp.current) {
            lastApp.current = null;
            // Sadece desktop — Spotify presence kalsın / poll yenilesin
            await client.clearUserActivity('desktop').catch(() => undefined);
          }
          return;
        }
        const payload = {
          type: 'playing' as const,
          name: game.name,
          source: 'desktop' as const,
          desktopAppId: game.appId,
          imageUrl: game.imageUrl ?? null,
          url: game.url ?? null,
          details: game.details ?? 'Masaüstü',
          expiresInSec: 90,
        };
        if (lastApp.current === game.appId) {
          await client.putUserActivity(payload).catch(() => undefined);
          return;
        }
        lastApp.current = game.appId;
        await client.putUserActivity(payload).catch(() => undefined);
      } catch {
        /* ignore */
      }
    };

    void tick();
    // İlk tarama biraz daha sık; sonra 10 sn
    const id = window.setInterval(() => void tick(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [client, user, prefs, prefs?.activity.shareDesktopActivity]);
}
