import { useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';
import { colors } from '@dracord/app-theme';
import { DISCOVER_CATEGORIES, type DiscoverCategory } from '@dracord/types';
import { useAuth } from '../lib/auth';
import { inputStyle, primaryBtn, primaryBtnText } from '../lib/ui';
import { Icon } from './Icon';

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 20,
            maxHeight: '80%',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 18 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Kapat">
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CreateGuildModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (guildId: string) => void;
}) {
  const { client } = useAuth();
  const [name, setName] = useState('');
  const [discoverable, setDiscoverable] = useState(true);
  const [discoverCategory, setDiscoverCategory] = useState<DiscoverCategory>('gaming');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  return (
    <Sheet title="Sunucu oluştur" onClose={onClose}>
      {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Sunucu adı</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Dracula Alemi"
        placeholderTextColor={colors.textMuted}
        style={{ ...inputStyle, marginBottom: 14 }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: discoverable ? 12 : 16,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 15 }}>Keşfette göster</Text>
        <Switch
          value={discoverable}
          onValueChange={setDiscoverable}
          trackColor={{ false: colors.surfaceHigh, true: colors.primary }}
          thumbColor={colors.text}
        />
      </View>
      {discoverable ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>
            Sunucu türü
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {DISCOVER_CATEGORIES.map((cat) => {
                const selected = discoverCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setDiscoverCategory(cat.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: selected ? colors.primary : colors.surfaceHigh,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? colors.primaryOn : colors.text,
                        fontWeight: selected ? '700' : '500',
                        fontSize: 13,
                      }}
                    >
                      {cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}
      <Pressable
        disabled={busy || name.trim().length < 2}
        onPress={() => {
          setBusy(true);
          setError(null);
          void client
            .createGuild({
              name: name.trim(),
              discoverable,
              discoverCategory: discoverable ? discoverCategory : undefined,
            })
            .then((g) => {
              onCreated(g.id);
              onClose();
              setName('');
              setDiscoverable(true);
              setDiscoverCategory('gaming');
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'Oluşturulamadı'))
            .finally(() => setBusy(false));
        }}
        style={{ ...primaryBtn, opacity: busy || name.trim().length < 2 ? 0.5 : 1 }}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryOn} />
        ) : (
          <Text style={primaryBtnText}>Oluştur</Text>
        )}
      </Pressable>
    </Sheet>
  );
}

export function JoinInviteModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean;
  onClose: () => void;
  onJoined: (guildId: string) => void;
}) {
  const { client } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  return (
    <Sheet title="Davet ile katıl" onClose={onClose}>
      {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Davet kodu veya link"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        style={{ ...inputStyle, marginBottom: 12 }}
      />
      <Pressable
        disabled={busy || !code.trim()}
        onPress={() => {
          setBusy(true);
          setError(null);
          const raw = code.trim();
          const invite = raw.includes('/') ? raw.split('/').pop()! : raw;
          void client
            .joinInvite(invite)
            .then((g) => {
              onJoined(g.id);
              onClose();
              setCode('');
            })
            .catch((e) => setError(e instanceof Error ? e.message : 'Katılınamadı'))
            .finally(() => setBusy(false));
        }}
        style={{ ...primaryBtn, opacity: busy || !code.trim() ? 0.5 : 1 }}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryOn} />
        ) : (
          <Text style={primaryBtnText}>Katıl</Text>
        )}
      </Pressable>
    </Sheet>
  );
}
