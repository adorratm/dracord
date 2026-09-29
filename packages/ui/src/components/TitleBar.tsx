'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Logo } from './Logo';

export type TitleBarNavId = 'servers' | 'direct-messages' | 'voice' | 'settings';

const NAV_ITEMS: { id: TitleBarNavId; label: string }[] = [
  { id: 'servers', label: 'Sunucular' },
  { id: 'direct-messages', label: 'Direkt mesajlar' },
  { id: 'voice', label: 'Ses' },
  { id: 'settings', label: 'Ayarlar' },
];

export interface TitleBarWindowControls {
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

export interface TitleBarProps {
  activeNav?: TitleBarNavId;
  onNavClick?: (id: TitleBarNavId) => void;
  subtitle?: string;
  trailing?: ReactNode;
  windowControls?: TitleBarWindowControls;
  className?: string;
}

export function TitleBar({
  activeNav = 'servers',
  onNavClick,
  subtitle = 'Dracord',
  trailing,
  windowControls,
  className,
}: TitleBarProps) {
  const showWindowControls =
    windowControls &&
    (windowControls.onMinimize || windowControls.onMaximize || windowControls.onClose);

  return (
    <header
      className={cn(
        'h-10 bg-surface-container-lowest flex items-center justify-between px-space-md shadow-bar z-50',
        className,
      )}
    >
      <div className="flex items-center gap-space-sm min-w-0">
        <Logo size={28} showBackground />
        <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider truncate">
          {subtitle}
        </span>
      </div>

      <nav className="hidden md:flex items-center gap-space-sm" aria-label="Ana gezinme">
        {NAV_ITEMS.map((item) => {
          const active = item.id === activeNav;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavClick?.(item.id)}
              className={cn(
                'font-body-sm text-body-sm px-space-sm py-space-xs rounded-lg transition-[color,background-color,transform] duration-200 ease-out motion-reduce:transition-none',
                active
                  ? 'bg-surface-container-high text-on-surface font-bold'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-space-md">
        {trailing}
        {showWindowControls && (
          <div className="flex items-center">
            {windowControls.onMinimize && (
              <button
                type="button"
                onClick={windowControls.onMinimize}
                className="h-8 w-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                aria-label="Küçült"
              >
                <span className="material-symbols-outlined text-[16px]">minimize</span>
              </button>
            )}
            {windowControls.onMaximize && (
              <button
                type="button"
                onClick={windowControls.onMaximize}
                className="h-8 w-8 flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
                aria-label="Büyüt"
              >
                <span className="material-symbols-outlined text-[16px]">check_box_outline_blank</span>
              </button>
            )}
            {windowControls.onClose && (
              <button
                type="button"
                onClick={windowControls.onClose}
                className="h-8 w-8 flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
                aria-label="Kapat"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
