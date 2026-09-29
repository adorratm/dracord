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

function guildInitials(guild: ServerRailGuild): string {
  if (guild.initials) return guild.initials;
  const words = guild.name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return guild.name.slice(0, 2).toUpperCase();
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
        'w-[72px] bg-surface-container-lowest flex flex-col items-center py-space-md gap-space-sm shrink-0',
        className,
      )}
      aria-label="Sunucular"
    >
      <div className="relative group flex items-center justify-center w-full">
        {homeActive && (
          <div className="absolute left-0 w-1 h-10 bg-primary rounded-r-full transition-all duration-200" />
        )}
        <button
          type="button"
          onClick={onHomeClick}
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-md',
            'group-hover:rounded-xl',
            homeActive
              ? 'bg-surface-container-high text-on-surface'
              : 'bg-surface-container-high hover:bg-primary-container text-on-surface hover:text-on-primary-container',
          )}
          aria-label="Ana sayfa / Direkt mesajlar"
        >
          <Logo size={28} showBackground />
        </button>
      </div>

      <div className="w-8 h-[2px] bg-surface-container-highest rounded-full my-space-xs" />

      <div className="flex-1 flex flex-col items-center gap-space-sm w-full overflow-y-auto min-h-0">
        {guilds.map((guild) => {
          const active = guild.id === activeGuildId;
          return (
            <div key={guild.id} className="relative group flex items-center justify-center w-full">
              {active && (
                <div className="absolute left-0 w-1 h-8 bg-primary rounded-r-full transition-all duration-200" />
              )}
              {!active && (
                <div className="absolute left-0 w-1 h-5 bg-on-surface rounded-r-full opacity-0 group-hover:opacity-100 group-hover:h-8 transition-all" />
              )}
              <button
                type="button"
                onClick={() => onGuildClick?.(guild.id)}
                title={guild.name}
                className={cn(
                  'w-12 h-12 rounded-full hover:rounded-xl flex items-center justify-center font-headline-md text-headline-md transition-all duration-200 overflow-hidden',
                  guild.accentClassName ??
                    (active
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-secondary-container text-on-secondary-container hover:bg-primary hover:text-on-primary'),
                )}
              >
                {guild.iconUrl ? (
                  <img src={guild.iconUrl} alt="" className="w-full h-full object-cover" />
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
          className="w-12 h-12 rounded-full hover:rounded-xl bg-surface-container text-secondary hover:bg-secondary-container hover:text-on-secondary-container flex items-center justify-center transition-all duration-200"
          aria-label="Sunucu ekle"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
        <button
          type="button"
          onClick={onExploreClick}
          className="w-12 h-12 rounded-full hover:rounded-xl bg-surface-container text-secondary hover:bg-secondary-container hover:text-on-secondary-container flex items-center justify-center transition-all duration-200"
          aria-label="Keşfet"
        >
          <span className="material-symbols-outlined">explore</span>
        </button>
      </div>
    </aside>
  );
}
