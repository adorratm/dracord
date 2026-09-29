import type { ChannelSummary, VoiceMemberSummary } from '@dracord/types';
import type { SidebarCategory, SidebarChannelItem } from '@dracord/ui';

const CATEGORY_LABELS: Record<string, string> = {
  'seed-cat-info': 'Bilgi',
  'seed-cat-chat': 'Sohbet',
  'seed-cat-voice': 'Ses',
};

function categoryLabel(categoryId: string | null, nameHint?: string): string {
  if (nameHint) return nameHint;
  if (!categoryId) return 'Kanallar';
  return CATEGORY_LABELS[categoryId] ?? 'Kanallar';
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
    onAddChannel?: (categoryId: string | null) => void;
    onEditChannel?: (channel: ChannelSummary) => void;
    onDeleteChannel?: (channel: ChannelSummary) => void;
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

  const categories: SidebarCategory[] = [];

  for (const [categoryId, list] of byCategory) {
    list.sort((a, b) => a.position - b.position);
    const items: SidebarChannelItem[] = list.map((ch) => {
      let voiceMembers =
        ch.type === 'VOICE'
          ? (extras?.voiceMembersByChannel?.[ch.id] ?? ch.voiceMembers ?? [])
          : undefined;
      // Kendimizi yalnızca gerçekten o ses kanalındaysak göster (Redis hayaletini gizle)
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
        type: ch.type === 'VOICE' ? 'voice' : 'text',
        active: ch.id === activeChannelId,
        unread: Boolean(ch.unread) && ch.id !== activeChannelId,
        locked: Boolean(ch.locked),
        voiceMembers: voiceMembers?.map((m) => ({
          id: m.id,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
          muted: m.muted,
          deafened: m.deafened,
        })),
        onClick: () => onChannelClick(ch),
        onContextMenu: extras?.onEditChannel
          ? () => extras.onEditChannel?.(ch)
          : undefined,
        onEdit: extras?.onEditChannel ? () => extras.onEditChannel?.(ch) : undefined,
        onDelete: extras?.onDeleteChannel ? () => extras.onDeleteChannel?.(ch) : undefined,
      };
    });

    categories.push({
      id: categoryId ?? 'uncategorized',
      label: categoryLabel(categoryId),
      channels: items,
      onAddChannel: extras?.onAddChannel
        ? () => extras.onAddChannel?.(categoryId)
        : undefined,
    });
  }

  categories.sort((a, b) => {
    const order = (id: string) => {
      if (id === 'seed-cat-info') return 0;
      if (id === 'seed-cat-chat') return 1;
      if (id === 'seed-cat-voice') return 2;
      return 3;
    };
    return order(a.id) - order(b.id);
  });

  return categories;
}
