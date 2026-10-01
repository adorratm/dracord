'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { Logo } from './Logo';

export interface SettingsNavItem {
  id: string;
  label: string;
  icon?: string;
  active?: boolean;
  onClick?: () => void;
  /** Kırmızı stil (ör. Çıkış Yap) */
  variant?: 'default' | 'danger';
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

function SettingsNavList({
  sections,
  onItemClick,
}: {
  sections: SettingsNavSection[];
  onItemClick?: () => void;
}) {
  return (
    <>
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
                  onClick={() => {
                    item.onClick?.();
                    onItemClick?.();
                  }}
                  className={cn(
                    'w-full flex items-center gap-space-sm px-space-sm py-2.5 sm:py-2 rounded-lg text-left transition-colors font-body-md text-body-md min-w-0',
                    item.variant === 'danger'
                      ? item.active
                        ? 'bg-error/15 text-error'
                        : 'text-error hover:bg-error/10'
                      : item.active
                        ? 'bg-surface-container-highest text-on-surface'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                  )}
                >
                  {item.icon && (
                    <span
                      className={cn(
                        'material-symbols-outlined text-[20px] shrink-0',
                        item.variant === 'danger' ? 'text-error' : 'text-outline',
                      )}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export function SettingsShell({
  title = 'Dracord Ayarları',
  sections,
  children,
  onClose,
  headerExtra,
  className,
}: SettingsShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeMenu();
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const activeLabel =
    sections.flatMap((s) => s.items).find((i) => i.active)?.label ?? 'Ayarlar';

  return (
    <div className={cn('flex flex-col h-full min-h-0 min-w-0 overflow-hidden bg-surface text-on-surface', className)}>
      <header className="h-12 px-space-sm sm:px-space-lg flex items-center justify-between bg-surface-container-lowest border-b border-surface-container-high shrink-0 gap-space-sm min-w-0">
        <div className="flex items-center gap-space-xs sm:gap-space-sm min-w-0 flex-1">
          <button
            type="button"
            className="md:hidden h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            aria-label="Ayarlar menüsü"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <Logo size={28} showBackground className="shrink-0 hidden sm:block" />
          <div className="min-w-0 flex flex-col">
            <span className="font-headline-md text-headline-md tracking-wide truncate hidden sm:block">
              {title}
            </span>
            <span className="font-headline-md text-on-surface truncate sm:hidden">{activeLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-space-sm shrink-0">
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

      <div className="flex flex-1 min-h-0 min-w-0">
        <nav
          className="hidden md:block w-60 bg-surface-container-low overflow-y-auto py-space-md px-space-sm shrink-0"
          aria-label="Ayarlar menüsü"
        >
          <SettingsNavList sections={sections} />
        </nav>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-surface-container p-space-md sm:p-space-lg md:p-space-xl min-w-0">
          {children}
        </main>
      </div>

      {mounted &&
        menuOpen &&
        createPortal(
          <div className="fixed inset-0 z-[260] md:hidden" data-settings-drawer="">
            <button
              type="button"
              className="absolute inset-0 bg-black/55"
              aria-label="Menüyü kapat"
              onClick={closeMenu}
            />
            <div
              className="absolute top-0 bottom-0 left-0 z-[1] w-[min(100vw-3rem,18rem)] max-w-full bg-surface-container-low shadow-float flex flex-col dracord-slide-up"
              role="dialog"
              aria-modal
              aria-label="Ayarlar menüsü"
            >
              <div className="h-12 px-space-sm flex items-center justify-between border-b border-surface-container-high shrink-0 gap-2">
                <div className="flex items-center gap-space-sm min-w-0">
                  <Logo size={24} showBackground className="shrink-0" />
                  <span className="font-headline-md text-on-surface truncate">{title}</span>
                </div>
                <button
                  type="button"
                  onClick={closeMenu}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container shrink-0"
                  aria-label="Kapat"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">close</span>
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto py-space-md px-space-sm">
                <SettingsNavList sections={sections} onItemClick={closeMenu} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
