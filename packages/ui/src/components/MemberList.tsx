'use client';

import type {
  PresenceStatus,
  SocialLinks,
  MemberRoleSummary,
  UserActivity,
} from '@dracord/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';
import { RoleBadge, ROLE_BADGE_STYLES } from './RoleBadge';
import { UserHoverCard } from './UserHoverCard';
import { ActivityLine } from './ActivityLine';
import { activityLineTr } from '../lib/presence';

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
  activity?: UserActivity | null;
  activities?: UserActivity[] | null;
  socialLinks?: SocialLinks | null;
  roleColor?: string;
  subtitle?: string;
  isBot?: boolean;
  badges?: Array<{ id: string; badgeKey?: string | null; color?: string; label?: string }>;
  roles?: MemberRoleSummary[];
  onClick?: () => void;
  onContextMenu?: () => void;
  contextActions?: MemberListAction[];
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

type FlatRow =
  | { type: 'header'; key: string; label: string; count: number }
  | { type: 'member'; key: string; member: MemberListMember };

function MemberRow({
  member,
  menuId,
  menuOpen,
  openMenu,
}: {
  member: MemberListMember;
  menuId: string;
  menuOpen: boolean;
  openMenu: (e: MouseEvent, member: MemberListMember) => void;
}) {
  const actions = member.contextActions?.length
    ? member.contextActions
    : member.onContextMenu
      ? [{ id: 'default', label: 'Engelle', danger: true, onSelect: member.onContextMenu }]
      : [];
  const hasMenu = actions.length > 0;
  return (
    <li className="transition-transform duration-150 hover:translate-x-0.5 list-none">
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
          activity: member.activity,
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
                  e.dataTransfer.setData('application/x-dracord-user', member.id);
                  e.dataTransfer.effectAllowed = 'move';
                }
              : undefined
          }
          onClick={member.onClick}
          onContextMenu={(e) => openMenu(e, member)}
          aria-haspopup={hasMenu ? 'menu' : undefined}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          className={cn(
            'w-full max-w-full flex items-center gap-space-sm px-space-sm py-1.5 rounded-lg hover:bg-surface-container text-left transition-colors group min-w-0',
            menuOpen && 'bg-surface-container',
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
            {activityLineTr(member.activity) ||
            (member.activities && member.activities.length > 0) ? (
              <ActivityLine
                activity={member.activity}
                activities={member.activities}
                className="font-label-sm text-label-sm text-secondary"
                textClassName="font-label-sm text-label-sm text-secondary"
              />
            ) : member.subtitle ? (
              <span className="font-label-sm text-label-sm text-outline truncate">
                {member.subtitle}
              </span>
            ) : null}
          </div>
        </button>
      </UserHoverCard>
    </li>
  );
}

export function MemberList({ groups, className }: MemberListProps) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const flat = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const g of groups) {
      rows.push({
        type: 'header',
        key: `h-${g.id}`,
        label: g.label,
        count: g.members.length,
      });
      for (const m of g.members) {
        rows.push({ type: 'member', key: m.id, member: m });
      }
    }
    return rows;
  }, [groups]);

  const useVirt = flat.length > 48;
  const virtualizer = useVirtualizer({
    count: useVirt ? flat.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (flat[i]?.type === 'header' ? 28 : 44),
    overscan: 14,
  });

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

  let body: ReactNode;
  if (useVirt) {
    body = (
      <div
        style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const row = flat[vi.index]!;
          return (
            <div
              key={row.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
              }}
            >
              {row.type === 'header' ? (
                <h3 className="px-space-sm mb-space-xs font-label-sm text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">
                  {row.label} — {row.count}
                </h3>
              ) : (
                <MemberRow
                  member={row.member}
                  menuId={menuId}
                  menuOpen={menu?.memberId === row.member.id}
                  openMenu={openMenu}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  } else {
    body = groups.map((group) => (
      <div key={group.id} className="mb-space-lg">
        <h3 className="px-space-sm mb-space-xs font-label-sm text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">
          {group.label} — {group.members.length}
        </h3>
        <ul className="flex flex-col gap-0.5 dracord-stagger">
          {group.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              menuId={menuId}
              menuOpen={menu?.memberId === member.id}
              openMenu={openMenu}
            />
          ))}
        </ul>
      </div>
    ));
  }

  return (
    <aside
      data-tour="members"
      className={cn(
        'w-full min-w-0 bg-surface-container-low flex flex-col min-h-0 overflow-hidden py-space-md px-space-sm shrink-0',
        className,
      )}
      aria-label="Üye listesi"
    >
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        {body}
      </div>

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
                onPointerDown={(e) => {
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
