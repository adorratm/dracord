'use client';

import type { PresenceStatus } from '@dracord/types';
import { cn } from '../lib/cn';
import { Avatar } from './Avatar';

export interface MemberListMember {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  status: PresenceStatus;
  roleColor?: string;
  subtitle?: string;
  onClick?: () => void;
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

export function MemberList({ groups, className }: MemberListProps) {
  return (
    <aside
      className={cn(
        'w-60 bg-surface-container-low flex flex-col min-h-0 overflow-y-auto py-space-md px-space-sm shrink-0',
        className,
      )}
      aria-label="Üye listesi"
    >
      {groups.map((group) => (
        <div key={group.id} className="mb-space-lg">
          <h3 className="px-space-sm mb-space-xs font-label-sm text-label-sm uppercase tracking-wider font-bold text-on-surface-variant">
            {group.label} — {group.members.length}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {group.members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={member.onClick}
                  className="w-full flex items-center gap-space-sm px-space-sm py-1.5 rounded-lg hover:bg-surface-container text-left transition-colors group"
                >
                  <Avatar
                    displayName={member.displayName}
                    imageUrl={member.avatarUrl}
                    size="md"
                    status={member.status}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span
                      className="font-body-sm text-body-sm truncate"
                      style={member.roleColor ? { color: member.roleColor } : undefined}
                    >
                      {member.displayName}
                    </span>
                    {member.subtitle && (
                      <span className="font-label-sm text-label-sm text-outline truncate">{member.subtitle}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
