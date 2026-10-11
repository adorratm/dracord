'use client';

import { cn } from '../lib/cn';

export interface SkeletonProps {
  className?: string;
}

/** Shimmer placeholder — uses theme surface tokens. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-md bg-surface-container-high relative overflow-hidden animate-pulse',
        className,
      )}
    />
  );
}

export function GuildNavSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex h-full w-full md:w-72 flex-col bg-surface-container-low', className)}
      aria-busy
      aria-label="Yükleniyor"
    >
      <div className="h-12 px-3 flex items-center border-b border-surface-container-high">
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="flex-1 p-3 space-y-4 overflow-hidden">
        {[0, 1, 2].map((g) => (
          <div key={g} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="space-y-1.5 pl-1">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-[92%] rounded-lg" />
              <Skeleton className="h-8 w-[85%] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-surface-container-high flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2.5 w-16" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

export function ChatSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex flex-1 min-w-0 min-h-0 flex-col bg-surface', className)}
      aria-busy
      aria-label="İçerik yükleniyor"
    >
      <div className="h-12 px-4 flex items-center gap-3 border-b border-surface-container-high">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex-1 p-4 space-y-5 overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-full max-w-md" />
              <Skeleton className="h-3 w-[70%] max-w-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
