import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@dracord/app-theme';
import { API_URL } from '../../lib/config';
import { useAuth } from '../../lib/auth';
import { inputStyle, primaryBtn, primaryBtnText } from '../../lib/ui';
import { resetMobileAppTour, startMobileAppTour } from '../../components/AppTour';

type Tab =
  | 'account'
  | 'profile'
  | 'privacy'
  | 'notifications'
  | 'voice'
  | 'appearance'
  | 'language';

const STARTUP_KEY = 'dracord.mobile.startup';

export default function SettingsScreen() {
  const { user, logout, client, refreshUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('account');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startup, setStartup] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STARTUP_KEY).then((v) => setStartup(v === '1'));
  }, []);

  const tabs: Array<[Tab, string]> = [
    ['account', 'Hesap'],
    ['profile', 'Profil'],
    ['privacy', 'Gizlilik'],
    ['notifications', 'Bildirimler'],
    ['voice', 'Ses'],
    ['appearance', 'Görünüm'],
    ['language', 'Dil'],
  ];

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Stack.Screen options={{ title: 'Ayarlar' }} />
      <ScrollView
        style={{ width: 140, borderRightWidth: 1, borderRightColor: colors.surfaceHigh, backgroundColor: colors.surface }}
        contentContainerStyle={{ padding: 8 }}
      >
        {tabs.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 10,
              borderRadius: 8,
              marginBottom: 4,
              backgroundColor: tab === k ? colors.surfaceHigh : 'transparent',
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => void logout().then(() => router.replace('/(auth)/login'))}
          style={{
            marginTop: 16,
            height: 40,
            borderRadius: 10,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Çıkış</Text>
        </Pressable>
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        {msg ? <Text style={{ color: colors.success }}>{msg}</Text> : null}

        {tab === 'account' && (
          <>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Hesap</Text>
            <Text style={{ color: colors.textMuted }}>@{user?.username}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>API: {API_URL}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13 }}>
              2FA: {user?.twoFactorEnabled ? 'Açık' : 'Kapalı (web)'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <Switch
                value={startup}
                onValueChange={(v) => {
                  setStartup(v);
                  void AsyncStorage.setItem(STARTUP_KEY, v ? '1' : '0');
                }}
              />
              <Text style={{ color: colors.text }}>Açılışta hatırla (tercih)</Text>
            </View>
            <Text style={{ color: colors.textMuted, marginTop: 20, marginBottom: 8, fontSize: 13 }}>
              Arayüzü yeniden tanımak için uygulama turunu başlatabilirsin.
            </Text>
            <Pressable
              style={{
                ...primaryBtn,
                backgroundColor: colors.surfaceHigh,
                marginTop: 0,
              }}
              onPress={() => {
                void resetMobileAppTour().then(() => startMobileAppTour());
              }}
            >
              <Text style={{ ...primaryBtnText, color: colors.text }}>Uygulama turunu başlat</Text>
            </Pressable>
          </>
        )}

        {tab === 'profile' && (
          <>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Profil</Text>
            <Text style={{ color: colors.textMuted, marginBottom: 4 }}>Görünen ad</Text>
            <TextInput value={displayName} onChangeText={setDisplayName} style={{ ...inputStyle, marginBottom: 12 }} />
            <Text style={{ color: colors.textMuted, marginBottom: 4 }}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              multiline
              style={{ ...inputStyle, height: 88, textAlignVertical: 'top', paddingVertical: 10, marginBottom: 12 }}
            />
            <Pressable
              style={primaryBtn}
              onPress={() => {
                setError(null);
                void client
                  .updateProfile({ displayName: displayName.trim(), bio })
                  .then(() => {
                    setMsg('Profil güncellendi');
                    void refreshUser();
                  })
                  .catch((e) => setError(e instanceof Error ? e.message : 'Hata'));
              }}
            >
              <Text style={primaryBtnText}>Kaydet</Text>
            </Pressable>
          </>
        )}

        {tab === 'privacy' && (
          <>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Gizlilik</Text>
            <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
              Link önizleme sansürü: {user?.censorLinkPreviews ? 'Açık' : 'Kapalı'}
            </Text>
            <Pressable
              style={primaryBtn}
              onPress={() => {
                void client
                  .updateProfile({ censorLinkPreviews: !user?.censorLinkPreviews })
                  .then(() => {
                    setMsg('Gizlilik güncellendi');
                    void refreshUser();
                  });
              }}
            >
              <Text style={primaryBtnText}>Sansürü değiştir</Text>
            </Pressable>
          </>
        )}

        {tab === 'notifications' && (
          <>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Bildirimler</Text>
            <Text style={{ color: colors.textMuted }}>
              Uygulama içi bildirim merkezi: sol menüden Bildirimler. Push bildirimleri OS ayarlarından yönetilir.
            </Text>
          </>
        )}

        {tab === 'voice' && (
          <>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Ses</Text>
            <Text style={{ color: colors.textMuted }}>
              Mikrofon / kamera ses odasında. LiveKit React Native. Ekran paylaşımı mobilde N/A.
            </Text>
          </>
        )}

        {tab === 'appearance' && (
          <>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Görünüm</Text>
            <Text style={{ color: colors.textMuted }}>Koyu tema (@dracord/app-theme)</Text>
          </>
        )}

        {tab === 'language' && (
          <>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Dil</Text>
            <Text style={{ color: colors.textMuted }}>Arayüz dili: Türkçe</Text>
          </>
        )}

        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 32 }}>
          Native Expo istemci — WebView yok. Oyunlar: expo-gl + game-core.
        </Text>
      </ScrollView>
    </View>
  );
}
