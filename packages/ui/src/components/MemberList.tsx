'use client';

import type { PresenceStatus, SocialLinks, MemberRoleSummary } from '@dracord/types';
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { RoleBadge, ROLE_BADGE_STYLES } from './RoleBadge';
import { UserHoverCard } from './UserHoverCard';

export interface MemberListAction {
  id: string;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

export interface MemberListMember {
  id: string;
  displayName: string;
  username?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
  bio?: string | null;
  status: PresenceStatus;
  customStatus?: string | null;
  socialLinks?: SocialLinks | null;
  roleColor?: string;
  subtitle?: string;
  isBot?: boolean;
  /** Animasyonlu rol rozetleri */
  badges?: Array<{ id: string; badgeKey?: string | null; color?: string; label?: string }>;
  roles?: MemberRoleSummary[];
  onClick?: () => void;
  /** @deprecated Tek aksiyon — yerine contextActions kullan */
  onContextMenu?: () => void;
  /** Sağ tık menüsü — engel yalnızca buradan seçilince uygulanır */
  contextActions?: MemberListAction[];
  /** Sürükleyerek ses kanalına taşı */
  draggable?: boolean;
}

export interface MemberListGroup {
  id: string;
  label: string;
  members: MemberListMember[];
}

export interface MemberListProps {
  groups: MemberListGroup[];
  className?: string;
}

type MenuState = {
  x: number;
  y: number;
  memberId: string;
  displayName: string;
  actions: MemberListAction[];
};

export function MemberList({ groups, className }: MemberListProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('dracord-role-badge-styles')) return;
    const el = document.createElement('style');
    el.id = 'dracord-role-badge-styles';
    el.textContent = ROLE_BADGE_STYLES;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    if (!menu) return;

    // Sağ tık mousedown'ı menüyü anında kapatmasın
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
    if (!menu || !menuRef.current) return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    let x = menu.x;
    let y = menu.y;
    if (x + rect.width > window.innerWidth - 8) x = Math.max(8, window.innerWidth - rect.width - 8);
    if (y + rect.height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - rect.height - 8);
    if (x !== menu.x || y !== menu.y) {
      setMenu((prev) => (prev ? { ...prev, x, y } : prev));
    }
  }, [menu]);

  const resolveActions = (member: MemberListMember): MemberListAction[] => {
    if (member.contextActions?.length) return member.contextActions;
    if (member.onContextMenu) {
      return [{ id: 'default', label: 'Engelle', danger: true, onSelect: member.onContextMenu }];
    }
    return [];
  };

  const openMenu = (e: MouseEvent, member: MemberListMember) => {
    const actions = resolveActions(member);
    if (actions.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      memberId: member.id,
      displayName: member.displayName,
      actions,
    });
  };

  return (
    <aside
      className={cn(
        'w-full min-w-0 bg-surface-container-low flex flex-col min-h-0 overflow-y-auto py-space-md px-space-sm shrink-0',
        className,
      )}
      aria-label="Üye listesi"
    >
      {groups.map((group) => (
        <div key={group.id} className="mb-space-lg">
          <h3 className="px-space-sm mb-space-xs font-label-sm text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">
            {group.label} — {group.members.length}
          </h3>
          <ul className="flex flex-col gap-0.5 dracord-stagger">
            {group.members.map((member) => {
              const hasMenu = resolveActions(member).length > 0;
              return (
                <li key={member.id} className="transition-transform duration-150 hover:translate-x-0.5">
                  <UserHoverCard
                    user={{
                      id: member.id,
                      displayName: member.displayName,
                      username: member.username,
                      avatarUrl: member.avatarUrl,
                      bannerUrl: member.bannerUrl,
                      bannerColor: member.bannerColor,
                      bio: member.bio,
                      status: member.status,
                      customStatus: member.customStatus,
                      isBot: member.isBot,
                      socialLinks: member.socialLinks,
                      roles: member.roles,
                    }}
                  >
                    <button
                      type="button"
                      draggable={member.draggable}
                      onDragStart={
                        member.draggable
                          ? (e) => {
                              e.dataTransfer.setData(
                                'application/x-dracord-user',
                                member.id,
                              );
                              e.dataTransfer.effectAllowed = 'move';
                            }
                          : undefined
                      }
                      onClick={member.onClick}
                      onContextMenu={(e) => openMenu(e, member)}
                      aria-haspopup={hasMenu ? 'menu' : undefined}
                      aria-expanded={menu?.memberId === member.id}
                      aria-controls={menu?.memberId === member.id ? menuId : undefined}
                      className={cn(
                        'w-full max-w-full flex items-center gap-space-sm px-space-sm py-1.5 rounded-lg hover:bg-surface-container text-left transition-colors group min-w-0',
                        menu?.memberId === member.id && 'bg-surface-container',
                        member.draggable && 'cursor-grab active:cursor-grabbing',
                      )}
                    >
                      <Avatar
                        displayName={member.displayName}
                        imageUrl={member.avatarUrl}
                        size="md"
                        status={member.status}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="font-body-sm text-body-sm truncate"
                            style={member.roleColor ? { color: member.roleColor } : undefined}
                          >
                            {member.displayName}
                          </span>
                          {member.isBot && (
                            <span className="shrink-0 px-1 py-px rounded text-[9px] font-bold uppercase tracking-wide bg-primary-container text-on-primary-container leading-none">
                              BOT
                            </span>
                          )}
                          {(member.badges ?? [])
                            .filter((b) => b.badgeKey && b.badgeKey !== 'none')
                            .slice(0, 2)
                            .map((b) => (
                              <RoleBadge
                                key={b.id}
                                badgeKey={b.badgeKey}
                                color={b.color}
                                size="sm"
                              />
                            ))}
                        </span>
                        {member.subtitle && (
                          <span className="font-label-sm text-label-sm text-outline truncate">
                            {member.subtitle}
                          </span>
                        )}
                      </div>
                    </button>
                  </UserHoverCard>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {menu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            className="fixed z-[100] min-w-[12rem] max-w-[16rem] rounded-lg bg-surface-container-high border border-surface-container-highest shadow-float py-1"
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
