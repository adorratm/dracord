import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { Draco } from '../../components/Draco';

export default function LoginScreen() {
  const { user, loginGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Redirect href="/(app)/guilds" />;

  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.bg,
      }}
    >
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '45%',
          backgroundColor: '#2d1b4e',
          opacity: 0.55,
        }}
      />
      <Draco size={168} />
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Text style={{ color: colors.primary, fontSize: 34, fontWeight: '900', letterSpacing: 3 }}>
          DR
        </Text>
        <Text style={{ color: colors.success, fontSize: 34, fontWeight: '900', letterSpacing: 3 }}>
          ACO
        </Text>
        <Text style={{ color: colors.primary, fontSize: 34, fontWeight: '900', letterSpacing: 3 }}>
          RD
        </Text>
      </View>
      <Text
        style={{
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 28,
          maxWidth: 300,
          lineHeight: 20,
        }}
      >
        Dracula temalı topluluk sohbeti. Google ile gir, sunucularına katıl.
      </Text>

      {error ? (
        <Text style={{ color: colors.danger, marginBottom: 12, textAlign: 'center' }}>
          {error}
        </Text>
      ) : null}

      <Pressable
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setError(null);
          void loginGoogle()
            .then(() => router.replace('/(app)/guilds'))
            .catch((e) => setError(e instanceof Error ? e.message : 'Giriş başarısız'))
            .finally(() => setBusy(false));
        }}
        style={{
          width: '100%',
          maxWidth: 360,
          height: 52,
          borderRadius: 14,
          backgroundColor: colors.surfaceHigh,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: busy ? 0.6 : 1,
          borderWidth: 1,
          borderColor: 'rgba(189,147,249,0.35)',
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>
          {busy ? 'Google açılıyor…' : 'Google ile giriş yap'}
        </Text>
      </Pressable>

      <Text
        style={{
          color: colors.outline,
          fontSize: 12,
          textAlign: 'center',
          marginTop: 20,
          maxWidth: 280,
        }}
      >
        Devam ederek Hizmet Şartları ve Gizlilik Politikası’nı kabul etmiş olursun.
      </Text>
    </View>
  );
}
