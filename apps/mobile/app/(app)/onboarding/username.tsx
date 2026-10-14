import { useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../lib/auth';
import { inputStyle, primaryBtn, primaryBtnText } from '../../../lib/ui';

export default function UsernameOnboardingScreen() {
  const { client, refreshUser, user } = useAuth();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  if (user?.usernameConfirmed !== false) {
    return <Redirect href="/(app)/guilds" />;
  }

  const check = () => {
    const u = username.trim().toLowerCase();
    if (u.length < 3) return;
    void client.checkUsernameAvailable(u).then((r) => {
      setHint(r.available ? 'Kullanılabilir' : 'Alınmış');
    });
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Kullanıcı adı', headerBackVisible: false }} />
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
        Kullanıcı adını seç
      </Text>
      <Text style={{ color: colors.textMuted, marginBottom: 24 }}>
        Devam etmek için benzersiz bir kullanıcı adı belirlemen gerekiyor.
      </Text>
      {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
      <TextInput
        value={username}
        onChangeText={setUsername}
        onBlur={check}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="kullaniciadi"
        placeholderTextColor={colors.textMuted}
        style={{ ...inputStyle, marginBottom: 8 }}
      />
      {hint ? (
        <Text style={{ color: hint === 'Kullanılabilir' ? colors.success : colors.danger, marginBottom: 16 }}>
          {hint}
        </Text>
      ) : null}
      <Pressable
        disabled={busy || username.trim().length < 3}
        style={{ ...primaryBtn, opacity: busy || username.trim().length < 3 ? 0.5 : 1 }}
        onPress={() => {
          setBusy(true);
          setError(null);
          void client
            .confirmUsername(username.trim().toLowerCase())
            .then(() => refreshUser())
            .catch((e) => setError(e instanceof Error ? e.message : 'Kaydedilemedi'))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryOn} />
        ) : (
          <Text style={primaryBtnText}>Onayla</Text>
        )}
      </Pressable>
    </View>
  );
}
