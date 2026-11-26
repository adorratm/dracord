'use client';

import { useEffect, useState } from 'react';
import { YearRecap, recapSeasonYear } from '@dracord/ui';
import { useAuth } from '@/components/AuthProvider';

const DISMISS = 'dracord:recap-dismissed';

/** Aralık–15 Ocak: "Yıl özetin hazır" şeridi; Ayarlar › Yıl Özeti her zaman açar. */
export function YearRecapBar() {
  const { user, client } = useAuth();
  const [year, setYear] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const y = recapSeasonYear();
    if (!y) return;
    try {
      if (localStorage.getItem(DISMISS) === String(y)) return;
    } catch {
      /* yok say */
    }
    setYear(y);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const y = Number((e as CustomEvent<number>).detail);
      if (y) setYear(y);
      setOpen(true);
    };
    window.addEventListener('dracord:open-recap', onOpen);
    return () => window.removeEventListener('dracord:open-recap', onOpen);
  }, []);

  if (!user) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS, String(year));
    } catch {
      /* yok say */
    }
    setYear(null);
  };
  return (
    <>
      {year && !open && (
        <div className="flex items-center justify-center gap-3 bg-gradient-to-r from-[#4a1d7a] to-[#d9467a] px-4 py-2 text-sm text-white">
          <span>✨ Dracord {year} yıl özetin hazır!</span>
          <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-white px-3 py-1 font-semibold text-black">
            Göster
          </button>
          <button type="button" onClick={dismiss} aria-label="Kapat" className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>
      )}
      {open && <YearRecap client={client} name={user.displayName || user.username} year={year ?? undefined} onClose={() => setOpen(false)} />}
    </>
  );
}
