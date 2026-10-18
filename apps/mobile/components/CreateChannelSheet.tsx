import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { CategoryDto, ChannelSummary, GameChannelKind } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { inputStyle, primaryBtn, primaryBtnText } from '../lib/ui';
import { Icon } from './Icon';

type ChannelTypeOpt = 'TEXT' | 'VOICE' | 'FORUM' | 'GAME' | 'WATCH_PARTY';

const TYPES: Array<{ id: ChannelTypeOpt; label: string }> = [
  { id: 'TEXT', label: 'Metin' },
  { id: 'VOICE', label: 'Ses' },
  { id: 'FORUM', label: 'Forum' },
  { id: 'GAME', label: 'Oyun' },
  { id: 'WATCH_PARTY', label: 'Watch Party' },
];

const GAME_KINDS: Array<{ id: GameChannelKind; label: string }> = [
  { id: 'billiards', label: 'Bilardo' },
  { id: 'okey', label: 'Okey' },
  { id: 'bowling', label: 'Bowling' },
  { id: 'tavla', label: 'Tavla' },
  { id: 'blackjack', label: 'Blackjack' },
  { id: 'trivia', label: 'Trivia' },
  { id: 'words', label: 'Kelime' },
];

export function CreateChannelSheet({
  open,
  onClose,
  categories,
  onSubmit,
  initialType = 'TEXT',
  initialCategoryId = null,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryDto[];
  initialType?: ChannelTypeOpt;
  initialCategoryId?: string | null;
  onSubmit: (data: {
    name: string;
    type: ChannelTypeOpt;
    categoryId: string | null;
    gameKind: GameChannelKind | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelTypeOpt>(initialType);
  const [gameKind, setGameKind] = useState<GameChannelKind>('billiards');
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setType(initialType);
    setGameKind('billiards');
    setCategoryId(initialCategoryId);
    setError(null);
    setBusy(false);
  }, [open, initialType, initialCategoryId]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            maxHeight: '88%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 28,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18, flex: 1 }}>
              Kanal oluştur
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {error ? (
              <Text style={{ color: colors.danger, fontWeight: '600' }}>{error}</Text>
            ) : null}

            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Kanal adı</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="ör. genel"
              placeholderTextColor={colors.textMuted}
              style={inputStyle}
              autoFocus
            />

            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Tür</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TYPES.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setType(t.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: type === t.id ? colors.primary : colors.surfaceHigh,
                  }}
                >
                  <Text
                    style={{
                      color: type === t.id ? colors.primaryOn : colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {type === 'GAME' ? (
              <>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Oyun türü</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {GAME_KINDS.map((g) => (
                    <Pressable
                      key={g.id}
                      onPress={() => setGameKind(g.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor:
                          gameKind === g.id ? colors.primary : colors.surfaceHigh,
                      }}
                    >
                      <Text
                        style={{
                          color: gameKind === g.id ? colors.primaryOn : colors.text,
                          fontWeight: '700',
                          fontSize: 13,
                        }}
                      >
                        {g.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Kategori (isteğe bağlı)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Pressable
                onPress={() => setCategoryId(null)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: categoryId == null ? colors.primary : colors.surfaceHigh,
                }}
              >
                <Text
                  style={{
                    color: categoryId == null ? colors.primaryOn : colors.text,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  Yok
                </Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: categoryId === c.id ? colors.primary : colors.surfaceHigh,
                  }}
                >
                  <Text
                    style={{
                      color: categoryId === c.id ? colors.primaryOn : colors.text,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                    numberOfLines={1}
                  >
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[primaryBtn, { opacity: busy || !name.trim() ? 0.5 : 1 }]}
              disabled={busy || !name.trim()}
              onPress={() => {
                setBusy(true);
                setError(null);
                void onSubmit({
                  name: name.trim(),
                  type,
                  categoryId,
                  gameKind: type === 'GAME' ? (gameKind || 'billiards') : null,
                })
                  .then(onClose)
                  .catch((e) =>
                    setError(e instanceof Error ? e.message : 'Oluşturulamadı'),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              <Text style={primaryBtnText}>{busy ? '…' : 'Oluştur'}</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CreateCategorySheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
    setBusy(false);
  }, [open]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 16,
            paddingBottom: 28,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>
            Kategori oluştur
          </Text>
          {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Kategori adı"
            placeholderTextColor={colors.textMuted}
            style={inputStyle}
            autoFocus
          />
          <Pressable
            style={[primaryBtn, { opacity: busy || !name.trim() ? 0.5 : 1 }]}
            disabled={busy || !name.trim()}
            onPress={() => {
              setBusy(true);
              setError(null);
              void onSubmit(name.trim())
                .then(onClose)
                .catch((e) =>
                  setError(e instanceof Error ? e.message : 'Oluşturulamadı'),
                )
                .finally(() => setBusy(false));
            }}
          >
            <Text style={primaryBtnText}>{busy ? '…' : 'Oluştur'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type { ChannelSummary };
