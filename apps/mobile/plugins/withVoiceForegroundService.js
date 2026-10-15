const {
  withAndroidManifest,
  withMainActivity,
  AndroidConfig,
} = require('@expo/config-plugins');

/**
 * Android arka plan ses / kamera / ekran paylaşımı için foreground service + izinler.
 * LiveKit RN örneğindeki @supersami/rn-foreground-service bildirimini kullanır.
 */
function withVoiceForegroundServiceManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.WAKE_LOCK',
    ];

    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }
    const existing = new Set(
      manifest.manifest['uses-permission'].map((p) => p.$?.['android:name']).filter(Boolean),
    );
    for (const name of permissions) {
      if (!existing.has(name)) {
        manifest.manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }

    if (!app.service) app.service = [];
    const serviceNames = new Set(app.service.map((s) => s.$?.['android:name']).filter(Boolean));

    if (!serviceNames.has('com.supersami.foregroundservice.ForegroundService')) {
      app.service.push({
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundService',
          'android:foregroundServiceType': 'camera|microphone|mediaPlayback|mediaProjection',
          'android:stopWithTask': 'false',
        },
      });
    } else {
      const svc = app.service.find(
        (s) => s.$?.['android:name'] === 'com.supersami.foregroundservice.ForegroundService',
      );
      if (svc?.$) {
        svc.$['android:foregroundServiceType'] =
          'camera|microphone|mediaPlayback|mediaProjection';
        svc.$['android:stopWithTask'] = 'false';
      }
    }
    if (!serviceNames.has('com.supersami.foregroundservice.ForegroundServiceTask')) {
      app.service.push({
        $: {
          'android:name': 'com.supersami.foregroundservice.ForegroundServiceTask',
        },
      });
    }

    return cfg;
  });
}

const VOICE_EMIT_MARKER = 'emitVoiceNotificationAction';

const VOICE_EMIT_KT = `
  private var handledNewIntent = false

  override fun onStart() {
    super.onStart()
    if (!handledNewIntent) {
      emitVoiceNotificationAction(intent)
    }
    handledNewIntent = false
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handledNewIntent = true
    emitVoiceNotificationAction(intent)
  }

  private fun emitVoiceNotificationAction(intent: Intent?) {
    if (intent == null) return
    val main = intent.getStringExtra("mainOnPress")
    val button = intent.getStringExtra("buttonOnPress")
    val button2 = intent.getStringExtra("button2OnPress")
    if (main == null && button == null && button2 == null) return

    val map = Arguments.createMap()
    if (main != null) map.putString("main", main)
    if (button != null) map.putString("button", button)
    if (button2 != null) map.putString("button2", button2)

    try {
      val ctx = reactInstanceManager?.currentReactContext ?: return
      ctx
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("notificationClickHandle", map)
    } catch (_: Exception) {
    }

    intent.removeExtra("mainOnPress")
    intent.removeExtra("buttonOnPress")
    intent.removeExtra("button2OnPress")
  }
`;

function ensureImport(contents, importLine) {
  if (contents.includes(importLine)) return contents;
  const pkg = contents.match(/^package .+$/m);
  if (!pkg) return `${importLine}\n${contents}`;
  return contents.replace(pkg[0], `${pkg[0]}\n\n${importLine}`);
}

function withVoiceNotificationClicks(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes(VOICE_EMIT_MARKER)) {
      cfg.modResults.contents = contents;
      return cfg;
    }

    contents = ensureImport(contents, 'import android.content.Intent');
    contents = ensureImport(contents, 'import com.facebook.react.bridge.Arguments');
    contents = ensureImport(
      contents,
      'import com.facebook.react.modules.core.DeviceEventManagerModule',
    );

    // class MainActivity : ReactActivity() {  içine enjekte et
    const classMatch = contents.match(
      /class\s+MainActivity\s*:\s*ReactActivity\(\)\s*\{/,
    );
    if (classMatch) {
      contents = contents.replace(
        classMatch[0],
        `${classMatch[0]}\n${VOICE_EMIT_KT}`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function withVoiceForegroundService(config) {
  config = withVoiceForegroundServiceManifest(config);
  config = withVoiceNotificationClicks(config);
  return config;
}

module.exports = withVoiceForegroundService;
