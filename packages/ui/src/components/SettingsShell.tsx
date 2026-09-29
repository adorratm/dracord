'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Logo } from './Logo';

export interface SettingsNavItem {
  id: string;
  label: string;
  icon?: string;
  active?: boolean;
  onClick?: () => void;
}

export interface SettingsNavSection {
  id: string;
  title?: string;
  items: SettingsNavItem[];
}

export interface SettingsShellProps {
  title?: string;
  sections: SettingsNavSection[];
  children: ReactNode;
  onClose?: () => void;
  headerExtra?: ReactNode;
  className?: string;
}

export function SettingsShell({
  title = 'Dracord Ayarları',
  sections,
  children,
  onClose,
  headerExtra,
  className,
}: SettingsShellProps) {
  return (
    <div className={cn('flex flex-col h-full min-h-0 bg-surface text-on-surface', className)}>
      <header className="h-12 px-space-lg flex items-center justify-between bg-surface-container-lowest border-b border-surface-container-high shrink-0 overflow-hidden">
        <div className="flex items-center gap-space-sm min-w-0">
          <Logo size={28} showBackground />
          <span className="font-headline-md text-headline-md tracking-wide truncate">{title}</span>
        </div>
        <div className="flex items-center gap-space-md shrink-0">
          {headerExtra}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Kapat (Esc)"
              className="h-9 px-space-sm rounded-lg bg-surface-container-highest flex items-center gap-space-xs text-outline hover:bg-surface-bright hover:text-on-surface transition-colors duration-200"
              aria-label="Kapat (Esc)"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span className="font-label-sm text-label-sm hidden sm:inline">Esc</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav
          className="w-60 bg-surface-container-low overflow-y-auto py-space-md px-space-sm shrink-0"
          aria-label="Ayarlar menüsü"
        >
          {sections.map((section) => (
            <div key={section.id} className="mb-space-md">
              {section.title && (
                <p className="px-space-sm mb-space-xs font-label-sm text-label-sm uppercase text-outline tracking-wider">
                  {section.title}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={item.onClick}
                      className={cn(
                        'w-full flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-left transition-colors font-body-md text-body-md',
                        item.active
                          ? 'bg-surface-container-highest text-on-surface'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                      )}
                    >
                      {item.icon && (
                        <span className="material-symbols-outlined text-[20px] text-outline">{item.icon}</span>
                      )}
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto bg-surface-container p-space-xl min-w-0">{children}</main>
      </div>
    </div>
  );
}
