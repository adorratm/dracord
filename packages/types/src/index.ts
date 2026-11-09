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
  desktopGameUrl,
} from './desktop-games';
export type { DesktopGameEntry } from './desktop-games';

export {
  toSpotifyAppUri,
  toSpotifyWebUrl,
  isSpotifyUrl,
} from './spotify-link';

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
  /** Birincil canlı aktivite (öncelik: dracord > desktop > spotify) */
  activity?: UserActivity | null;
  /** Tüm canlı aktiviteler — oyun + Spotify aynı anda (alt alta) */
  activities?: UserActivity[] | null;
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
  /** Özel davet adresi: dracord.com.tr/s/<vanityCode> ve /invite/<vanityCode> */
  vanityCode?: string | null;
  /** Herkese açık tanıtım sayfası (B3) */
  publicPage?: boolean;
  publicDescription?: string | null;
  /** Sunucu rozeti (B4) — üyeler profilinde gösterebilir */
  badgeTag?: string | null;
  badgeEmoji?: string | null;
}

// ── Sunucu rozeti + profil vitrini (B4) ──
export const GUILD_BADGE_LIMITS = { tagMin: 2, tagMax: 5, emojiMax: 16 } as const;
const BADGE_RESERVED = new Set(['DRCD', 'DRACO', 'ADMIN', 'MOD', 'STAFF', 'RESMI', 'SYS']);
/** Büyük harf; A-Z, 0-9 ve Türkçe harfler. Geçersizse null. */
export function normalizeBadgeTag(raw: string): string | null {
  const t = String(raw ?? '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, '');
  if (t.length < GUILD_BADGE_LIMITS.tagMin || t.length > GUILD_BADGE_LIMITS.tagMax) return null;
  if (!/^[A-Z0-9ÇĞİÖŞÜ]+$/.test(t)) return null;
  if (BADGE_RESERVED.has(t)) return null;
  return t;
}
/** Tek emoji (veya boş). Harf/rakam/URL içeremez. */
export function normalizeBadgeEmoji(raw: string | null | undefined): string | null {
  const e = String(raw ?? '').trim();
  if (!e) return null;
  if (e.length > GUILD_BADGE_LIMITS.emojiMax) return null;
  if (/[\p{L}\p{N}\s<>:/]/u.test(e.replace(/[\u200d\ufe0f]/g, ''))) return null;
  return e;
}

export interface GuildBadgeDto {
  guildId: string;
  name: string;
  iconUrl: string | null;
  tag: string;
  emoji: string | null;
  /** Tanıtım sayfası açıksa */
  vanityCode: string | null;
}

export interface UserShowcaseDto {
  userId: string;
  badge: GuildBadgeDto | null;
  /** O sunucudaki seviye (varsa) */
  level: number | null;
}

// ── Sunucu tanıtım sayfası + özel URL (B3) ──
export const VANITY_LIMITS = { min: 3, max: 32, descMax: 1000 } as const;
/** Ürün yolları / marka ile çakışmasın */
export const VANITY_RESERVED = new Set([
  'admin', 'api', 'app', 'auth', 'channels', 'dracord', 'destek', 'discover', 'download', 'embed', 'help',
  'invite', 'kesfet', 'legal', 'login', 'logout', 'me', 'oauth', 'official', 'resmi', 'settings', 'support',
  'status', 'staff', 'team', 'www', 'yardim', 'moderator', 'mod', 'system', 'sistem', 'everyone', 'here',
]);
/** Küçük harf, a-z 0-9 ve tire; baş/son tire yok. Geçersizse null. */
export function normalizeVanityCode(raw: string): string | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u0307/g, '')
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/\s+/g, '-');
  if (v.length < VANITY_LIMITS.min || v.length > VANITY_LIMITS.max) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(v) || v.includes('--')) return null;
  if (VANITY_RESERVED.has(v)) return null;
  return v;
}

export interface GuildPublicPageDto {
  id: string;
  name: string;
  vanityCode: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  description: string | null;
  category: DiscoverCategory;
  memberCount: number;
  /** Şu an ses kanallarında olan kişi */
  inVoiceCount: number;
  boostLevel: number;
  createdAt: string;
  /** Herkese açık metin kanalı adları (en fazla 8) */
  channels: string[];
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
  /** Ses kanalı durum metni (istemci tarafında birleştirilir; VOICE_CHANNEL_STATUS) */
  voiceStatus?: string | null;
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
  peerActivity?: UserActivity | null;
  peerActivities?: UserActivity[] | null;
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
  /** Sesli mesaj (A1) — oynatıcı dalga formu ile gösterilir */
  voice?: boolean;
  /** Ses süresi (sn) */
  durationSec?: number;
  /** 0–255 genlik örnekleri (≤ VOICE_WAVEFORM_POINTS) */
  waveform?: number[];
}

export const VOICE_MESSAGE_MAX_SEC = 300;
export const VOICE_WAVEFORM_POINTS = 48;

/** Sesli mesaj ek alanlarını güvenli aralığa çek (sunucu + istemci) */
export function sanitizeVoiceAttachment<T extends MessageAttachment>(a: T): T {
  if (!a.voice && a.durationSec === undefined && a.waveform === undefined) return a;
  const out = { ...a } as T;
  const isAudio = typeof a.contentType === 'string' && a.contentType.startsWith('audio/');
  out.voice = Boolean(a.voice) && isAudio;
  if (a.durationSec !== undefined) {
    const d = Number(a.durationSec);
    out.durationSec = Number.isFinite(d) ? Math.min(VOICE_MESSAGE_MAX_SEC, Math.max(0, Math.round(d * 10) / 10)) : undefined;
  }
  if (a.waveform !== undefined) {
    out.waveform = Array.isArray(a.waveform)
      ? a.waveform
          .slice(0, VOICE_WAVEFORM_POINTS)
          .map((v) => Math.min(255, Math.max(0, Math.round(Number(v) || 0))))
      : undefined;
  }
  return out;
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

/** Zamanlanmış mesaj — sendAt zamanı gelince yazar adına normal mesaj olarak gönderilir */
export type ScheduledMessageStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface ScheduledMessageDto {
  id: string;
  channelId: string;
  guildId: string | null;
  channelName: string | null;
  content: string;
  attachments: MessageAttachment[];
  replyToId: string | null;
  sendAt: string;
  status: ScheduledMessageStatus;
  /** Gönderilince oluşan mesaj */
  sentMessageId: string | null;
  error: string | null;
  createdAt: string;
}

export const SCHEDULED_MESSAGE_LIMITS = {
  /** En erken (ms) */
  minDelayMs: 60_000,
  /** En geç (ms) — 30 gün */
  maxDelayMs: 30 * 24 * 60 * 60 * 1000,
  /** Kullanıcı başına bekleyen */
  maxPendingPerUser: 25,
} as const;

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
  /** channelId → ses kanalı durum metni (yalnız dolu kanallar) */
  statusByChannel?: Record<string, VoiceChannelStatusPayload>;
}

/** Ses kanalı durum metni — en fazla VOICE_CHANNEL_STATUS_MAX karakter */
export const VOICE_CHANNEL_STATUS_MAX = 100;

export interface VoiceChannelStatusPayload {
  guildId: string;
  channelId: string;
  /** null = temizlendi */
  status: string | null;
  setById?: string | null;
  setByName?: string | null;
  updatedAt: string;
}

/** Durum metnini normalize et (istemci + sunucu aynı kural) */
export function normalizeVoiceChannelStatus(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return [...t].slice(0, VOICE_CHANNEL_STATUS_MAX).join('');
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
  /** Profil / avatar / banner / displayName anlık güncelleme */
  USER_UPDATE: 'user:update',
  CHANNEL_JOIN: 'channel:join',
  CHANNEL_LEAVE: 'channel:leave',
  VOICE_STATE: 'voice:state',
  /** İstemci ister / sunucu guild roster snapshot gönderir */
  VOICE_SYNC: 'voice:sync',
  /** Ses kanalı durum metni (ör. "Valorant ranked") — kanaldakiler ayarlar, kanal boşalınca silinir */
  VOICE_CHANNEL_STATUS: 'voice:channel-status',
  /** Seviye atlama (guild odası) */
  LEVEL_UP: 'level:up',
  /** Soundboard çal (istemci → sunucu → aynı ses kanalı) */
  SOUNDBOARD_PLAY: 'soundboard:play',
  /** Harici oyun oturumu (ses kanalı) güncellendi */
  GAME_SESSION_UPDATE: 'game:session',
  /** C2 turnuva oluşturuldu / güncellendi (guild odası) */
  TOURNAMENT_UPDATE: 'tournament:update',
  /** A4 ekran paylaşımı üzerine çizim (ses kanalındakilere) */
  SCREEN_ANNOTATE: 'screen:annotate',
  /**
   * Aynı kullanıcının başka istemcisi (web/desktop/mobil/sekme) sesi aldı.
   * Eski istemci LiveKit’i bırakır; presence kanalda kalır.
   */
  VOICE_TAKEOVER: 'voice:takeover',
  /** DM / grup DM ses-görüntü araması */
  DM_CALL: 'dm:call',
  /** Ekran paylaşımı uzak kontrol (tek controller) */
  REMOTE_CONTROL_REQUEST: 'remote-control:request',
  REMOTE_CONTROL_RESPONSE: 'remote-control:response',
  REMOTE_CONTROL_REVOKE: 'remote-control:revoke',
  REMOTE_CONTROL_STATE: 'remote-control:state',
  REMOTE_CONTROL_INPUT: 'remote-control:input',
  NOTIFICATION_CREATE: 'notification:create',
  REACTION_UPDATE: 'reaction:update',
  ACTIVITY_UPSERT: 'activity:upsert',
  ACTIVITY_STATE: 'activity:state',
  ACTIVITY_LEAVE: 'activity:leave',
} as const;

/** Uzak kontrol oturumu — kanal + paylaşan başına en fazla 1 controller */
export type RemoteControlStatus = 'idle' | 'pending' | 'active';

export interface RemoteControlStatePayload {
  guildId: string;
  channelId: string;
  /** Ekranı paylaşan kullanıcı */
  sharerId: string;
  status: RemoteControlStatus;
  /** İstek atan / aktif controller */
  controllerId: string | null;
  controllerName?: string | null;
  sharerName?: string | null;
  reason?: string | null;
}

export interface RemoteControlRequestPayload {
  guildId: string;
  channelId: string;
  sharerId: string;
}

export interface RemoteControlResponsePayload {
  guildId: string;
  channelId: string;
  sharerId: string;
  controllerId: string;
  accept: boolean;
}

export interface RemoteControlRevokePayload {
  guildId: string;
  channelId: string;
  sharerId: string;
  reason?: string;
}

/** Normalize edilmiş video koordinatları (0–1, object-contain içerik kutusu) */
export interface RemoteControlInputPayload {
  guildId: string;
  channelId: string;
  sharerId: string;
  type: 'move' | 'down' | 'up' | 'wheel' | 'key';
  nx?: number;
  ny?: number;
  button?: number;
  deltaY?: number;
  key?: string;
  code?: string;
  /** keydown | keyup */
  keyAction?: 'down' | 'up';
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/** Soket `user:update` — profil alanları (kısmi) */
export interface UserUpdatePayload {
  userId: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
  accentColor?: string | null;
  bio?: string | null;
  socialLinks?: SocialLinks | null;
}

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
  /** Optimistic concurrency — her başarılı state patch’te +1 (eski istemciler yok sayabilir) */
  stateVersion?: number;
  createdAt: string;
  updatedAt: string;
}

/** PATCH /activities/:id/state → 409 gövdesi */
export interface ActivityStateConflictBody {
  code: 'ACTIVITY_STATE_CONFLICT';
  message: string;
  session: ActivitySessionDto;
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
    /** Tema pack: default | midnight | rose | forest | nitro-aurora */
    themePack?: string;
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
  /** Masaüstü oyun overlay (Electron) */
  overlay: {
    enabled: boolean;
    /** Electron accelerator, örn. Control+Shift+` */
    hotkey: string;
    followDisplay: boolean;
    showMembers: boolean;
    showQuickChat: boolean;
    /** 0.4–1 */
    opacity: number;
    /** Watch Party session reklam ağı filtresi */
    watchPartyAdblock: boolean;
    /** Konuşan HUD (overlay kapalıyken de görünür, tıklanamaz) */
    hudEnabled: boolean;
    hudPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Aynı anda gösterilen konuşan sayısı (1–6) */
    hudMax: number;
    /** HUD altında CPU / RAM / saat */
    perfHud: boolean;
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
  /** RSVP sayısı */
  interestedCount?: number;
  /** Bu kullanıcı ilgileniyor mu */
  interestedByMe?: boolean;
  /** Sahne / stage etkinliği */
  isStage?: boolean;
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


// ─── Seviye / XP (B1) ───────────────────────────────────────────────

/** n → n+1 için gereken XP (MEE6 benzeri eğri) */
export function xpForLevelUp(level: number): number {
  const n = Math.max(0, Math.floor(level));
  return 5 * n * n + 50 * n + 100;
}

/** Toplam XP → seviye + seviye içi ilerleme */
export function levelFromXp(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
} {
  let xp = Math.max(0, Math.floor(totalXp));
  let level = 0;
  while (level < 1000) {
    const need = xpForLevelUp(level);
    if (xp < need) return { level, xpIntoLevel: xp, xpForNext: need };
    xp -= need;
    level += 1;
  }
  return { level, xpIntoLevel: 0, xpForNext: xpForLevelUp(level) };
}

export interface MemberLevelDto {
  guildId: string;
  userId: string;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  messageCount: number;
  voiceMinutes: number;
  /** Lider tablosundaki sıra (1 tabanlı) */
  rank?: number | null;
}

export interface LevelRoleReward {
  level: number;
  roleId: string;
}

export interface GuildLevelConfigDto {
  guildId: string;
  enabled: boolean;
  /** Seviye atlayınca: bildirim gönder / sessiz */
  announce: 'notification' | 'off';
  /** Mesaj XP aralığı (cooldown başına) */
  messageXpMin: number;
  messageXpMax: number;
  /** Ses dakikası başına XP (AFK kanalı hariç) */
  voiceXpPerMinute: number;
  roleRewards: LevelRoleReward[];
  /** XP kazanılmayan kanallar */
  noXpChannelIds: string[];
}

export interface LevelUpPayload {
  guildId: string;
  userId: string;
  level: number;
  grantedRoleIds: string[];
}


// ─── Soundboard (A2) ────────────────────────────────────────────────

// ── Ekran paylaşımına çizim (A4) ──
export const ANNOTATION_COLORS = ['#ff5555', '#f1fa8c', '#50fa7b', '#8be9fd', '#ff79c6', '#ffffff'] as const;
export const ANNOTATION_LIMITS = { pointsPerMessage: 48, strokeIdMax: 24, holdMs: 3500, fadeMs: 900 } as const;

export interface ScreenAnnotationPayload {
  guildId: string;
  channelId: string;
  /** Hangi paylaşımın üzerine (paylaşanın kullanıcı id'si) */
  sharerId: string;
  strokeId: string;
  /** ANNOTATION_COLORS indeksi */
  color: number;
  /** Normalize [x, y] (0–1, paylaşılan görüntüye göre) */
  points: Array<[number, number]>;
  /** Çizgi bitti */
  end?: boolean;
  /** Bu kullanıcının bu paylaşımdaki tüm çizgilerini sil */
  clear?: boolean;
  /** Sunucu doldurur */
  userId?: string;
  userName?: string | null;
}

/** İstemciden gelen çizim mesajını güvenli hale getir (sunucu + istemci) */
export function sanitizeAnnotation(raw: unknown): ScreenAnnotationPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
  const guildId = str(r.guildId, 64);
  const channelId = str(r.channelId, 64);
  const sharerId = str(r.sharerId, 64);
  const strokeId = str(r.strokeId, ANNOTATION_LIMITS.strokeIdMax);
  if (!guildId || !channelId || !sharerId || !strokeId || !/^[A-Za-z0-9_-]+$/.test(strokeId)) return null;
  const color = Math.max(0, Math.min(ANNOTATION_COLORS.length - 1, Math.floor(Number(r.color) || 0)));
  const pts: Array<[number, number]> = [];
  if (Array.isArray(r.points)) {
    for (const p of r.points.slice(0, ANNOTATION_LIMITS.pointsPerMessage)) {
      if (!Array.isArray(p)) continue;
      const x = Number(p[0]);
      const y = Number(p[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      pts.push([Math.round(Math.min(1, Math.max(0, x)) * 10000) / 10000, Math.round(Math.min(1, Math.max(0, y)) * 10000) / 10000]);
    }
  }
  const clear = r.clear === true;
  if (!clear && pts.length === 0 && r.end !== true) return null;
  return { guildId, channelId, sharerId, strokeId, color, points: pts, end: r.end === true, clear };
}

// ── Turnuva modu (C2) — tek eleme, 1v1 ──
export const TOURNAMENT_GAMES = ['tavla', 'billiards', 'bowling', 'words', 'trivia', 'external'] as const;
export type TournamentGame = (typeof TOURNAMENT_GAMES)[number];
export const TOURNAMENT_GAME_LABEL: Record<TournamentGame, string> = {
  tavla: 'Tavla',
  billiards: 'Bilardo',
  bowling: 'Bowling',
  words: 'Kelime',
  trivia: 'Bilgi yarışması',
  external: 'Harici oyun',
};
export const TOURNAMENT_LIMITS = { nameMax: 60, descMax: 500, minPlayers: 3, maxPlayers: 64, activePerGuild: 5 } as const;
export type TournamentStatus = 'registration' | 'running' | 'finished' | 'cancelled';
export type TournamentMatchStatus = 'waiting' | 'ready' | 'disputed' | 'done';

export interface TournamentMatch {
  id: string;
  /** 1 = ilk tur */
  round: number;
  index: number;
  p1: string | null;
  p2: string | null;
  winnerId: string | null;
  status: TournamentMatchStatus;
  /** oyuncuId → bildirdiği kazanan */
  reports: Record<string, string>;
  /** Rakipsiz geçiş */
  bye?: boolean;
}

export interface TournamentParticipant {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface TournamentDto {
  id: string;
  guildId: string;
  name: string;
  description: string | null;
  game: TournamentGame;
  /** game = external iken oyun adı */
  externalGameName: string | null;
  status: TournamentStatus;
  maxPlayers: number;
  creatorId: string;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  rounds: number;
  winnerId: string | null;
  startsAt: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Tek eleme sıralaması: 1. ve 2. tohum ancak finalde karşılaşır */
export function bracketSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

/**
 * Tohumlanmış oyunculardan (sıralı) tek eleme ağacı. Boşluklar (bye) üst tohumlara düşer
 * ve otomatik ilerletilir; iki boş aynı maçta asla olmaz.
 */
export function buildSingleElimination(seeded: string[]): { matches: TournamentMatch[]; rounds: number } {
  const n = seeded.length;
  let size = 2;
  while (size < n) size *= 2;
  const rounds = Math.log2(size);
  const order = bracketSeedOrder(size);
  const matches: TournamentMatch[] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    for (let i = 0; i < count; i++) {
      matches.push({ id: `r${r}m${i}`, round: r, index: i, p1: null, p2: null, winnerId: null, status: 'waiting', reports: {} });
    }
  }
  for (let i = 0; i < size / 2; i++) {
    const m = matches[i]!;
    m.p1 = seeded[order[2 * i]! - 1] ?? null;
    m.p2 = seeded[order[2 * i + 1]! - 1] ?? null;
  }
  for (let i = 0; i < size / 2; i++) {
    const m = matches[i]!;
    if (m.p1 && m.p2) m.status = 'ready';
    else {
      m.bye = true;
      advanceTournament(matches, m.id, (m.p1 ?? m.p2)!);
    }
  }
  return { matches, rounds };
}

/** Maçı bitir, kazananı sonraki tura taşı. Final bittiyse şampiyonu döndürür. */
export function advanceTournament(matches: TournamentMatch[], matchId: string, winnerId: string): string | null {
  const m = matches.find((x) => x.id === matchId);
  if (!m) throw new Error('match_not_found');
  m.winnerId = winnerId;
  m.status = 'done';
  const next = matches.find((x) => x.round === m.round + 1 && x.index === Math.floor(m.index / 2));
  if (!next) return winnerId;
  if (m.index % 2 === 0) next.p1 = winnerId;
  else next.p2 = winnerId;
  if (next.p1 && next.p2 && next.status === 'waiting') next.status = 'ready';
  return null;
}

// ── Haftalık görevler + sezon (C3) ──
export type ChallengeKind = 'messages' | 'voice' | 'xp';
export interface ChallengeDef {
  id: string;
  kind: ChallengeKind;
  target: number;
  rewardXp: number;
}
/** Kademeli havuz — her hafta her türden biri seçilir */
export const CHALLENGE_POOL: Record<ChallengeKind, Array<{ target: number; rewardXp: number }>> = {
  messages: [
    { target: 25, rewardXp: 150 },
    { target: 50, rewardXp: 300 },
    { target: 100, rewardXp: 550 },
  ],
  voice: [
    { target: 30, rewardXp: 150 },
    { target: 90, rewardXp: 350 },
    { target: 180, rewardXp: 600 },
  ],
  xp: [
    { target: 500, rewardXp: 200 },
    { target: 1200, rewardXp: 400 },
    { target: 2500, rewardXp: 700 },
  ],
};

/** Sunucu + hafta için belirlenimli görev seti (istemci ve sunucu aynı sonucu üretir) */
export function weeklyChallenges(guildId: string, week: string): ChallengeDef[] {
  let h = 2166136261;
  for (const ch of `${guildId}:${week}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (['messages', 'voice', 'xp'] as const).map((kind, i) => {
    const tiers = CHALLENGE_POOL[kind];
    const tier = tiers[((h >>> (i * 5)) & 31) % tiers.length]!;
    return { id: `${week}:${kind}`, kind, target: tier.target, rewardXp: tier.rewardXp };
  });
}

export function challengeLabel(c: Pick<ChallengeDef, 'kind' | 'target'>): string {
  return c.kind === 'messages'
    ? `${c.target} mesaj yaz`
    : c.kind === 'voice'
      ? `${c.target} dakika seste kal`
      : `${c.target} XP kazan`;
}

export interface ChallengeProgressDto extends ChallengeDef {
  label: string;
  progress: number;
  done: boolean;
  claimed: boolean;
}

export interface SeasonEntryDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  rank: number;
}

export interface ChallengesDto {
  guildId: string;
  /** Haftanın pazartesisi (YYYY-MM-DD, Europe/Istanbul) */
  week: string;
  weekEndsAt: string;
  /** YYYY-MM — sezon = takvim ayı */
  season: string;
  seasonEndsAt: string;
  enabled: boolean;
  challenges: ChallengeProgressDto[];
  weekly: SeasonEntryDto[];
  seasonBoard: SeasonEntryDto[];
  me: { weekScore: number; weekRank: number | null; seasonScore: number; seasonRank: number | null };
  /** Geçen sezonun ilk üçü */
  lastSeasonTop: SeasonEntryDto[];
}

// ── Sunucu istatistikleri (B2) ──
export const GUILD_STATS_RANGES = [7, 30, 90] as const;
export type GuildStatsRange = (typeof GUILD_STATS_RANGES)[number];

export interface GuildStatsDay {
  /** YYYY-MM-DD (Europe/Istanbul) */
  day: string;
  messages: number;
  /** O gün mesaj yazan farklı üye */
  activeMembers: number;
  joins: number;
  leaves: number;
  voiceMinutes: number;
}

export interface GuildStatsDto {
  guildId: string;
  days: GuildStatsRange;
  generatedAt: string;
  memberCount: number;
  totals: {
    messages: number;
    activeMembers: number;
    joins: number;
    leaves: number;
    voiceMinutes: number;
  };
  /** Önceki eşit dönem (yüzde değişim için) */
  previous: { messages: number; activeMembers: number; joins: number };
  daily: GuildStatsDay[];
  topChannels: Array<{ channelId: string; name: string; messages: number }>;
  topMembers: Array<{ userId: string; displayName: string; avatarUrl: string | null; messages: number }>;
  /** Saat başına mesaj (0–23, Europe/Istanbul) */
  hourly: number[];
  /** Ayrılan/ses sayaçlarının tutulmaya başladığı gün (öncesi 0 görünür) */
  trackingSince: string | null;
}

export const SOUNDBOARD_LIMITS = {
  maxSoundsPerGuild: 24,
  maxDurationSec: 5.5,
  maxBytes: 512 * 1024,
  nameMax: 32,
  /** Kullanıcı başına çalma aralığı (ms) */
  playCooldownMs: 2000,
} as const;

export interface GuildSoundDto {
  id: string;
  guildId: string;
  name: string;
  emoji: string | null;
  url: string;
  contentType: string;
  durationSec: number;
  /** 0–1 */
  volume: number;
  createdById: string;
  createdAt: string;
}

export interface SoundboardPlayPayload {
  guildId: string;
  channelId: string;
  soundId: string;
  /** sunucu doldurur */
  userId?: string;
  userName?: string | null;
  url?: string;
  volume?: number;
  name?: string;
  emoji?: string | null;
}


// ─── "Ne kaçırdım?" (D1) — yapay zekâsız kanal özeti ───────────────

export interface CatchupMessageRef {
  id: string;
  authorId: string;
  authorName: string;
  avatarUrl?: string | null;
  contentPreview: string;
  createdAt: string;
  reactionCount?: number;
}

export interface CatchupDto {
  channelId: string;
  /** Bu zamandan sonrası özetlendi */
  since: string;
  totalNew: number;
  /** Sana bahsedenler */
  mentions: CatchupMessageRef[];
  /** En çok tepki alanlar */
  topReacted: CatchupMessageRef[];
  pinned: CatchupMessageRef[];
  polls: CatchupMessageRef[];
  links: Array<{ url: string; messageId: string; authorName: string }>;
  participants: Array<{ userId: string; name: string; avatarUrl?: string | null; count: number }>;
  /** Cihaz üstü özetleyici için ("Ad: mesaj" satırları, en yeni sonda) */
  transcript: string[];
}


// ─── Oyun platformu (C1) — herkes geliştirir, yayın admin onaylı ─────

export type GameAppStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'suspended';
export type GamePlatform = 'web' | 'desktop' | 'mobile';

export interface GameAppDto {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  iconUrl: string | null;
  coverUrl: string | null;
  /** Oyunun yüklendiği https adresi (iframe / WebView) */
  entryUrl: string;
  minPlayers: number;
  maxPlayers: number;
  orientation: 'any' | 'landscape' | 'portrait';
  platforms: GamePlatform[];
  status: GameAppStatus;
  /** Admin notu (red / askı gerekçesi) */
  reviewNote: string | null;
  ownerUserId: string;
  ownerName?: string | null;
  /** Yalnız sahibine */
  testerUserIds?: string[];
  secretLast4?: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameAppInput {
  name?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  iconUrl?: string | null;
  coverUrl?: string | null;
  entryUrl?: string;
  minPlayers?: number;
  maxPlayers?: number;
  orientation?: 'any' | 'landscape' | 'portrait';
  platforms?: GamePlatform[];
}

export interface GameSessionDto {
  id: string;
  gameId: string;
  game: Pick<GameAppDto, 'id' | 'name' | 'slug' | 'iconUrl' | 'entryUrl' | 'orientation' | 'maxPlayers' | 'status'>;
  guildId: string;
  channelId: string;
  hostUserId: string;
  participantIds: string[];
  status: 'active' | 'ended';
  createdAt: string;
}

/** Oyun iframe'ine verilen kısa ömürlü kimlik (10 dk) */
export interface GameLaunchDto {
  token: string;
  expiresAt: string;
  session: GameSessionDto;
  user: { id: string; username: string; displayName: string; avatarUrl: string | null };
}

/** Oyun sunucusunun POST /v1/games/verify yanıtı */
export interface GameTokenClaims {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  gameId: string;
  sessionId: string;
  guildId: string;
  channelId: string;
  participantIds: string[];
  /** Test modunda (onaysız oyun, sahip/testçi) */
  testMode: boolean;
  exp: number;
}

export const GAME_LIMITS = {
  maxGamesPerDeveloper: 10,
  maxTesters: 25,
  nameMax: 40,
  shortMax: 120,
  descMax: 4000,
} as const;

/**
 * Oyun gömme protokolü (host tarafı). Kaynak: packages/embedded-sdk/src/protocol.ts — DEĞİŞTİRİRKEN İKİSİNİ BİRLİKTE.
 */
export const GAME_EMBED = {
  version: 1,
  embedSource: 'dracord-embed',
  hostSource: 'dracord-host',
  nativeOrigin: 'dracord-native',
} as const;
