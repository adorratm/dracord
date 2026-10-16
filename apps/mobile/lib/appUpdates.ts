/**
 * Mobil güncelleme: EAS OTA + mağaza native sürüm kontrolü.
 */
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import type { DracordClient } from '@dracord/sdk';

function parseSemver(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split('.')
    .map((p) => parseInt(p.replace(/\D/g, ''), 10) || 0);
}

/** a < b → -1; a==b → 0; a > b → 1 */
export function compareVersions(a: string, b: string): number {
  const aa = parseSemver(a);
  const bb = parseSemver(b);
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) {
    const x = aa[i] ?? 0;
    const y = bb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export function getNativeAppVersion(): string {
  return (
    Application.nativeApplicationVersion ||
    Constants.expoConfig?.version ||
    '0.0.0'
  );
}

export type UpdateCheckResult = {
  current: string;
  otaAvailable: boolean;
  storeUpdate: boolean;
  forceStore: boolean;
  storeUrl: string | null;
  remoteStoreVersion: string | null;
};

export async function checkAppUpdates(
  client: DracordClient,
): Promise<UpdateCheckResult> {
  const current = getNativeAppVersion();
  let otaAvailable = false;
  if (Updates.isEnabled) {
    try {
      const result = await Updates.checkForUpdateAsync();
      otaAvailable = Boolean(result.isAvailable);
    } catch {
      /* Expo Go / missing project */
    }
  }

  let storeUpdate = false;
  let forceStore = false;
  let storeUrl: string | null = null;
  let remoteStoreVersion: string | null = null;
  try {
    const versions = await client.getClientVersions();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    remoteStoreVersion = platform === 'ios' ? versions.ios : versions.android;
    storeUrl =
      platform === 'ios' ? versions.storeUrlIos : versions.storeUrlAndroid;
    const min =
      platform === 'ios' ? versions.minIos : versions.minAndroid;
    if (remoteStoreVersion && compareVersions(current, remoteStoreVersion) < 0) {
      storeUpdate = true;
    }
    if (min && compareVersions(current, min) < 0) {
      forceStore = true;
      storeUpdate = true;
    }
  } catch {
    /* API offline */
  }

  return {
    current,
    otaAvailable,
    storeUpdate,
    forceStore,
    storeUrl,
    remoteStoreVersion,
  };
}

export async function applyOtaUpdate(): Promise<void> {
  if (!Updates.isEnabled) return;
  const result = await Updates.fetchUpdateAsync();
  if (result.isNew) {
    await Updates.reloadAsync();
  }
}

export function promptStoreUpdate(opts: {
  current: string;
  remote: string | null;
  storeUrl: string | null;
  force: boolean;
}): void {
  const { current, remote, storeUrl, force } = opts;
  const title = force ? 'Güncelleme zorunlu' : 'Mağaza güncellemesi';
  const message = remote
    ? `Mevcut sürüm v${current}. Mağazada v${remote} var. Güncellemek ister misin?`
    : `Mevcut sürüm v${current}. Mağazada daha yeni bir sürüm var.`;
  const buttons = force
    ? [
        {
          text: 'Mağazaya git',
          onPress: () => {
            if (storeUrl) void Linking.openURL(storeUrl);
          },
        },
      ]
    : [
        { text: 'Sonra', style: 'cancel' as const },
        {
          text: 'Mağazaya git',
          onPress: () => {
            if (storeUrl) void Linking.openURL(storeUrl);
          },
        },
      ];
  Alert.alert(title, message, buttons, { cancelable: !force });
}

export function promptOtaUpdate(opts: {
  current: string;
  autoApply: boolean;
}): void {
  const { current, autoApply } = opts;
  if (autoApply) {
    Alert.alert(
      'Güncelleme hazır',
      `v${current} için yeni bir OTA paketi indirildi. Yeniden başlatılsın mı?`,
      [
        { text: 'Sonra', style: 'cancel' },
        {
          text: 'Yeniden başlat',
          onPress: () => {
            void applyOtaUpdate().catch(() => undefined);
          },
        },
      ],
    );
    return;
  }
  Alert.alert(
    'Güncelleme mevcut',
    `Mevcut sürüm v${current}. Yeni OTA güncellemesi var. İndirip yeniden başlatmak ister misin?`,
    [
      { text: 'Sonra', style: 'cancel' },
      {
        text: 'Güncelle',
        onPress: () => {
          void applyOtaUpdate().catch((e) => {
            Alert.alert(
              'Güncelleme',
              e instanceof Error ? e.message : 'OTA uygulanamadı',
            );
          });
        },
      },
    ],
  );
}
