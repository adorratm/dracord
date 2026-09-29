const TOUR_KEY = 'dracord:app-tour-v1';

export function hasCompletedAppTour(userId?: string | null): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(TOUR_KEY);
    if (!raw) return false;
    if (raw === 'done') return true;
    const parsed = JSON.parse(raw) as { done?: boolean; userId?: string };
    if (!parsed.done) return false;
    if (userId && parsed.userId && parsed.userId !== userId) return false;
    return true;
  } catch {
    return false;
  }
}

export function markAppTourCompleted(userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      TOUR_KEY,
      JSON.stringify({ done: true, userId: userId ?? null, at: Date.now() }),
    );
  } catch {
    // ignore
  }
}

export function resetAppTour(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOUR_KEY);
  } catch {
    // ignore
  }
}
