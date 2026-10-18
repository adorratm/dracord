'use client';

import { useState } from 'react';
import type { ChannelSummary, DiscoverCuratedApp } from '@dracord/types';
import { DISCOVER_CURATED_APPS } from '@dracord/types';
import { useRouter } from 'next/navigation';

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

type Tab = 'server' | 'games' | 'watch' | 'social';

export function ActivitiesPicker({
  open,
  onClose,
  guildId,
  channels,
  onSelectChannel,
}: {
  open: boolean;
  onClose: () => void;
  guildId: string;
  channels: ChannelSummary[];
  onSelectChannel?: (c: ChannelSummary) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('server');
  if (!open) return null;

  const activityChannels = channels
    .filter((c) => c.type === 'GAME' || c.type === 'WATCH_PARTY')
    .slice()
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'tr'));

  const games = activityChannels.filter((c) => c.type === 'GAME');
  const watch = activityChannels.filter((c) => c.type === 'WATCH_PARTY');

  const curatedGames = DISCOVER_CURATED_APPS.filter(
    (a) => a.kind === 'game' && a.gameChannelHint !== 'trivia' && a.gameChannelHint !== 'words',
  );
  const curatedSocial = DISCOVER_CURATED_APPS.filter(
    (a) => a.gameChannelHint === 'trivia' || a.gameChannelHint === 'words',
  );
  const curatedWatch = DISCOVER_CURATED_APPS.filter((a) => a.kind === 'utility');

  const openChannel = (c: ChannelSummary) => {
    onClose();
    if (onSelectChannel) onSelectChannel(c);
    else router.push(`/channels/${guildId}/${c.id}`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'server', label: 'Bu sunucu' },
    { id: 'games', label: 'Oyunlar' },
    { id: 'social', label: 'Sosyal' },
    { id: 'watch', label: 'İzle' },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-space-md">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Kapat"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Aktiviteler"
        className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-surface-container-low border border-surface-container-highest shadow-float p-space-md"
      >
        <div className="flex items-center justify-between mb-space-sm">
          <h2 className="font-headline-lg text-on-surface">Aktiviteler</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <p className="font-body-sm text-on-surface-variant mb-space-md">
          Masa oyunları, trivia, kelime ve Watch Party — otomatik bilardo yok.
        </p>

        <div className="flex flex-wrap gap-1 mb-space-md">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg font-label-sm ${
                tab === t.id
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-bright'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'server' && (
          <>
            {activityChannels.length > 0 ? (
              <ul className="space-y-1 mb-space-lg">
                {activityChannels.map((c) => {
                  const hint =
                    c.type === 'WATCH_PARTY' ? 'WATCH_PARTY' : (c.gameKind ?? 'GAME');
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openChannel(c)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container text-left"
                      >
                        <span className="material-symbols-outlined text-primary-container">
                          {KIND_ICON[hint] ?? KIND_ICON.GAME}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-label-md text-on-surface truncate">
                            {c.name}
                          </span>
                          <span className="block font-label-sm text-on-surface-variant">
                            {c.type === 'WATCH_PARTY'
                              ? 'Watch Party'
                              : c.gameKind ?? 'Oyun'}
                            {(c.voiceMembers?.length ?? 0) > 0
                              ? ` · ${c.voiceMembers!.length} kişi`
                              : ''}
                          </span>
                        </span>
                        <span className="material-symbols-outlined text-outline text-[18px]">
                          chevron_right
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="font-body-sm text-on-surface-variant mb-space-md">
                Bu sunucuda henüz oyun / Watch Party kanalı yok — Keşfet’ten tür seç.
              </p>
            )}
            {!games.length && !watch.length ? null : (
              <p className="font-label-sm text-outline mb-2">
                {games.length} oyun · {watch.length} izleme kanalı
              </p>
            )}
          </>
        )}

        {tab === 'games' && (
          <CuratedList
            apps={curatedGames}
            onPick={() => {
              onClose();
              router.push('/discover');
            }}
          />
        )}
        {tab === 'social' && (
          <CuratedList
            apps={curatedSocial}
            onPick={() => {
              onClose();
              router.push('/discover');
            }}
          />
        )}
        {tab === 'watch' && (
          <CuratedList
            apps={curatedWatch}
            onPick={() => {
              onClose();
              router.push('/discover');
            }}
          />
        )}
      </div>
    </div>
  );
}

function CuratedList({
  apps,
  onPick,
}: {
  apps: DiscoverCuratedApp[];
  onPick: () => void;
}) {
  return (
    <ul className="space-y-1">
      {apps.map((app) => (
        <li key={app.id}>
          <button
            type="button"
            onClick={onPick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container text-left"
          >
            <span className="material-symbols-outlined text-primary-container">{app.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block font-label-md text-on-surface">{app.name}</span>
              <span className="block font-label-sm text-on-surface-variant truncate">
                {app.tagline}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
