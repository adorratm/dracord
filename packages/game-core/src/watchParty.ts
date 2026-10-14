/** Watch party session state (platform oynatıcı ayrı) */

export type WatchPartyState = {
  mediaUrl: string;
  playing: boolean;
  at: number;
  updatedAt: number | null;
};

export function watchPartyParseState(raw: Record<string, unknown>): WatchPartyState {
  return {
    mediaUrl: typeof raw.mediaUrl === 'string' ? raw.mediaUrl : '',
    playing: Boolean(raw.playing),
    at: Number(raw.at) || 0,
    updatedAt:
      typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : null,
  };
}

export function watchPartyPatch(
  prev: WatchPartyState,
  patch: Partial<WatchPartyState>,
): WatchPartyState {
  return {
    mediaUrl: patch.mediaUrl ?? prev.mediaUrl,
    playing: patch.playing ?? prev.playing,
    at: patch.at ?? prev.at,
    updatedAt: Date.now(),
  };
}
