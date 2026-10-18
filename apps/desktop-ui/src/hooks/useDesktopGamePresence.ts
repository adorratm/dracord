import { useEffect, useRef } from 'react';
import type { ClientSettings } from '@dracord/types';
import { useAuth } from '../auth';

/** Opt-in: masaüstü oyun sürecini tara ve PUT /users/me/activity */
export function useDesktopGamePresence(prefs: ClientSettings | null) {
  const { client, user } = useAuth();
  const lastApp = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !prefs?.activity.shareDesktopActivity) {
      lastApp.current = null;
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
            await client.clearUserActivity().catch(() => undefined);
          }
          return;
        }
        if (lastApp.current === game.appId) {
          // TTL yenile
          await client
            .putUserActivity({
              type: 'playing',
              name: game.name,
              source: 'desktop',
              desktopAppId: game.appId,
              expiresInSec: 90,
            })
            .catch(() => undefined);
          return;
        }
        lastApp.current = game.appId;
        await client
          .putUserActivity({
            type: 'playing',
            name: game.name,
            source: 'desktop',
            desktopAppId: game.appId,
            details: 'Dracord masaüstü',
            expiresInSec: 90,
          })
          .catch(() => undefined);
      } catch {
        /* ignore */
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [client, user, prefs?.activity.shareDesktopActivity]);
}
