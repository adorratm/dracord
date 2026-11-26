'use client';

import { useEffect, useState } from 'react';
import type { UserStreakDto } from '@dracord/types';
import { STREAK_TIERS, streakTierIcon } from '../lib/streak';

export interface StreakCardProps {
  client: { getMyStreak(): Promise<UserStreakDto> };
}

/** Günlük seri kartı: mevcut/en iyi seri, dondurucular, bir sonraki rozet */
export function StreakCard({ client }: StreakCardProps) {
  const [s, setS] = useState<UserStreakDto | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    client
      .getMyStreak()
      .then((v) => alive && setS(v))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [client]);

  if (err) return <p className="font-body-sm text-on-surface-variant">Seri bilgisi alınamadı.</p>;
  if (!s) return <div className="h-28 animate-pulse rounded-xl bg-surface-container-high" />;

  const goal = s.nextMilestone;
  const prev = [...STREAK_TIERS].reverse().find((t) => t <= s.current) ?? 0;
  const pct = goal ? Math.round(((s.current - prev) / (goal - prev)) * 100) : 100;

  return (
    <div className="rounded-xl bg-surface-container-high p-space-md">
      <div className="flex items-center gap-space-md">
        <div className="text-5xl leading-none" aria-hidden>
          {s.current > 0 ? '🔥' : '🌑'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-headline-md text-on-surface">
            {s.current} günlük seri
          </p>
          <p className="font-body-sm text-on-surface-variant">
            {s.activeToday
              ? 'Bugünü kaptın ✓ Yarın görüşürüz.'
              : s.current > 0
                ? 'Bugün bir mesaj at ya da 5 dk seste kal, seri bozulmasın.'
                : 'Her gün bir mesaj ya da 5 dk ses ile yeni bir seri başlat.'}
          </p>
        </div>
      </div>
      {goal ? (
        <div className="mt-space-md">
          <div className="mb-1 flex justify-between font-label-sm text-on-surface-variant">
            <span>Sıradaki rozet: {streakTierIcon(goal)} {goal} gün</span>
            <span>{goal - s.current} gün kaldı</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-container-highest">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        </div>
      ) : null}
      <div className="mt-space-md flex flex-wrap gap-space-md font-body-sm text-on-surface">
        <span title="En uzun seri">🏅 En iyi: {s.best} gün</span>
        <span title="Her 7 günde bir kazanılır; kaçırdığın bir günü otomatik kurtarır">
          🧊 Dondurucu: {s.freezes}/{s.maxFreezes}
        </span>
        {s.tier ? (
          <span>
            {streakTierIcon(s.tier)} {s.tier}+ gün rozeti profilinde
          </span>
        ) : null}
      </div>
    </div>
  );
}
