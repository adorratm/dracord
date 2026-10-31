export const DRACORD_QUEUE = 'dracord-jobs';

export const DracordJobTypes = {
  REMINDERS_TICK: 'reminders.tick',
  PUSH_NOTIFY: 'push.notify',
  WEBHOOK_DISPATCH: 'webhook.dispatch',
  SPOTIFY_POLL: 'spotify.poll',
  MEDIA_SCAN: 'media.scan',
  SEARCH_REINDEX: 'search.reindex',
  LINK_PREVIEW: 'link.preview',
} as const;

export type DracordJobType =
  (typeof DracordJobTypes)[keyof typeof DracordJobTypes];
