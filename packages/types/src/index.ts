export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE';

export type ChannelType = 'TEXT' | 'VOICE' | 'CATEGORY';

export interface SocialLinks {
  website?: string;
  twitter?: string;
  github?: string;
  discord?: string;
  youtube?: string;
  instagram?: string;
  twitch?: string;
  linkedin?: string;
  steam?: string;
  spotify?: string;
  tiktok?: string;
  facebook?: string;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: PresenceStatus;
  customStatus?: string | null;
  usernameConfirmed?: boolean;
  bannerColor?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  accentColor?: string | null;
  socialLinks?: SocialLinks | null;
  /** true ise link/medya önizlemeleri sansürlü (bulanık / gizli) gösterilir */
  censorLinkPreviews?: boolean;
  /** Sistem / müzik botu */
  isBot?: boolean;
  /** Sunucu üyeliğinde dolu — rol rozetleri */
  roles?: MemberRoleSummary[];
}

/** Animasyonlu rol rozeti stilleri */
export type RoleBadgeKey =
  | 'none'
  | 'crown'
  | 'shield'
  | 'star'
  | 'fire'
  | 'sparkle'
  | 'diamond'
  | 'heart';

/** Profil kartı arka plan temaları */
export type RoleProfileBgKey =
  | 'none'
  | 'aurora'
  | 'ember'
  | 'ocean'
  | 'noir'
  | 'candy'
  | 'mint'
  | 'sunset';

export interface MemberRoleSummary {
  id: string;
  name: string;
  color: string;
  position: number;
  badgeKey?: RoleBadgeKey | null;
  profileBgKey?: RoleProfileBgKey | null;
  hoist?: boolean;
}

export interface FriendPendingLists {
  incoming: PublicUser[];
  outgoing: PublicUser[];
}

export interface VoiceMemberSummary {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  muted?: boolean;
  deafened?: boolean;
  isBot?: boolean;
  speaking?: boolean;
}

/** Müzik kuyruk parçası */
export const DRACORD_BOT_USER_ID = 'system-dracord-bot';

export interface MusicTrack {
  id: string;
  title: string;
  url: string;
  /** yt-dlp için nihai YouTube URL veya ytsearch ifadesi */
  source: string;
  requestedById: string;
  requestedByName: string;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
}

export interface MusicQueueState {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  nowPlaying: MusicTrack | null;
  queue: MusicTrack[];
  paused: boolean;
  volume: number;
}

export type MusicJobType =
  | 'ensure_session'
  | 'play_next'
  | 'skip'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'set_volume';

export interface MusicJobPayload {
  type: MusicJobType;
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
  volume?: number;
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
  /** Görüntüleyen için okunmamış mesaj var mı */
  unread?: boolean;
  /** Okunmamış mesaj sayısı (TEXT / DM) */
  unreadCount?: number;
  lastReadMessageId?: string | null;
  /** Self-DM (notlar) kanalı */
  selfNotes?: boolean;
  /** DM karşı taraf */
  peerUserId?: string | null;
  peerAvatarUrl?: string | null;
  peerStatus?: PresenceStatus | null;
  /** Ses kanalı kilitli mi */
  locked?: boolean;
  /** Şifre var mı (hash asla gönderilmez) */
  hasPassword?: boolean;
  /** Odaya girmesi engellenen kullanıcı id’leri (yalnızca yetkiliye) */
  deniedUserIds?: string[];
}

export interface MessageAttachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface MessageEmbed {
  url: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
}

export interface MessageReactionDto {
  emoji: string;
  count: number;
  me: boolean;
}

export interface MessagePollOptionDto {
  id: string;
  text: string;
  voteCount: number;
  voted: boolean;
}

export interface MessagePollDto {
  question: string;
  options: MessagePollOptionDto[];
  multi: boolean;
  totalVotes: number;
  closed: boolean;
}

export type MessageViewerHide = 'hidden' | 'suppressed' | null;

export type MessageType = 'default' | 'heading';

export interface MessageReplyRef {
  id: string;
  authorId: string;
  authorName: string;
  contentPreview: string;
}

export interface MessageForwardedFrom {
  messageId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  contentPreview: string;
  createdAt: string;
}

export interface MessageDto {
  id: string;
  channelId: string;
  author: PublicUser;
  content: string;
  type?: MessageType;
  replyTo?: MessageReplyRef | null;
  pinnedAt?: string | null;
  forwardedFrom?: MessageForwardedFrom | null;
  attachments?: MessageAttachment[];
  embeds?: MessageEmbed[];
  reactions?: MessageReactionDto[];
  poll?: MessagePollDto | null;
  /** Görüntüleyen bu mesajı gizlediyse */
  viewerHide?: MessageViewerHide;
  createdAt: string;
  updatedAt: string | null;
}

export type GuildPermission =
  | 'ADMINISTRATOR'
  | 'MANAGE_GUILD'
  | 'MANAGE_CHANNELS'
  | 'MANAGE_MESSAGES'
  | 'MANAGE_ROLES'
  | 'KICK_MEMBERS'
  | 'VIEW_CHANNELS'
  | 'SEND_MESSAGES'
  | 'CREATE_POLLS'
  | 'ADD_REACTIONS';

export interface GuildPermissionsDto {
  guildId: string;
  owner: boolean;
  permissions: GuildPermission[];
}

export interface MessagePage {
  items: MessageDto[];
  hasMore: boolean;
}

export interface SearchHitGuild {
  type: 'guild';
  id: string;
  name: string;
  iconUrl: string | null;
  discoverable?: boolean;
}

export interface SearchHitChannel {
  type: 'channel';
  id: string;
  guildId: string | null;
  name: string;
  channelType: ChannelType;
}

export interface SearchHitUser {
  type: 'user';
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface SearchHitMessage {
  type: 'message';
  id: string;
  channelId: string;
  guildId: string | null;
  dmChannelId: string | null;
  authorId: string;
  authorName: string;
  content: string;
  snippet: string;
  createdAt: string;
}

export type SearchHit =
  | SearchHitGuild
  | SearchHitChannel
  | SearchHitUser
  | SearchHitMessage;

export interface SearchResponse {
  query: string;
  hits: SearchHit[];
}

export interface RoleDto {
  id: string;
  guildId: string;
  name: string;
  color: string;
  position: number;
  permissions: string[];
  badgeKey?: RoleBadgeKey | null;
  profileBgKey?: RoleProfileBgKey | null;
  hoist?: boolean;
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

export type NotificationType = 'MENTION' | 'ANNOUNCEMENT' | 'SYSTEM' | 'FRIEND' | 'DM';

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  actorId: string | null;
  guildId: string | null;
  channelId: string | null;
  messageId: string | null;
  readAt: string | null;
  createdAt: string;
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
  NOTIFICATION_CREATE: 'notification:create',
  REACTION_UPDATE: 'reaction:update',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Kullanıcı istemci ayarları (Discord tarzı tercihler) */
export type DmPrivacyLevel = 'everyone' | 'friends' | 'nobody';

export interface ClientSettings {
  privacy: {
    dmFilter: DmPrivacyLevel;
    allowFriendRequests: boolean;
    shareActivityStatus: boolean;
    dataCollection: boolean;
    personalizeAds: boolean;
    /** Profil alan görünürlüğü (başkalarına) — varsayılan true */
    showBio?: boolean;
    showSocialLinks?: boolean;
    showBanner?: boolean;
    showCustomStatus?: boolean;
  };
  messaging: {
    whoCanDm: DmPrivacyLevel;
    filterExplicit: boolean;
    autoEmbed: boolean;
    spellcheck: boolean;
  };
  notifications: {
    desktopEnabled: boolean;
    soundEnabled: boolean;
    unreadBadge: boolean;
    mentionsOnly: boolean;
    quietHours: boolean;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    messageGrouping: boolean;
    underlineLinks: boolean;
    roleColors: boolean;
  };
  appearance: {
    theme: 'dark' | 'light';
    messageDensity: 'cozy' | 'compact';
  };
  system: {
    openOnStartup: boolean;
    hardwareAcceleration: boolean;
    minimizeToTray: boolean;
    autoUpdate: boolean;
  };
  language: {
    locale: 'tr' | 'en';
    hour24: boolean;
  };
  activity: {
    displayActivity: boolean;
    shareGames: boolean;
    allowJoinRequests: boolean;
  };
  developer: {
    developerMode: boolean;
    experimental: boolean;
  };
  family: {
    activitySummary: boolean;
    parentalControls: boolean;
    members: Array<{ id: string; displayName: string; role: 'parent' | 'teen' }>;
    inviteCode: string | null;
  };
  security: {
    twoFactorEnabled: boolean;
    twoFactorSecret: string | null;
    recoveryCodes: string[];
  };
  billing: {
    nitroPlan: 'none' | 'basic' | 'nitro';
    nitroExpiresAt: string | null;
    boostCredits: number;
    boostAssignments: Array<{ guildId: string; guildName: string }>;
    gifts: Array<{
      id: string;
      kind: 'nitro' | 'boost';
      label: string;
      code: string;
      redeemed: boolean;
    }>;
    paymentMethods: Array<{ id: string; brand: string; last4: string }>;
    invoices: Array<{ id: string; label: string; amount: string; at: string }>;
  };
  connections: {
    apps: Array<{ id: string; name: string; connectedAt: string }>;
  };
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
