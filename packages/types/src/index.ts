export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE';

export type ChannelType = 'TEXT' | 'VOICE' | 'CATEGORY';

export interface SocialLinks {
  website?: string;
  twitter?: string;
  github?: string;
  discord?: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: PresenceStatus;
  bannerColor?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  accentColor?: string | null;
  socialLinks?: SocialLinks | null;
}

export interface VoiceMemberSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  muted?: boolean;
  deafened?: boolean;
}

export interface GuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerUrl?: string | null;
  ownerId: string;
  discoverable?: boolean;
  memberCount?: number;
}

export interface ChannelSummary {
  id: string;
  guildId: string | null;
  name: string;
  type: ChannelType;
  categoryId: string | null;
  position: number;
  topic?: string | null;
  voiceMembers?: VoiceMemberSummary[];
}

export interface MessageAttachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface MessageDto {
  id: string;
  channelId: string;
  author: PublicUser;
  content: string;
  attachments?: MessageAttachment[];
  createdAt: string;
  updatedAt: string | null;
}

export interface RoleDto {
  id: string;
  guildId: string;
  name: string;
  color: string;
  position: number;
  permissions: string[];
}

export interface GuildInviteDto {
  code: string;
  guildId: string;
  guildName: string;
  url: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
}

export interface PresignUploadResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

export interface VoiceStatePayload {
  guildId: string;
  channelId: string | null;
  user: VoiceMemberSummary;
  action: 'join' | 'leave' | 'update';
}

export const SocketEvents = {
  MESSAGE_CREATE: 'message:create',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  TYPING_START: 'typing:start',
  PRESENCE_UPDATE: 'presence:update',
  CHANNEL_JOIN: 'channel:join',
  CHANNEL_LEAVE: 'channel:leave',
  VOICE_STATE: 'voice:state',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface VoiceTokenResponse {
  token: string;
  url: string;
  roomName: string;
}

export interface GifDto {
  id: string;
  url: string;
  previewUrl: string;
  label: string;
}

/** @deprecated Use GifDto — Tenor API kapatıldı, Klipy kullanılıyor */
export type TenorGifDto = GifDto;
