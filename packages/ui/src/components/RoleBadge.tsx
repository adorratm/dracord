'use client';

import type { RoleBadgeKey } from '@dracord/types';
import { cn } from '../lib/cn';

const ICONS: Record<Exclude<RoleBadgeKey, 'none'>, string> = {
  crown: 'workspace_premium',
  shield: 'shield_person',
  star: 'star',
  fire: 'local_fire_department',
  sparkle: 'auto_awesome',
  diamond: 'diamond',
  heart: 'favorite',
};

export interface RoleBadgeProps {
  badgeKey?: RoleBadgeKey | string | null;
  color?: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function RoleBadge({
  badgeKey = 'none',
  color = '#5865F2',
  label,
  size = 'sm',
  className,
}: RoleBadgeProps) {
  const key = (badgeKey || 'none') as RoleBadgeKey;
  if (key === 'none') return null;
  const icon = ICONS[key as Exclude<RoleBadgeKey, 'none'>];
  if (!icon) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full font-label-sm font-bold select-none',
        size === 'sm' ? 'h-5 px-1.5 text-[10px]' : 'h-6 px-2 text-[11px]',
        'role-badge',
        `role-badge--${key}`,
        className,
      )}
      style={{ ['--badge-color' as string]: color }}
      title={label}
    >
      <span className="material-symbols-outlined role-badge__icon" style={{ fontSize: size === 'sm' ? 14 : 16 }}>
        {icon}
      </span>
      {label ? <span className="max-w-[72px] truncate">{label}</span> : null}
    </span>
  );
}

/** Global CSS for animated badges — inject once via ProfileDecor styles */
export const ROLE_BADGE_STYLES = `
.role-badge {
  color: #fff;
  background: color-mix(in srgb, var(--badge-color) 85%, #000);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--badge-color) 40%, transparent);
  position: relative;
  overflow: hidden;
}
.role-badge__icon { font-variation-settings: 'FILL' 1; }
.role-badge--crown { animation: badge-glow 2.4s ease-in-out infinite; }
.role-badge--shield { animation: badge-pulse 2s ease-in-out infinite; }
.role-badge--star { animation: badge-twinkle 1.8s ease-in-out infinite; }
.role-badge--fire { animation: badge-flicker 0.9s ease-in-out infinite; }
.role-badge--sparkle::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.45) 50%, transparent 70%);
  animation: badge-shimmer 2.2s linear infinite;
}
.role-badge--diamond { animation: badge-glow 2s ease-in-out infinite; filter: saturate(1.2); }
.role-badge--heart { animation: badge-pulse 1.4s ease-in-out infinite; }
@keyframes badge-glow {
  0%,100% { box-shadow: 0 0 4px var(--badge-color), 0 0 0 1px color-mix(in srgb, var(--badge-color) 50%, transparent); }
  50% { box-shadow: 0 0 12px var(--badge-color), 0 0 0 1px color-mix(in srgb, var(--badge-color) 70%, transparent); }
}
@keyframes badge-pulse {
  0%,100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes badge-twinkle {
  0%,100% { filter: brightness(1); }
  50% { filter: brightness(1.35); }
}
@keyframes badge-flicker {
  0%,100% { filter: brightness(1) hue-rotate(0deg); }
  50% { filter: brightness(1.25) hue-rotate(-8deg); }
}
@keyframes badge-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
.profile-bg {
  background-size: cover;
  background-position: center;
}
.profile-bg--aurora {
  background-image: linear-gradient(135deg, #0f2027 0%, #203a43 40%, #2c5364 70%, #7f7fd5 100%);
  background-size: 200% 200%;
  animation: bg-shift 8s ease infinite;
}
.profile-bg--ember {
  background-image: linear-gradient(145deg, #1a0b0b 0%, #4a1515 45%, #c2410c 100%);
  background-size: 180% 180%;
  animation: bg-shift 7s ease infinite;
}
.profile-bg--ocean {
  background-image: linear-gradient(160deg, #0b1d2a 0%, #0e4d64 50%, #14b8a6 100%);
  background-size: 200% 200%;
  animation: bg-shift 9s ease infinite;
}
.profile-bg--noir {
  background-image: linear-gradient(180deg, #0a0a0a 0%, #1f1f1f 50%, #3f3f46 100%);
}
.profile-bg--candy {
  background-image: linear-gradient(135deg, #4c1d95 0%, #db2777 55%, #f472b6 100%);
  background-size: 200% 200%;
  animation: bg-shift 6s ease infinite;
}
.profile-bg--mint {
  background-image: linear-gradient(140deg, #064e3b 0%, #10b981 55%, #6ee7b7 100%);
  background-size: 180% 180%;
  animation: bg-shift 8s ease infinite;
}
.profile-bg--sunset {
  background-image: linear-gradient(120deg, #7c2d12 0%, #ea580c 40%, #fbbf24 100%);
  background-size: 200% 200%;
  animation: bg-shift 7s ease infinite;
}
@keyframes bg-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .role-badge--crown, .role-badge--shield, .role-badge--star, .role-badge--fire,
  .role-badge--diamond, .role-badge--heart, .role-badge--sparkle::after,
  .profile-bg--aurora, .profile-bg--ember, .profile-bg--ocean, .profile-bg--candy,
  .profile-bg--mint, .profile-bg--sunset { animation: none !important; }
}
`;
