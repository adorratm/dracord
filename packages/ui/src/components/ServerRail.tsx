'use client';

import type { GuildSummary } from '@dracord/types';
import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { Logo } from './Logo';

export interface ServerRailGuild extends Pick<GuildSummary, 'id' | 'name' | 'iconUrl'> {
  initials?: string;
  accentClassName?: string;
  ownerId?: string;
  favorite?: boolean;
}

export interface ServerRailGuildAction {
  id: string;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

export interface ServerRailProps {
  guilds: ServerRailGuild[];
  activeGuildId?: string | null;
  homeActive?: boolean;
  onHomeClick?: () => void;
  onGuildClick?: (guildId: string) => void;
  onAddClick?: () => void;
  onExploreClick?: () => void;
  /** Sağ tık menü aksiyonları */
  getGuildActions?: (guild: ServerRailGuild) => ServerRailGuildAction[];
  /** Sürükle-bırak sonrası yeni id sırası (favoriler + diğerleri) */
  onGuildReorder?: (orderedIds: string[]) => void;
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

type MenuState = {
  x: number;
  y: number;
  guildId: string;
  displayName: string;
  actions: ServerRailGuildAction[];
};

function GuildButton({
  guild,
  active,
  onGuildClick,
  openMenu,
  getGuildActions,
  onGuildReorder,
  allIds,
}: {
  guild: ServerRailGuild;
  active: boolean;
  onGuildClick?: (guildId: string) => void;
  openMenu: (e: MouseEvent, guild: ServerRailGuild) => void;
  getGuildActions?: (guild: ServerRailGuild) => ServerRailGuildAction[];
  onGuildReorder?: (orderedIds: string[]) => void;
  allIds: string[];
}) {
  return (
    <div
      className="relative group flex items-center justify-center w-full"
      draggable={Boolean(onGuildReorder)}
      onDragStart={
        onGuildReorder
          ? (e) => {
              e.dataTransfer.setData('application/x-dracord-guild', guild.id);
              e.dataTransfer.effectAllowed = 'move';
            }
          : undefined
      }
      onDragOver={
        onGuildReorder
          ? (e) => {
              if ([...e.dataTransfer.types].includes('application/x-dracord-guild')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }
          : undefined
      }
      onDrop={
        onGuildReorder
          ? (e) => {
              e.preventDefault();
              const dragged = e.dataTransfer.getData('application/x-dracord-guild');
              if (!dragged || dragged === guild.id) return;
              const next = allIds.filter((id) => id !== dragged);
              const at = next.indexOf(guild.id);
              if (at < 0) return;
              next.splice(at, 0, dragged);
              onGuildReorder(next);
            }
          : undefined
      }
    >
      <ActivePill active={active} />
      {!active && <HoverPill show />}
      <button
        type="button"
        onClick={() => onGuildClick?.(guild.id)}
        onContextMenu={(e) => openMenu(e, guild)}
        title={guild.name}
        aria-haspopup={getGuildActions ? 'menu' : undefined}
        className={cn(
          'relative z-[1] w-12 h-12 flex items-center justify-center font-headline-md text-headline-md overflow-hidden',
          railBtnEase,
          active ? 'rounded-[16px]' : 'rounded-[50%] hover:rounded-[16px] hover:scale-[1.04] active:scale-[0.98]',
          guild.accentClassName ??
            (active
              ? 'bg-primary-container text-on-primary-container'
              : 'bg-secondary-container text-on-secondary-container hover:bg-primary hover:text-on-primary'),
          guild.favorite && !active && 'ring-1 ring-primary-container/50',
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
        {guild.favorite && (
          <span
            className="absolute -top-0.5 -right-0.5 material-symbols-outlined text-[12px] text-primary-container drop-shadow"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden
          >
            star
          </span>
        )}
      </button>
    </div>
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
  getGuildActions,
  onGuildReorder,
  className,
}: ServerRailProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const { favorites, others, allIds } = useMemo(() => {
    const favs = guilds.filter((g) => g.favorite);
    const rest = guilds.filter((g) => !g.favorite);
    return {
      favorites: favs,
      others: rest,
      allIds: [...favs, ...rest].map((g) => g.id),
    };
  }, [guilds]);

  useEffect(() => {
    if (!menu) return;
    let removeClose: (() => void) | undefined;
    const timer = window.setTimeout(() => {
      const onPointerDown = (e: PointerEvent) => {
        const node = menuRef.current;
        if (node && e.target instanceof Node && node.contains(e.target)) return;
        setMenu(null);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setMenu(null);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKey);
      removeClose = () => {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKey);
      };
    }, 0);
    return () => {
      window.clearTimeout(timer);
      removeClose?.();
    };
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const node = menuRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    let x = menu.x;
    let y = menu.y;
    if (x + rect.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - rect.width - 8);
    if (y + rect.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - rect.height - 8);
    if (x !== menu.x || y !== menu.y) {
      setMenu((prev) => (prev ? { ...prev, x, y } : prev));
    }
  }, [menu]);

  const openMenu = (e: MouseEvent, guild: ServerRailGuild) => {
    const actions = getGuildActions?.(guild) ?? [];
    if (!actions.length) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      guildId: guild.id,
      displayName: guild.name,
      actions,
    });
  };

  return (
    <aside
      className={cn(
        'w-[72px] bg-surface-container-lowest flex flex-col items-center pt-space-md pb-space-md gap-space-sm shrink-0 relative z-0',
        className,
      )}
      aria-label="Sunucular"
    >
      <div className="relative group flex items-center justify-center w-full shrink-0">
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

      <div className="w-8 h-[2px] bg-surface-container-highest rounded-full my-space-xs shrink-0" />

      <div className="flex-1 flex flex-col items-center gap-space-sm w-full overflow-y-auto min-h-0 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {favorites.map((guild) => (
          <GuildButton
            key={guild.id}
            guild={guild}
            active={guild.id === activeGuildId}
            onGuildClick={onGuildClick}
            openMenu={openMenu}
            getGuildActions={getGuildActions}
            onGuildReorder={onGuildReorder}
            allIds={allIds}
          />
        ))}
        {favorites.length > 0 && others.length > 0 && (
          <div className="w-8 h-[2px] bg-surface-container-highest rounded-full my-space-xs shrink-0" />
        )}
        {others.map((guild) => (
          <GuildButton
            key={guild.id}
            guild={guild}
            active={guild.id === activeGuildId}
            onGuildClick={onGuildClick}
            openMenu={openMenu}
            getGuildActions={getGuildActions}
            onGuildReorder={onGuildReorder}
            allIds={allIds}
          />
        ))}
      </div>

      {/* Alt aksiyonlar scroll dışında — mobilde basık kalmasın */}
      <div className="shrink-0 flex flex-col items-center gap-3 pt-space-sm pb-2 w-full border-t border-surface-container-highest/60 mt-1">
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

      {menu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            className="fixed z-[200] min-w-[12rem] max-w-[16rem] rounded-lg bg-surface-container-high border border-surface-container-highest shadow-float py-1"
            style={{ left: menu.x, top: menu.y }}
          >
            <p className="px-3 py-1.5 font-label-sm text-outline truncate border-b border-surface-container-highest mb-0.5">
              {menu.displayName}
            </p>
            {menu.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                className={cn(
                  'w-full text-left px-3 py-2 font-body-sm hover:bg-surface-bright transition-colors',
                  action.danger ? 'text-error' : 'text-on-surface',
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenu(null);
                  action.onSelect();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </aside>
  );
}
