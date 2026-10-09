'use client';

import { useMemo } from 'react';
import type { ImageModerationProps } from '@dracord/ui';
import { classifyImageElement } from '@/lib/nsfw-screen-guard';
import { useUserPreferences } from '@/lib/user-preferences';

/** Mesaj/DM görüntü ekleri için NSFW tarama (filterExplicit açıkken). */
export function useImageModeration(): ImageModerationProps | null {
  const { prefs } = useUserPreferences();
  const enabled = prefs.messaging.filterExplicit !== false;
  return useMemo(() => {
    if (!enabled) return null;
    return {
      enabled: true,
      classify: async (img) => {
        try {
          const verdict = await classifyImageElement(img);
          // Fail-closed: model/tarama başarısızsa engelle
          if (!verdict) return true;
          return verdict.blocked;
        } catch {
          return true;
        }
      },
    };
  }, [enabled]);
}
