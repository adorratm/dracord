import type { ActivityKind } from '@dracord/types';

export const GAME_KIND_LABEL: Record<ActivityKind, string> = {
  billiards: 'Bilardo',
  okey: 'Okey',
  bowling: 'Bowling',
  tavla: 'Tavla',
  blackjack: '21 Blackjack',
  trivia: 'Trivia',
  words: 'Kelime',
  watch_party: 'Watch Party',
};

export const GAME_KINDS = Object.keys(GAME_KIND_LABEL) as ActivityKind[];
