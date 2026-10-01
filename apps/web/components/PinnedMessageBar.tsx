'use client';

import type { MessageDto } from '@dracord/types';
import { Avatar } from '@dracord/ui';

type Props = {
  message: MessageDto;
  pinCount?: number;
  onJump?: () => void;
  onViewAll?: () => void;
};

export function PinnedMessageBar({ message, pinCount = 1, onJump, onViewAll }: Props) {
  const preview = (message.content || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const label = preview || (message.attachments?.length ? 'Ek / medya' : 'Sabitlenmiş mesaj');

  return (
    <div className="shrink-0 border-b border-surface-container-high bg-surface-container-low/90 backdrop-blur-sm">
      <button
        type="button"
        onClick={onJump}
        className="w-full flex items-center gap-space-sm px-space-md py-2 text-left hover:bg-surface-container-high/80 transition-colors"
      >
        <span className="material-symbols-outlined text-[18px] text-primary-container shrink-0">
          push_pin
        </span>
        <Avatar
          displayName={message.author.displayName}
          imageUrl={message.author.avatarUrl}
          size="sm"
          statusRing={false}
        />
        <div className="min-w-0 flex-1">
          <p className="font-label-sm text-on-surface-variant truncate">
            <span className="text-on-surface font-medium">{message.author.displayName}</span>
            {pinCount > 1 ? ` · ${pinCount} sabit` : ' · Sabitlenen mesaj'}
          </p>
          <p className="font-body-sm text-on-surface truncate">{label}</p>
        </div>
        {onViewAll && (
          <span
            role="button"
            tabIndex={0}
            className="font-label-sm text-primary-container hover:underline shrink-0 px-1"
            onClick={(e) => {
              e.stopPropagation();
              onViewAll();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onViewAll();
              }
            }}
          >
            Tümü
          </span>
        )}
      </button>
    </div>
  );
}
