import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../lib/auth';
import {
  checkAppUpdates,
  promptOtaUpdate,
  promptStoreUpdate,
} from '../lib/appUpdates';

/**
 * Açılış / foreground’da OTA + mağaza sürüm kontrolü.
 * autoUpdate tercihini client settings’ten okur (yoksa true).
 */
export function AppUpdateGate() {
  const { client, ready, user } = useAuth();
  const [autoUpdate, setAutoUpdate] = useState(true);
  const running = useRef(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!ready || !user) return;
    void client
      .getClientSettings()
      .then((s) => setAutoUpdate(s.system?.autoUpdate !== false))
      .catch(() => undefined);
  }, [ready, user, client]);

  useEffect(() => {
    if (!ready) return;

    const run = async () => {
      const now = Date.now();
      if (running.current || now - lastCheck.current < 60_000) return;
      running.current = true;
      lastCheck.current = now;
      try {
        const result = await checkAppUpdates(client);
        if (result.forceStore || result.storeUpdate) {
          promptStoreUpdate({
            current: result.current,
            remote: result.remoteStoreVersion,
            storeUrl: result.storeUrl,
            force: result.forceStore,
          });
          if (result.forceStore) return;
        }
        if (result.otaAvailable) {
          promptOtaUpdate({
            current: result.current,
            autoApply: autoUpdate,
          });
        }
      } catch {
        /* ignore */
      } finally {
        running.current = false;
      }
    };

    void run();
    const onAppState = (s: AppStateStatus) => {
      if (s === 'active') void run();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [ready, client, autoUpdate]);

  return null;
}
