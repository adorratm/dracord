import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createErrorReporter } from '@dracord/sdk';
import { API_URL } from './config';

let installed = false;

/** Yakalanmamış JS hataları → Yönetim › İstemci hataları */
export function installMobileErrorReporter(getPath?: () => string | undefined) {
  if (installed || __DEV__) return;
  installed = true;
  const r = createErrorReporter({
    apiUrl: API_URL,
    platform: 'mobile',
    version: Constants.expoConfig?.version,
    agent: `${Platform.OS} ${String(Platform.Version)}`,
    getPath,
  });
  const EU = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler(): (e: unknown, fatal?: boolean) => void; setGlobalHandler(h: (e: unknown, fatal?: boolean) => void): void } }).ErrorUtils;
  if (EU) {
    const prev = EU.getGlobalHandler();
    EU.setGlobalHandler((e, fatal) => {
      r.report(e);
      if (fatal) r.flush();
      prev(e, fatal);
    });
  }
  // Hermes: işlenmemiş promise reddi
  const H = (globalThis as unknown as { HermesInternal?: { enablePromiseRejectionTracker?: (o: unknown) => void } }).HermesInternal;
  H?.enablePromiseRejectionTracker?.({ allRejections: true, onUnhandled: (_id: number, err: unknown) => r.report(err) });
}
