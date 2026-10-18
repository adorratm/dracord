export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE';

export type ChannelType =
  | 'TEXT'
  | 'VOICE'
  | 'CATEGORY'
  | 'FORUM'
  | 'GAME'
  | 'WATCH_PARTY';

/** GAME kanalı alt türü (WATCH_PARTY ayrı ChannelType) */
export type GameChannelKind =
  | 'billiards'
  | 'okey'
  | 'bowling'
  | 'tavla'
  | 'blackjack'
  | 'trivia'
  | 'words';

/** API + istemciler için tek kaynak — GAME createChannel allowlist */
export const GAME_CHANNEL_KINDS: readonly GameChannelKind[] = [
  'billiards',
  'okey',
  'bowling',
  'tavla',
  'blackjack',
  'trivia',
  'words',
] as const;

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

export {
  DESKTOP_GAME_BY_APP_ID,
  desktopGameImageUrl,
  desktopGameName,
} from './desktop-games';
export type { DesktopGameEntry } from './desktop-games';

/** Discord tarzı canlı aktivite (oyun / dinleme / izleme) */
export type UserActivityType = 'playing' | 'watching' | 'listening' | 'custom';
export type UserActivitySource = 'dracord' | 'spotify' | 'desktop' | 'manual';

export interface UserActivity {
  type: UserActivityType;
  name: string;
  details?: string | null;
  startedAt?: string | null;
  source: UserActivitySource;
  /** Kapak / ikon URL (Spotify albüm vb.) */
  imageUrl?: string | null;
  /** Spotify / harici deep link */
  url?: string | null;
  join?: {
    guildId: string;
    channelId: string;
    sessionId?: string;
  } | null;
  /** Masaüstü algılama için exe adı (gizli tutulabilir) */
  desktopAppId?: string | null;
  /** Bu aktivitenin geçerlilik sonu (ISO) — TTL */
  expiresAt?: string | null;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: PresenceStatus;
  customStatus?: string | null;
  /** Canlı aktivite — gizlilik ayarına göre null olabilir */
  activity?: UserActivity | null;
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
  /** Yalnızca kendi profilinde: 2FA açık mı */
  twoFactorEnabled?: boolean;
  /** Platform süper admin (ADMIN_EMAILS) */
  isPlatformAdmin?: boolean;
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
  /** Ekran paylaşımı aktif */
  screenSharing?: boolean;
  /** ISO timestamp — kanala katıldığı an (kişi başına süre için) */
  joinedAt?: string;
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

export type DiscoverCategory =
  | 'gaming'
  | 'music'
  | 'entertainment'
  | 'tech'
  | 'education';

export const DISCOVER_CATEGORIES: { id: DiscoverCategory; label: string }[] = [
  { id: 'gaming', label: 'Oyun' },
  { id: 'music', label: 'Müzik' },
  { id: 'entertainment', label: 'Eğlence' },
  { id: 'tech', label: 'Bilim ve Teknoloji' },
  { id: 'education', label: 'Eğitim' },
];

/** Keşfet → Uygulamalar (web / desktop / mobil ortak) */
export type DiscoverCuratedApp = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  kind: 'game' | 'utility';
  /** GAME kanalı gameKind eşlemesi */
  gameChannelHint?: string;
  /** Web / desktop kart gradient (Tailwind) */
  gradient: string;
  /** Mobil kart vurgu rengi */
  accent: string;
};

export const DISCOVER_CURATED_APPS: DiscoverCuratedApp[] = [
  {
    id: 'billiards',
    name: 'Bilardo',
    tagline: 'Masada rastgele oyun',
    description: 'Sunucundaki oyun kanalında bilardo masası aç ve arkadaşlarınla oyna.',
    icon: 'sports_bar',
    kind: 'game',
    gameChannelHint: 'billiards',
    gradient: 'from-emerald-700/80 via-teal-800/50 to-surface-container-high',
    accent: '#0d9488',
  },
  {
    id: 'okey',
    name: 'Okey',
    tagline: 'Klasik masa oyunu',
    description: 'Dört kişilik okey masası — oyun kanalından Başlat.',
    icon: 'grid_view',
    kind: 'game',
    gameChannelHint: 'okey',
    gradient: 'from-amber-700/70 via-orange-900/40 to-surface-container-high',
    accent: '#d97706',
  },
  {
    id: 'blackjack',
    name: '21 Blackjack',
    tagline: 'Kurpiyere karşı',
    description: '4 kişilik blackjack masası — kart al, dur, double.',
    icon: 'style',
    kind: 'game',
    gameChannelHint: 'blackjack',
    gradient: 'from-emerald-800/70 via-green-950/50 to-surface-container-high',
    accent: '#059669',
  },
  {
    id: 'bowling',
    name: 'Bowling',
    tagline: 'Şeritlerde skor',
    description: 'Oyun kanalında bowling — tur at, skor tut, arkadaşlarınla yarış.',
    icon: 'sports_martial_arts',
    kind: 'game',
    gameChannelHint: 'bowling',
    gradient: 'from-sky-700/70 via-cyan-900/40 to-surface-container-high',
    accent: '#0284c7',
  },
  {
    id: 'tavla',
    name: 'Tavla',
    tagline: 'Klasik ikili masa',
    description: 'İki kişilik tavla — oyun kanalından Başlat.',
    icon: 'casino',
    kind: 'game',
    gameChannelHint: 'tavla',
    gradient: 'from-rose-700/70 via-red-950/40 to-surface-container-high',
    accent: '#e11d48',
  },
  {
    id: 'watch',
    name: 'Watch Party',
    tagline: 'Birlikte izle',
    description: 'Watch Party kanalında video senkronu, ses ve sohbet.',
    icon: 'live_tv',
    kind: 'utility',
    gradient: 'from-indigo-700/70 via-violet-900/40 to-surface-container-high',
    accent: '#6366f1',
  },
  {
    id: 'trivia',
    name: 'Trivia',
    tagline: 'Bilgi yarışması',
    description: 'Çoktan seçmeli sorular — arkadaşlarınla puan kapışması.',
    icon: 'quiz',
    kind: 'game',
    gameChannelHint: 'trivia',
    gradient: 'from-fuchsia-700/70 via-purple-950/40 to-surface-container-high',
    accent: '#c026d3',
  },
  {
    id: 'words',
    name: 'Kelime',
    tagline: 'Harf tahmin',
    description: 'Gizli kelimeyi harf harf bul — adam asmaca tarzı.',
    icon: 'spellcheck',
    kind: 'game',
    gameChannelHint: 'words',
    gradient: 'from-lime-700/70 via-green-950/40 to-surface-container-high',
    accent: '#65a30d',
  },
];

export interface GuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  bannerUrl?: string | null;
  ownerId: string;
  discoverable?: boolean;
  /** Keşfet kategorisi (varsayılan gaming) */
  discoverCategory?: DiscoverCategory;
  memberCount?: number;
  /** Keşfet’te platform admin pin */
  discoverPinned?: boolean;
  discoverPinOrder?: number | null;
  /** AFK ses kanalı */
  afkChannelId?: string | null;
  /** Konuşmadan sonra AFK’ya taşıma (dakika); 0 = kapalı */
  afkTimeoutMinutes?: number;
  /** Aktif takviye sayısı */
  boostCount?: number;
  /** 0–3 (eşikler: 2 / 7 / 14) */
  boostLevel?: number;
}

export function guildBoostLevel(boostCount: number): number {
  if (boostCount >= 14) return 3;
  if (boostCount >= 7) return 2;
  if (boostCount >= 2) return 1;
  return 0;
}

export interface CategoryDto {
  id: string;
  guildId: string;
  name: string;
  position: number;
}

export interface ChannelSummary {
  id: string;
  guildId: string | null;
  name: string;
  type: ChannelType;
  /** GAME kanalları için */
  gameKind?: GameChannelKind | null;
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
  /** DM kanalı kimliği (guild dışı) */
  dmChannelId?: string | null;
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
  /** Kanal izin overwrite’ları */
  permissionOverwrites?: Array<{
    id: string;
    type: 'role' | 'member';
    allow: string[];
    deny: string[];
  }>;
}

export interface MessageAttachment {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface MessageEmbedAction {
  id: string;
  label: string;
  /** Harici link (YouTube vb.) */
  url?: string | null;
  /** Uygulama içi eylem: replay | lyrics */
  action?: 'replay' | 'lyrics' | 'open' | null;
}

export interface MessageEmbed {
  url: string;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  /** Müzik / bot butonları */
  actions?: MessageEmbedAction[];
}

export interface MessageReactionUserDto {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface MessageReactionDto {
  emoji: string;
  count: number;
  me: boolean;
  /** Tepki bırakanlar (hover popover) */
  users?: MessageReactionUserDto[];
}

export interface MessagePollOptionDto {
  id: string;
  text: string;
  voteCount: number;
  voted: boolean;
  /** Son oy verenler (avatar strip) */
  voters?: MessageReactionUserDto[];
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
  /** Thread kökü (yanıtlar bu id altında) */
  threadRootId?: string | null;
  /** Ana akışta: bu mesaja bağlı thread yanıt sayısı */
  threadReplyCount?: number;
  forwardedFrom?: MessageForwardedFrom | null;
  attachments?: MessageAttachment[];
  embeds?: MessageEmbed[];
  reactions?: MessageReactionDto[];
  poll?: MessagePollDto | null;
  /** Görüntüleyen bu mesajı gizlediyse */
  viewerHide?: MessageViewerHide;
  /** Görüntüleyen yer imine eklediyse */
  bookmarked?: boolean;
  /** Görüntüleyen için bekleyen hatırlatma varsa */
  reminderAt?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface MessageBookmarkDto {
  id: string;
  messageId: string;
  channelId: string;
  channelName: string | null;
  guildId: string | null;
  createdAt: string;
  message: MessageDto;
}

export type MessageReminderStatus = 'pending' | 'fired' | 'cancelled' | 'snoozed';

export interface MessageReminderDto {
  id: string;
  messageId: string;
  channelId: string | null;
  channelName: string | null;
  guildId: string | null;
  remindAt: string;
  status: MessageReminderStatus;
  snoozedUntil: string | null;
  createdAt: string;
  message: MessageDto | null;
}

export type GuildPermission =
  | 'ADMINISTRATOR'
  | 'MANAGE_GUILD'
  | 'MANAGE_CHANNELS'
  | 'MANAGE_MESSAGES'
  | 'MANAGE_ROLES'
  | 'KICK_MEMBERS'
  | 'BAN_MEMBERS'
  | 'MOVE_MEMBERS'
  | 'MODERATE_MEMBERS'
  | 'VIEW_CHANNELS'
  | 'SEND_MESSAGES'
  | 'CREATE_POLLS'
  | 'ADD_REACTIONS';

export interface GuildPermissionsDto {
  guildId: string;
  owner: boolean;
  permissions: GuildPermission[];
  /** Platform süper admin — tüm yetkiler */
  platformAdmin?: boolean;
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
  /** Thread içi mesajlarda kök mesaj id; kökte null */
  threadRootId?: string | null;
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
  action: 'join' | 'leave' | 'update' | 'move';
  /** action=move iken hedef ses kanalı */
  targetChannelId?: string | null;
}

/** Sunucu ses roster snapshot — kanala girmeden sidebar için */
export interface VoiceSyncPayload {
  guildId: string;
  /** channelId → odadaki üyeler (boş kanallar genelde yok) */
  membersByChannel: Record<string, VoiceMemberSummary[]>;
}

export type NotificationType =
  | 'MENTION'
  | 'ANNOUNCEMENT'
  | 'SYSTEM'
  | 'FRIEND'
  | 'DM'
  | 'REMINDER';

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
  /** İstemci ister / sunucu guild roster snapshot gönderir */
  VOICE_SYNC: 'voice:sync',
  /**
   * Aynı kullanıcının başka istemcisi (web/desktop/mobil/sekme) sesi aldı.
   * Eski istemci LiveKit’i bırakır; presence kanalda kalır.
   */
  VOICE_TAKEOVER: 'voice:takeover',
  /** DM / grup DM ses-görüntü araması */
  DM_CALL: 'dm:call',
  NOTIFICATION_CREATE: 'notification:create',
  REACTION_UPDATE: 'reaction:update',
  ACTIVITY_UPSERT: 'activity:upsert',
  ACTIVITY_STATE: 'activity:state',
  ACTIVITY_LEAVE: 'activity:leave',
} as const;

/** Aktif ses istemcisi değişimi — yalnızca hedef kullanıcının soketlerine gider */
export interface VoiceTakeoverPayload {
  /** Yeni lider istemci kimliği */
  clientId: string;
  channelId: string;
  guildId: string;
  platform?: string | null;
}

export type ActivityKind =
  | 'billiards'
  | 'okey'
  | 'bowling'
  | 'tavla'
  | 'blackjack'
  | 'trivia'
  | 'words'
  | 'watch_party';

export type ActivityStatus = 'lobby' | 'playing' | 'ended';

export interface ActivitySessionDto {
  id: string;
  guildId: string;
  /** GAME veya WATCH_PARTY kanal id */
  channelId: string;
  kind: ActivityKind;
  hostUserId: string;
  minPlayers: number;
  maxPlayers: number;
  status: ActivityStatus;
  playerIds: string[];
  spectatorIds: string[];
  state: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** DM aramalarında presence için sentetik guild id */
export const DM_CALL_GUILD_ID = '__dm__';

export type DmCallMode = 'audio' | 'video';

export interface DmCallPayload {
  action: 'ring' | 'join' | 'leave' | 'ended' | 'invite' | 'decline';
  channelId: string;
  mode: DmCallMode;
  fromUserId: string;
  fromDisplayName?: string;
  targetUserId?: string | null;
}

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthTwoFactorChallenge {
  requires2fa: true;
  challengeToken: string;
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
    /** Sekme kapalıyken Web Push */
    pushEnabled?: boolean;
    soundEnabled: boolean;
    /** Ses kanalı katılma/ayrılma UI tonları (0–1) */
    uiToneVolume?: number;
    unreadBadge: boolean;
    mentionsOnly: boolean;
    quietHours: boolean;
    /** Sessize alınan kullanıcı / kanal / sunucu id’leri */
    mutedUserIds?: string[];
    mutedChannelIds?: string[];
    mutedGuildIds?: string[];
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
    /** Sol rail favori sunucu id’leri (üstte) */
    favoriteGuildIds: string[];
    /** Sol rail özel sıra (favoriler + diğerleri) */
    guildOrderIds: string[];
    /** Yalnızca bu kullanıcıda görünen sunucu skin’leri */
    guildSkins: Record<
      string,
      {
        accent?: string;
        sidebarTint?: string;
        density?: 'compact' | 'comfy';
      }
    >;
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
    /** Spotify dinleme durumunu profilde göster */
    shareSpotify?: boolean;
    /** Masaüstü oyun algılamayı paylaş */
    shareDesktopActivity?: boolean;
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
  /** 3D lounge / watch party karakteri */
  avatar3d: {
    color: string;
    xp: number;
    speed: number;
    x: number;
    z: number;
  };
  /** Özel sticker kütüphanesi (cihazlar arası senkron) */
  stickers: {
    custom: Array<{
      id: string;
      kind: 'emoji' | 'image';
      value: string;
      label: string;
      contentType?: string;
      createdAt: number;
    }>;
    favoriteIds: string[];
    recentIds: string[];
  };
}

export interface GuildEventDto {
  id: string;
  guildId: string;
  channelId: string | null;
  creatorId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  coverUrl: string | null;
  status: 'scheduled' | 'cancelled' | 'ended';
  createdAt: string;
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

export {
  APP_TOUR_STEPS,
  APP_TOUR_STORAGE_KEY,
  APP_TOUR_STORAGE_KEY_LEGACY,
  APP_TOUR_STORAGE_KEY_LEGACY_DESKTOP,
  appTourTargetSelector,
  hasCompletedAppTour,
  markAppTourCompleted,
  parseAppTourCompleted,
  resetAppTour,
  serializeAppTourCompleted,
} from './app-tour';
export type { AppTourMood, AppTourStep } from './app-tour';
