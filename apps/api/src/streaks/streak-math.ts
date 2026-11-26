/** Seri hesapları — saf fonksiyonlar (test edilebilir) */

/** Türkiye UTC+3 (2016'dan beri yaz saati yok) */
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365] as const;

export function dayKey(at: Date = new Date()): string {
  return new Date(at.getTime() + TR_OFFSET_MS).toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}

export type StreakState = { current: number; best: number; lastDay: string | null; freezes: number; freezesUsed: number };

/** Bugün aktif olundu → yeni durum (aynı gün tekrarı değiştirmez) */
export function advance(s: StreakState, today: string): StreakState & { milestone: number | null } {
  if (s.lastDay === today) return { ...s, milestone: null };
  let { current, freezes, freezesUsed } = s;
  const gap = s.lastDay ? daysBetween(s.lastDay, today) : Infinity;
  if (gap < 0) return { ...s, milestone: null }; // saat geri gitti — dokunma
  if (gap === 1) current += 1;
  else if (Number.isFinite(gap) && gap - 1 <= freezes) {
    freezes -= gap - 1;
    freezesUsed += gap - 1;
    current += 1;
  } else current = 1;
  if (current % FREEZE_EVERY === 0 && freezes < MAX_FREEZES) freezes += 1;
  const milestone = (STREAK_MILESTONES as readonly number[]).includes(current) ? current : null;
  return { current, best: Math.max(s.best, current), lastDay: today, freezes, freezesUsed, milestone };
}

/** Görüntülenecek seri: kaçırılmış ve dondurucuyla kurtarılamayan seri 0 görünür */
export function liveCurrent(s: StreakState, today: string): number {
  if (!s.lastDay) return 0;
  const gap = daysBetween(s.lastDay, today);
  if (gap <= 1) return s.current;
  return gap - 1 <= s.freezes ? s.current : 0;
}

export function nextMilestone(current: number): number | null {
  return STREAK_MILESTONES.find((m) => m > current) ?? null;
}

/** Profil rozeti: ulaşılan en yüksek eşik */
export function streakTier(best: number): number | null {
  let t: number | null = null;
  for (const m of STREAK_MILESTONES) if (best >= m) t = m;
  return t;
}
