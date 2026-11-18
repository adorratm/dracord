import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';

export function formatDeletionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

/** E5 — bekleyen hesap silme uyarısı + tek dokunuşla iptal */
export function AccountDeletionBar() {
  const { user, client, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user?.deletionScheduledAt) return null;
  const cancel = () => {
    setBusy(true);
    setError(null);
    void client
      .cancelAccountDeletion()
      .then(() => refreshUser())
      .catch((e) => setError(e instanceof Error ? e.message : 'İptal edilemedi'))
      .finally(() => setBusy(false));
  };
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: colors.surfaceHigh,
        borderTopWidth: 1,
        borderColor: colors.danger,
      }}
    >
      <Text style={{ flex: 1, color: colors.text, fontSize: 12, lineHeight: 16 }}>
        Hesabın {formatDeletionDate(user.deletionScheduledAt)} tarihinde kalıcı silinecek.
        {error ? `\n${error}` : ''}
      </Text>
      <Pressable
        onPress={cancel}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Hesap silmeyi iptal et"
        hitSlop={8}
        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.danger, opacity: busy ? 0.5 : 1 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{busy ? '…' : 'İptal et'}</Text>
      </Pressable>
    </View>
  );
}
