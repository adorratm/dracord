/**
 * Dracord ↔ oyun mesaj protokolü (v1). Host (Dracord) ve SDK aynı tipleri kullanır.
 * Taşıma: web/desktop → window.postMessage (iframe), mobil → React Native WebView köprüsü.
 */
export const PROTOCOL_VERSION = 1;
export const EMBED_SOURCE = 'dracord-embed';
export const HOST_SOURCE = 'dracord-host';
/** RN WebView'a enjekte edilen mesajların origin işareti */
export const NATIVE_ORIGIN = 'dracord-native';

export type EmbedPlatform = 'web' | 'desktop' | 'mobile';

export interface EmbedUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface EmbedSession {
  id: string;
  gameId: string;
  guildId: string;
  channelId: string;
  hostUserId: string;
  participantIds: string[];
  status: 'active' | 'ended';
}

export interface EmbedParticipant {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface InitPayload {
  protocol: number;
  /** Oyun sunucusunda POST /v1/games/verify ile doğrula — istemciye güvenme */
  token: string;
  expiresAt: string;
  user: EmbedUser;
  session: EmbedSession;
  participants: EmbedParticipant[];
  platform: EmbedPlatform;
  locale: string;
  theme: 'dark' | 'light';
  /** Onaysız oyun (sahip / testçi) */
  testMode: boolean;
  /** Dracord API kökü (verify için) */
  apiBase: string;
}

export type HostMessage =
  | { source: typeof HOST_SOURCE; type: 'INIT'; payload: InitPayload }
  | { source: typeof HOST_SOURCE; type: 'SESSION_UPDATE'; payload: { session: EmbedSession; participants: EmbedParticipant[] } }
  | { source: typeof HOST_SOURCE; type: 'TOKEN'; payload: { token: string; expiresAt: string } }
  | { source: typeof HOST_SOURCE; type: 'VISIBILITY'; payload: { visible: boolean } }
  | { source: typeof HOST_SOURCE; type: 'ERROR'; payload: { code: string; message: string } };

export type EmbedMessage =
  | { source: typeof EMBED_SOURCE; type: 'READY'; payload: { protocol: number; sdk: string } }
  | { source: typeof EMBED_SOURCE; type: 'REFRESH_TOKEN' }
  | { source: typeof EMBED_SOURCE; type: 'CLOSE' }
  | { source: typeof EMBED_SOURCE; type: 'INVITE' }
  | { source: typeof EMBED_SOURCE; type: 'OPEN_EXTERNAL'; payload: { url: string } }
  | { source: typeof EMBED_SOURCE; type: 'TOAST'; payload: { text: string } }
  | { source: typeof EMBED_SOURCE; type: 'SET_STATUS'; payload: { text: string | null } };

export function isHostMessage(d: unknown): d is HostMessage {
  return Boolean(d && typeof d === 'object' && (d as { source?: unknown }).source === HOST_SOURCE);
}
export function isEmbedMessage(d: unknown): d is EmbedMessage {
  return Boolean(d && typeof d === 'object' && (d as { source?: unknown }).source === EMBED_SOURCE);
}
