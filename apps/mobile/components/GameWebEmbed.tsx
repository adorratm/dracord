import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
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
 * Tam ekran: RN WebView’da document.fullscreen yok → 90° yatay yerleşim (aynı WebView).
 */
export function GameWebEmbed({
  guildId,
  channelId,
  onLandscapeFullscreenChange,
}: {
  guildId: string;
  channelId: string;
  onLandscapeFullscreenChange?: (active: boolean) => void;
}) {
  const { getSessionTokens } = useAuth();
  const [html, setHtml] = useState<string | null>(null);
  const [openUri, setOpenUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [landscapeFs, setLandscapeFs] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
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

  const onBridgeMessage = useCallback(
    (msg: Record<string, unknown>) => {
      if (msg.type !== 'dracord-game-fs') return;
      const active = Boolean(msg.enter) && Boolean(msg.landscape ?? true);
      setLandscapeFs(active);
      onLandscapeFullscreenChange?.(active);
    },
    [onLandscapeFullscreenChange],
  );

  useEffect(() => {
    return () => onLandscapeFullscreenChange?.(false);
  }, [onLandscapeFullscreenChange]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);

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

  const portrait = box.w > 0 && box.w < box.h;
  const rotateLandscape = landscapeFs && portrait;
  const shellStyle = rotateLandscape
    ? {
        position: 'absolute' as const,
        width: box.h,
        height: box.w,
        top: (box.h - box.w) / 2,
        left: (box.w - box.h) / 2,
        transform: [{ rotate: '90deg' as const }],
        backgroundColor: '#11131e',
        overflow: 'hidden' as const,
      }
    : {
        flex: 1,
        backgroundColor: '#11131e',
        overflow: 'hidden' as const,
      };

  return (
    <View
      style={{ flex: 1, backgroundColor: '#11131e', overflow: 'hidden' }}
      collapsable={false}
      onLayout={onLayout}
    >
      <View style={shellStyle} collapsable={false}>
        <SafeWebView
          uri={openUri}
          html={html}
          baseUrl={WEB_URL}
          label="Oyun"
          onBridgeMessage={onBridgeMessage}
          style={{ flex: 1, width: '100%', height: '100%', backgroundColor: '#11131e' }}
        />
      </View>
    </View>
  );
}
