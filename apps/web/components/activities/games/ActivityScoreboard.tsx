'use client';

type ScoreRow = { userId: string; score: number };

export function ActivityScoreboard({
  scores,
  nameByUserId,
  highlightUserId,
  title = 'Skor tablosu',
}: {
  scores: ScoreRow[];
  nameByUserId?: Record<string, string>;
  highlightUserId?: string | null;
  title?: string;
}) {
  if (!scores.length) return null;
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  return (
    <div className="mt-4 space-y-1 border-t border-surface-container-highest pt-3">
      <p className="mb-1 font-label-sm text-outline uppercase tracking-wide">{title}</p>
      <ul className="space-y-1">
        {sorted.map((s, i) => {
          const isMe = highlightUserId && s.userId === highlightUserId;
          return (
            <li
              key={s.userId}
              className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 font-label-sm ${
                isMe ? 'bg-primary-container/20 text-on-surface' : 'text-on-surface-variant'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="tabular-nums text-outline w-4">{i + 1}.</span>
                <span className="truncate">
                  {nameByUserId?.[s.userId] ?? s.userId.slice(0, 8)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-secondary font-semibold">
                {s.score} puan
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
