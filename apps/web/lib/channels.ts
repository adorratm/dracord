import type { CategoryDto, ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import type {
  SidebarCategory,
  SidebarChannelItem,
  SidebarChannelType,
  SidebarVoiceMember,
} from '@dracord/ui';

function sidebarType(ch: ChannelSummary): SidebarChannelType {
  if (ch.type === 'VOICE') return 'voice';
  if (ch.type === 'FORUM') return 'forum';
  if (ch.type === 'GAME') return 'game';
  if (ch.type === 'WATCH_PARTY') return 'watch';
  return 'text';
}

function mapChannelItem(
  ch: ChannelSummary,
  activeChannelId: string | undefined,
  onChannelClick: (channel: ChannelSummary) => void,
  extras?: {
    voiceMembersByChannel?: Record<string, VoiceMemberSummary[]>;
    selfUserId?: string;
    selfVoiceChannelId?: string | null;
    platformAdminIds?: Set<string>;
    onEditChannel?: (channel: ChannelSummary) => void;
    onDeleteChannel?: (channel: ChannelSummary) => void;
    onDropMember?: (userId: string, channel: ChannelSummary) => void;
    canDragVoiceMembers?: boolean;
    canDragSelf?: boolean;
    onReorderChannels?: (categoryId: string | null, orderedIds: string[]) => void;
    enrichVoiceMember?: (
      member: VoiceMemberSummary,
      voiceChannelId: string,
    ) => Pick<
      SidebarVoiceMember,
      'contextActions' | 'participantVolume' | 'onParticipantVolumeChange'
    >;
    afkChannelId?: string | null;
  },
): SidebarChannelItem {
  const isVoice = ch.type === 'VOICE';
  const isActivity = ch.type === 'GAME' || ch.type === 'WATCH_PARTY';
  const localMap = extras?.voiceMembersByChannel;
  const hasLocal = Boolean(localMap && Object.prototype.hasOwnProperty.call(localMap, ch.id));
  let voiceMembers =
    isVoice || isActivity
      ? hasLocal
        ? (localMap![ch.id] ?? [])
        : (ch.voiceMembers ?? [])
      : undefined;
  if (voiceMembers && extras?.selfUserId && isVoice) {
    const inThis =
      extras.selfVoiceChannelId != null && extras.selfVoiceChannelId === ch.id;
    if (!inThis) {
      voiceMembers = voiceMembers.filter((m) => m.id !== extras.selfUserId);
    }
  }
  return {
    id: ch.id,
    name: ch.name,
    type: sidebarType(ch),
    active: ch.id === activeChannelId,
    unread: Boolean(ch.unread || (ch.unreadCount ?? 0) > 0) && ch.id !== activeChannelId,
    locked: Boolean(ch.locked),
    badgeCount:
      (ch.type === 'TEXT' || ch.type === 'FORUM') && ch.id !== activeChannelId
        ? (ch.unreadCount ?? (ch.unread ? 1 : 0)) || undefined
        : undefined,
    voiceMembers: voiceMembers?.map((m) => {
      const isSelf = Boolean(extras?.selfUserId && m.id === extras.selfUserId);
      const isSuperAdmin = Boolean(extras?.platformAdminIds?.has(m.id));
      const draggable = isVoice
        ? isSelf
          ? Boolean(extras?.canDragSelf) && !m.isBot
          : Boolean(extras?.canDragVoiceMembers) && !m.isBot && !isSuperAdmin
        : false;
      const enriched = isVoice ? extras?.enrichVoiceMember?.(m, ch.id) ?? {} : {};
      const isAfk = Boolean(extras?.afkChannelId && ch.id === extras.afkChannelId);
      return {
        id: m.id,
        displayName: m.displayName,
        avatarUrl: m.avatarUrl,
        muted: isAfk ? true : m.muted,
        deafened: isAfk ? true : m.deafened,
        speaking: isAfk ? false : m.speaking,
        isBot: m.isBot,
        draggable,
        ...enriched,
      };
    }),
    onClick: () => onChannelClick(ch),
    onContextMenu: extras?.onEditChannel
      ? () => extras.onEditChannel?.(ch)
      : undefined,
    onEdit: extras?.onEditChannel ? () => extras.onEditChannel?.(ch) : undefined,
    onDelete: extras?.onDeleteChannel ? () => extras.onDeleteChannel?.(ch) : undefined,
    onDropMember:
      isVoice && extras?.onDropMember
        ? (userId) => extras.onDropMember?.(userId, ch)
        : undefined,
    draggable: Boolean(extras?.onReorderChannels),
  };
}

export function buildSidebarCategories(
  channels: ChannelSummary[],
  activeChannelId: string | undefined,
  onChannelClick: (channel: ChannelSummary) => void,
  extras?: {
    voiceMembersByChannel?: Record<string, VoiceMemberSummary[]>;
    /** Kullanıcı gerçekten bu LiveKit oturumundaysa id; değilse kendisini listeden çıkar. */
    selfUserId?: string;
    selfVoiceChannelId?: string | null;
    /** Platform admin id'leri — sürüklenemez */
    platformAdminIds?: Set<string>;
    guildCategories?: CategoryDto[];
    onAddChannel?: (categoryId: string | null) => void;
    onEditChannel?: (channel: ChannelSummary) => void;
    onDeleteChannel?: (channel: ChannelSummary) => void;
    onEditCategory?: (category: CategoryDto) => void;
    onDeleteCategory?: (category: CategoryDto) => void;
    onDropMember?: (userId: string, channel: ChannelSummary) => void;
    /** Diğer üyeleri sürükleyerek taşı (MOVE_MEMBERS / süperadmin) */
    canDragVoiceMembers?: boolean;
    /** Kendi avatarını başka ses kanalına sürükle */
    canDragSelf?: boolean;
    collapsedCategoryIds?: Set<string>;
    onToggleCategory?: (categoryId: string) => void;
    onReorderChannels?: (categoryId: string | null, orderedIds: string[]) => void;
    /** Ses kanalı üyesi sağ tık menüsü */
    enrichVoiceMember?: (
      member: VoiceMemberSummary,
      voiceChannelId: string,
    ) => Pick<
      SidebarVoiceMember,
      'contextActions' | 'participantVolume' | 'onParticipantVolumeChange'
    >;
    /** AFK kanalı — speaking gizlenir, mute/deafen zorunlu gösterilir */
    afkChannelId?: string | null;
  },
): SidebarCategory[] {
  const gameChannels = channels
    .filter((c) => c.type === 'GAME')
    .sort((a, b) => a.position - b.position);
  const watchChannels = channels
    .filter((c) => c.type === 'WATCH_PARTY')
    .sort((a, b) => a.position - b.position);
  const textAndVoice = channels.filter(
    (c) =>
      c.type !== 'CATEGORY' &&
      c.type !== 'GAME' &&
      c.type !== 'WATCH_PARTY',
  );
  const byCategory = new Map<string | null, ChannelSummary[]>();

  for (const ch of textAndVoice) {
    const key = ch.categoryId;
    const list = byCategory.get(key) ?? [];
    list.push(ch);
    byCategory.set(key, list);
  }

  // Boş kategoriler de görünsün
  for (const cat of extras?.guildCategories ?? []) {
    if (!byCategory.has(cat.id)) byCategory.set(cat.id, []);
  }

  const catMeta = new Map(
    (extras?.guildCategories ?? []).map((c) => [c.id, c] as const),
  );

  const categories: SidebarCategory[] = [];

  for (const [categoryId, list] of byCategory) {
    list.sort((a, b) => a.position - b.position);
    const items: SidebarChannelItem[] = list.map((ch) =>
      mapChannelItem(ch, activeChannelId, onChannelClick, extras),
    );

    const meta = categoryId ? catMeta.get(categoryId) : undefined;
    const catKey = categoryId ?? 'uncategorized';
    categories.push({
      id: catKey,
      label: meta?.name ?? (categoryId ? 'Kategori' : 'Kanallar'),
      collapsed: extras?.collapsedCategoryIds?.has(catKey) ?? false,
      onToggle: extras?.onToggleCategory
        ? () => extras.onToggleCategory?.(catKey)
        : undefined,
      channels: items,
      onAddChannel: extras?.onAddChannel
        ? () => extras.onAddChannel?.(categoryId)
        : undefined,
      onEditCategory:
        meta && extras?.onEditCategory ? () => extras.onEditCategory?.(meta) : undefined,
      onDeleteCategory:
        meta && extras?.onDeleteCategory ? () => extras.onDeleteCategory?.(meta) : undefined,
      onReorderChannels: extras?.onReorderChannels
        ? (orderedIds) => extras.onReorderChannels?.(categoryId, orderedIds)
        : undefined,
      sortPosition: meta?.position ?? (categoryId ? 999 : -1),
    });
  }

  categories.sort((a, b) => {
    const pa = a.sortPosition ?? 999;
    const pb = b.sortPosition ?? 999;
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label, 'tr');
  });

  // Sabit bölümler: Oyunlar + Watch Party (ses gibi sol menüde)
  // categoryId olarak __games__ / __watch__ — oluşturma modalında tip seçimi için
  const gamesKey = '__games__';
  categories.push({
    id: gamesKey,
    label: 'Oyunlar',
    collapsed: extras?.collapsedCategoryIds?.has(gamesKey) ?? false,
    onToggle: extras?.onToggleCategory
      ? () => extras.onToggleCategory?.(gamesKey)
      : undefined,
    channels: gameChannels.map((ch) =>
      mapChannelItem(ch, activeChannelId, onChannelClick, extras),
    ),
    onAddChannel: extras?.onAddChannel
      ? () => extras.onAddChannel?.(gamesKey)
      : undefined,
    sortPosition: 10_000,
  });

  const watchKey = '__watch__';
  categories.push({
    id: watchKey,
    label: 'Watch Party',
    collapsed: extras?.collapsedCategoryIds?.has(watchKey) ?? false,
    onToggle: extras?.onToggleCategory
      ? () => extras.onToggleCategory?.(watchKey)
      : undefined,
    channels: watchChannels.map((ch) =>
      mapChannelItem(ch, activeChannelId, onChannelClick, extras),
    ),
    onAddChannel: extras?.onAddChannel
      ? () => extras.onAddChannel?.(watchKey)
      : undefined,
    sortPosition: 10_001,
  });

  return categories;
}
