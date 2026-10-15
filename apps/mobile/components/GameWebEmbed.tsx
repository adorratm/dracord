import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { WEB_URL } from '../lib/config';
import { isNativeWebViewAvailable, SafeWebView } from './SafeWebView';

function bootstrapHtml(
  targetPath: string,
  accessToken: string,
  refreshToken: string,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/><title>Dracord</title>
<style>html,body{margin:0;height:100%;background:#11131e;color:#ccc3d3;font-family:system-ui;display:flex;align-items:center;justify-content:center}</style>
</head><body><p>Oyun yükleniyor…</p><script>
try{
  localStorage.setItem('dracord_access_token',${JSON.stringify(accessToken)});
  localStorage.setItem('dracord_refresh_token',${JSON.stringify(refreshToken)});
}catch(e){}
location.replace(${JSON.stringify(targetPath)});
</script></body></html>`;
}

/**
 * Web/desktop Three.js — `/embed/activity/...` (web deploy gerekir).
 * Deploy yoksa 404 → tarayıcı fallback metni.
 */
export function GameWebEmbed({
  guildId,
  channelId,
}: {
  guildId: string;
  channelId: string;
}) {
  const { getSessionTokens } = useAuth();
  const [html, setHtml] = useState<string | null>(null);
  const [openUri, setOpenUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasNative = useMemo(() => isNativeWebViewAvailable(), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const tokens = await getSessionTokens();
        if (!tokens) {
          if (!cancelled) setError('Oturum bulunamadı — yeniden giriş yapın');
          return;
        }
        // Salt oyun kabuğu (sidebar yok) — web build’te /embed route gerekir
        const path = `${WEB_URL}/embed/activity/${guildId}/${channelId}`;
        const page = bootstrapHtml(path, tokens.accessToken, tokens.refreshToken);
        if (!cancelled) {
          setOpenUri(path);
          setHtml(page);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Oyun açılamadı');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSessionTokens, guildId, channelId]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (!html || !openUri) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.textMuted }}>Oyun yükleniyor…</Text>
      </View>
    );
  }

  if (!hasNative) {
    return (
      <View
        style={{
          flex: 1,
          padding: 20,
          justifyContent: 'center',
          gap: 14,
          backgroundColor: colors.bg,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
          Tam oyun deneyimi
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
          Native WebView + web `/embed` deploy gerekir.
        </Text>
        <Pressable
          onPress={() => {
            void WebBrowser.openBrowserAsync(openUri).catch(() => Linking.openURL(openUri));
          }}
          style={{
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>Tarayıcıda oyna</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#11131e' }} collapsable={false}>
      <SafeWebView
        uri={openUri}
        html={html}
        baseUrl={WEB_URL}
        label="Oyun"
        style={{ flex: 1, backgroundColor: '#11131e' }}
      />
    </View>
  );
}
