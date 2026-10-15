import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentType,
} from 'react';
import {
  Linking,
  NativeModules,
  Pressable,
  Text,
  TurboModuleRegistry,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '@dracord/app-theme';
import {
  WATCH_APP_REFERER,
  WATCH_EMBED_ORIGIN,
  youtubeEmbedHtml,
} from '../lib/watchPartyMedia';

type WebViewSource =
  | { uri: string; headers?: Record<string, string> }
  | { html: string; baseUrl?: string };

type WebViewProps = {
  source: WebViewSource;
  style?: StyleProp<ViewStyle>;
  allowsFullscreenVideo?: boolean;
  allowsInlineMediaPlayback?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  startInLoadingState?: boolean;
  mixedContentMode?: 'never' | 'always' | 'compatibility';
  setSupportMultipleWindows?: boolean;
  originWhitelist?: string[];
  userAgent?: string;
  onMessage?: (event: { nativeEvent: { data: string } }) => void;
  sharedCookiesEnabled?: boolean;
  thirdPartyCookiesEnabled?: boolean;
};

type WebViewComponent = ComponentType<WebViewProps & { ref?: unknown }>;

export type SafeWebViewHandle = {
  injectJavaScript: (script: string) => void;
  sendYoutubeCmd: (cmd: Record<string, unknown>) => void;
};

let cached: WebViewComponent | null | undefined;

function hasNativeWebViewModule(): boolean {
  try {
    if (TurboModuleRegistry.get?.('RNCWebViewModule')) return true;
  } catch {
    /* yok */
  }
  const n = NativeModules as Record<string, unknown>;
  return Boolean(n.RNCWebViewModule || n.RNCWebView || n.RNCWebViewMessagingModule);
}

function loadWebView(): WebViewComponent | null {
  if (cached !== undefined) return cached;
  if (!hasNativeWebViewModule()) {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-webview') as { WebView?: WebViewComponent };
    cached = mod.WebView ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

export function isNativeWebViewAvailable() {
  return loadWebView() != null;
}

function EmbedFallback({
  openUri,
  style,
  label,
}: {
  openUri: string;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  return (
    <View
      style={[
        {
          minHeight: 180,
          backgroundColor: '#0b0d14',
          borderRadius: 12,
          padding: 16,
          justifyContent: 'center',
          gap: 12,
        },
        style,
      ]}
    >
      <Text style={{ color: colors.text, fontWeight: '700' }}>
        {label ? `${label} oynatıcı` : 'Gömülü içerik'}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}>
        WebView native modülü bu derlemede yok. `yarn android` ile yeniden derleyin veya
        tarayıcıda açın.
      </Text>
      <Pressable
        onPress={() => {
          void WebBrowser.openBrowserAsync(openUri).catch(() => Linking.openURL(openUri));
        }}
        style={{
          height: 40,
          borderRadius: 10,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.primaryOn, fontWeight: '700' }}>Tarayıcıda aç</Text>
      </Pressable>
    </View>
  );
}

export const SafeWebView = forwardRef<
  SafeWebViewHandle,
  {
    uri: string;
    style?: StyleProp<ViewStyle>;
    label?: string;
    youtubeId?: string | null;
    youtubeStartAt?: number;
    onYoutubeMessage?: (msg: Record<string, unknown>) => void;
    /** Ham HTML (oyun bootstrap vb.) — uri yerine */
    html?: string | null;
    baseUrl?: string;
  }
>(function SafeWebView(
  {
    uri,
    style,
    label,
    youtubeId,
    youtubeStartAt = 0,
    onYoutubeMessage,
    html,
    baseUrl,
  },
  ref,
) {
  const WebView = useMemo(() => loadWebView(), []);
  const webRef = useRef<{ injectJavaScript?: (s: string) => void } | null>(null);

  useImperativeHandle(ref, () => ({
    injectJavaScript: (script: string) => {
      webRef.current?.injectJavaScript?.(script);
    },
    sendYoutubeCmd: (cmd: Record<string, unknown>) => {
      const payload = JSON.stringify(cmd);
      webRef.current?.injectJavaScript?.(
        `try{window.__dracordCmd&&window.__dracordCmd(${payload});}catch(e){};true;`,
      );
    },
  }));

  if (!WebView) {
    return <EmbedFallback openUri={uri} style={style} label={label} />;
  }

  let source: WebViewSource;
  if (html) {
    source = { html, baseUrl: baseUrl ?? WATCH_EMBED_ORIGIN };
  } else if (youtubeId) {
    source = {
      html: youtubeEmbedHtml(youtubeId, youtubeStartAt),
      baseUrl: WATCH_EMBED_ORIGIN,
    };
  } else {
    source = {
      uri,
      headers: { Referer: WATCH_APP_REFERER },
    };
  }

  return (
    <WebView
      // @ts-expect-error native WebView ref
      ref={webRef}
      source={source}
      style={style}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      mixedContentMode="always"
      setSupportMultipleWindows={false}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      originWhitelist={['*']}
      onMessage={(ev) => {
        if (!onYoutubeMessage) return;
        try {
          const msg = JSON.parse(ev.nativeEvent.data) as Record<string, unknown>;
          onYoutubeMessage(msg);
        } catch {
          /* ignore */
        }
      }}
      userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    />
  );
});
