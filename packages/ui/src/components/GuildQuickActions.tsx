'use client';

import { cn } from '../lib/cn';
import { Tooltip } from './Tooltip';

export interface GuildQuickAction {
  id: string;
  /** Material Symbols name */
  icon: string;
  label: string;
  onClick: () => void;
  /** highlighted icon colour (e.g. boosts) */
  accent?: boolean;
}

/**
 * Server sidebar header: "İnsanları davet et" stays a full button, the rest are one row of
 * icon buttons with a tooltip (they used to take a full row each).
 */
export function GuildQuickActions({
  onInvite,
  inviteBusy = false,
  actions,
}: {
  onInvite: () => void;
  inviteBusy?: boolean;
  actions: GuildQuickAction[];
}) {
  return (
    <div className="px-2 pb-2 space-y-1.5">
      <button
        type="button"
        className="w-full h-8 rounded-lg bg-surface-container-high text-on-surface font-label-sm hover:bg-surface-bright transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
        disabled={inviteBusy}
        onClick={onInvite}
      >
        <span className="material-symbols-outlined text-[16px]">person_add</span>
        İnsanları davet et
      </button>
      <div className="flex gap-1" role="toolbar" aria-label="Sunucu araçları">
        {actions.map((a) => (
          <Tooltip key={a.id} content={a.label} side="bottom">
            <button
              type="button"
              aria-label={a.label}
              onClick={a.onClick}
              className="flex-1 min-w-0 h-8 rounded-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-bright hover:text-on-surface transition-colors flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className={cn('material-symbols-outlined text-[18px]', a.accent && 'text-primary-container')}>{a.icon}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
