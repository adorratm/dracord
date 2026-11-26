/** Seri eşiği → rozet simgesi (web, desktop ve mobil ortak) */
export function streakTierIcon(tier: number | null | undefined): string {
  if (!tier) return '';
  if (tier >= 365) return '👑';
  if (tier >= 100) return '💎';
  if (tier >= 30) return '🏆';
  if (tier >= 14) return '⭐';
  if (tier >= 7) return '🔥';
  return '✨';
}

export const STREAK_TIERS = [3, 7, 14, 30, 50, 100, 200, 365] as const;
