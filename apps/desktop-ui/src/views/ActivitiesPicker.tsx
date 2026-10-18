import type { ChannelSummary } from '@dracord/types';
import { DISCOVER_CURATED_APPS } from '@dracord/types';

const KIND_ICON: Record<string, string> = {
  billiards: 'sports_bar',
  okey: 'grid_view',
  bowling: 'sports_martial_arts',
  tavla: 'casino',
  blackjack: 'style',
  trivia: 'quiz',
  words: 'spellcheck',
  WATCH_PARTY: 'live_tv',
  GAME: 'sports_esports',
};

export function ActivitiesPicker({
  open,
  onClose,
  channels,
  onSelectChannel,
  onOpenDiscover,
}: {
  open: boolean;
  onClose: () => void;
  channels: ChannelSummary[];
  onSelectChannel: (c: ChannelSummary) => void;
  onOpenDiscover?: () => void;
}) {
  if (!open) return null;

  const activityChannels = channels
    .filter((c) => c.type === 'GAME' || c.type === 'WATCH_PARTY')
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'tr'));

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-surface-container-low border border-surface-container-highest shadow-float p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-headline-lg text-on-surface">Aktiviteler</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="font-body-sm text-on-surface-variant mb-3">
          Oyun veya Watch Party seç — otomatik bilardo’ya atılmaz.
        </p>
        {activityChannels.length === 0 ? (
          <p className="font-body-sm text-on-surface-variant mb-3">
            Bu sunucuda oyun / Watch Party kanalı yok.
          </p>
        ) : (
          <ul className="space-y-1 mb-4">
            {activityChannels.map((c) => {
              const hint = c.type === 'WATCH_PARTY' ? 'WATCH_PARTY' : (c.gameKind ?? 'GAME');
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectChannel(c);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container text-left"
                  >
                    <span className="material-symbols-outlined text-primary-container">
                      {KIND_ICON[hint] ?? KIND_ICON.GAME}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-label-md text-on-surface truncate">{c.name}</span>
                      <span className="block font-label-sm text-on-surface-variant">
                        {c.type === 'WATCH_PARTY' ? 'Watch Party' : c.gameKind ?? 'Oyun'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {onOpenDiscover && (
          <>
            <h3 className="font-headline-md text-on-surface mb-2">Keşfet</h3>
            <ul className="space-y-1">
              {DISCOVER_CURATED_APPS.map((app) => (
                <li key={app.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenDiscover();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container text-left"
                  >
                    <span className="material-symbols-outlined text-primary-container">
                      {app.icon}
                    </span>
                    <span className="font-label-md text-on-surface">{app.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
