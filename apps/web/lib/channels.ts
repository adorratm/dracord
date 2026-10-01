import type { CategoryDto, ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import type { SidebarCategory, SidebarChannelItem } from '@dracord/ui';

export function buildSidebarCategories(
  channels: ChannelSummary[],
  activeChannelId: string | undefined,
  onChannelClick: (channel: ChannelSummary) => void,
  extras?: {
    voiceMembersByChannel?: Record<string, VoiceMemberSummary[]>;
    /** Kullanıcı gerçekten bu LiveKit oturumundaysa id; değilse kendisini listeden çıkar. */
    selfUserId?: string;
    selfVoiceChannelId?: string | null;
    guildCategories?: CategoryDto[];
    onAddChannel?: (categoryId: string | null) => void;
    onEditChannel?: (channel: ChannelSummary) => void;
    onDeleteChannel?: (channel: ChannelSummary) => void;
    onEditCategory?: (category: CategoryDto) => void;
    onDeleteCategory?: (category: CategoryDto) => void;
    onDropMember?: (userId: string, channel: ChannelSummary) => void;
    collapsedCategoryIds?: Set<string>;
    onToggleCategory?: (categoryId: string) => void;
    onReorderChannels?: (categoryId: string | null, orderedIds: string[]) => void;
  },
): SidebarCategory[] {
  const textAndVoice = channels.filter((c) => c.type !== 'CATEGORY');
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
    const items: SidebarChannelItem[] = list.map((ch) => {
      let voiceMembers =
        ch.type === 'VOICE'
          ? (extras?.voiceMembersByChannel?.[ch.id] ?? ch.voiceMembers ?? [])
          : undefined;
      if (voiceMembers && extras?.selfUserId) {
        const inThis =
          extras.selfVoiceChannelId != null && extras.selfVoiceChannelId === ch.id;
        if (!inThis) {
          voiceMembers = voiceMembers.filter((m) => m.id !== extras.selfUserId);
        }
      }
      return {
        id: ch.id,
        name: ch.name,
        type:
          ch.type === 'VOICE' ? 'voice' : ch.type === 'FORUM' ? 'forum' : 'text',
        active: ch.id === activeChannelId,
        unread: Boolean(ch.unread || (ch.unreadCount ?? 0) > 0) && ch.id !== activeChannelId,
        locked: Boolean(ch.locked),
        badgeCount:
          (ch.type === 'TEXT' || ch.type === 'FORUM') && ch.id !== activeChannelId
            ? (ch.unreadCount ?? (ch.unread ? 1 : 0)) || undefined
            : undefined,
        voiceMembers: voiceMembers?.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
          muted: m.muted,
          deafened: m.deafened,
          speaking: m.speaking,
          isBot: m.isBot,
        })),
        onClick: () => onChannelClick(ch),
        onContextMenu: extras?.onEditChannel
          ? () => extras.onEditChannel?.(ch)
          : undefined,
        onEdit: extras?.onEditChannel ? () => extras.onEditChannel?.(ch) : undefined,
        onDelete: extras?.onDeleteChannel ? () => extras.onDeleteChannel?.(ch) : undefined,
        onDropMember:
          ch.type === 'VOICE' && extras?.onDropMember
            ? (userId) => extras.onDropMember?.(userId, ch)
            : undefined,
        draggable: Boolean(extras?.onReorderChannels),
      };
    });

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

  return categories;
}
