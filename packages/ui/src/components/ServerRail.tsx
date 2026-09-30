'use client';

import type { GuildSummary } from '@dracord/types';
import { cn } from '../lib/cn';
import { Logo } from './Logo';

export interface ServerRailGuild extends Pick<GuildSummary, 'id' | 'name' | 'iconUrl'> {
  initials?: string;
  accentClassName?: string;
}

export interface ServerRailProps {
  guilds: ServerRailGuild[];
  activeGuildId?: string | null;
  homeActive?: boolean;
  onHomeClick?: () => void;
  onGuildClick?: (guildId: string) => void;
  onAddClick?: () => void;
  onExploreClick?: () => void;
  className?: string;
}

/** Discord-benzeri yumuşak köşe + renk geçişi (transition-all kullanma — kasıyor) */
const railBtnEase =
  'transition-[border-radius,background-color,color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.34,1.45,0.64,1)] motion-reduce:transition-none motion-reduce:transform-none';

const pillEase =
  'transition-[transform,opacity,background-color] duration-200 ease-out motion-reduce:transition-none';

function guildInitials(guild: ServerRailGuild): string {
  if (guild.initials) return guild.initials;
  const words = guild.name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return guild.name.slice(0, 2).toUpperCase();
}

function ActivePill({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 rounded-r-full bg-primary origin-center',
        pillEase,
        active ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-[0.35]',
      )}
    />
  );
}

function HoverPill({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 rounded-r-full bg-on-surface origin-center',
        'opacity-0 scale-y-[0.35] group-hover:opacity-100 group-hover:scale-y-100 group-focus-within:opacity-100 group-focus-within:scale-y-100',
        pillEase,
      )}
    />
  );
}

export function ServerRail({
  guilds,
  activeGuildId,
  homeActive = false,
  onHomeClick,
  onGuildClick,
  onAddClick,
  onExploreClick,
  className,
}: ServerRailProps) {
  return (
    <aside
      className={cn(
        'w-[72px] bg-surface-container-lowest flex flex-col items-center pt-space-md pb-32 gap-space-sm shrink-0 relative z-0',
        className,
      )}
      aria-label="Sunucular"
    >
      <div className="relative group flex items-center justify-center w-full">
        <ActivePill active={homeActive} />
        {!homeActive && <HoverPill show />}
        <button
          type="button"
          onClick={onHomeClick}
          className={cn(
            'relative z-[1] w-12 h-12 flex items-center justify-center shadow-md',
            railBtnEase,
            homeActive
              ? 'rounded-[16px] bg-surface-container-high text-on-surface'
              : 'rounded-[50%] bg-surface-container-high text-on-surface hover:rounded-[16px] hover:bg-primary-container hover:text-on-primary-container hover:scale-[1.04] active:scale-[0.98]',
          )}
          aria-label="Ana sayfa / Direkt mesajlar"
        >
          <Logo size={28} showBackground />
        </button>
      </div>

      <div className="w-8 h-[2px] bg-surface-container-highest rounded-full my-space-xs" />

      <div className="flex-1 flex flex-col items-center gap-space-sm w-full overflow-y-auto min-h-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {guilds.map((guild) => {
          const active = guild.id === activeGuildId;
          return (
            <div key={guild.id} className="relative group flex items-center justify-center w-full">
              <ActivePill active={active} />
              {!active && <HoverPill show />}
              <button
                type="button"
                onClick={() => onGuildClick?.(guild.id)}
                title={guild.name}
                className={cn(
                  'relative z-[1] w-12 h-12 flex items-center justify-center font-headline-md text-headline-md overflow-hidden',
                  railBtnEase,
                  active ? 'rounded-[16px]' : 'rounded-[50%] hover:rounded-[16px] hover:scale-[1.04] active:scale-[0.98]',
                  guild.accentClassName ??
                    (active
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-secondary-container text-on-secondary-container hover:bg-primary hover:text-on-primary'),
                )}
              >
                {guild.iconUrl ? (
                  <img
                    src={guild.iconUrl}
                    alt=""
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  guildInitials(guild)
                )}
              </button>
            </div>
          );
        })}

        <div className="w-8 h-[2px] bg-surface-container-highest rounded-full my-space-xs" />

        <button
          type="button"
          onClick={onAddClick}
          className={cn(
            'w-12 h-12 rounded-[50%] hover:rounded-[16px] bg-surface-container text-secondary',
            'hover:bg-secondary-container hover:text-on-secondary-container hover:scale-[1.04] active:scale-[0.98]',
            'flex items-center justify-center',
            railBtnEase,
          )}
          aria-label="Sunucu ekle"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
        <button
          type="button"
          onClick={onExploreClick}
          className={cn(
            'w-12 h-12 rounded-[50%] hover:rounded-[16px] bg-surface-container text-secondary',
            'hover:bg-secondary-container hover:text-on-secondary-container hover:scale-[1.04] active:scale-[0.98]',
            'flex items-center justify-center',
            railBtnEase,
          )}
          aria-label="Keşfet"
        >
          <span className="material-symbols-outlined">explore</span>
        </button>
      </div>
    </aside>
  );
}
