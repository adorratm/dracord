import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_TOUR_STEPS,
  APP_TOUR_STORAGE_KEY,
  APP_TOUR_STORAGE_KEY_LEGACY,
  APP_TOUR_STORAGE_KEY_LEGACY_DESKTOP,
  parseAppTourCompleted,
  serializeAppTourCompleted,
} from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';

async function readTourDone(userId?: string | null): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(APP_TOUR_STORAGE_KEY);
    return parseAppTourCompleted(raw, userId);
  } catch {
    return false;
  }
}

async function writeTourDone(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_TOUR_STORAGE_KEY, serializeAppTourCompleted(userId));
    await Promise.all([
      AsyncStorage.removeItem(APP_TOUR_STORAGE_KEY_LEGACY),
      AsyncStorage.removeItem(APP_TOUR_STORAGE_KEY_LEGACY_DESKTOP),
    ]);
  } catch {
    /* ignore */
  }
}

export async function resetMobileAppTour(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(APP_TOUR_STORAGE_KEY),
      AsyncStorage.removeItem(APP_TOUR_STORAGE_KEY_LEGACY),
      AsyncStorage.removeItem(APP_TOUR_STORAGE_KEY_LEGACY_DESKTOP),
    ]);
  } catch {
    /* ignore */
  }
}

export function AppTour() {
  const { user, ready } = useAuth();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    if (user.usernameConfirmed === false) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    void readTourDone(user.id).then((done) => {
      if (cancelled) return;
      setChecked(true);
      if (!done) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  useEffect(() => {
    const onStart = () => {
      setStep(0);
      setOpen(true);
    };
    // RN’de EventTarget yok; basit global köprü
    const g = globalThis as typeof globalThis & {
      __dracordStartTour?: () => void;
    };
    g.__dracordStartTour = onStart;
    return () => {
      if (g.__dracordStartTour === onStart) delete g.__dracordStartTour;
    };
  }, []);

  const finish = useCallback(() => {
    void writeTourDone(user?.id);
    setOpen(false);
  }, [user?.id]);

  const next = () => {
    if (step >= APP_TOUR_STEPS.length - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  };

  const back = () => {
    if (step <= 0) return;
    setStep((s) => s - 1);
  };

  if (!checked || !open) return null;

  const current = APP_TOUR_STEPS[step]!;
  const cardW = Math.min(width - 32, 400);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(10, 8, 18, 0.82)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <View
          style={{
            width: cardW,
            borderRadius: 20,
            backgroundColor: '#282a36',
            borderWidth: 1,
            borderColor: '#44475a',
            padding: 20,
            gap: 12,
          }}
        >
          <Text style={{ color: '#6272a4', fontSize: 12, fontWeight: '600' }}>
            {step + 1} / {APP_TOUR_STEPS.length}
          </Text>
          <Text style={{ color: '#f8f8f2', fontSize: 20, fontWeight: '700' }}>
            {current.title}
          </Text>
          <Text style={{ color: '#9a95b0', fontSize: 14, lineHeight: 21 }}>
            {current.body}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            <Pressable onPress={finish} hitSlop={8}>
              <Text style={{ color: '#6272a4', fontSize: 14 }}>Atla</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {step > 0 ? (
                <Pressable onPress={back} hitSlop={8}>
                  <Text style={{ color: '#bd93f9', fontSize: 14 }}>Geri</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={next}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: '#bd93f9',
                }}
              >
                <Text style={{ color: '#1e1e2e', fontWeight: '700', fontSize: 14 }}>
                  {step >= APP_TOUR_STEPS.length - 1 ? 'Tamamla' : 'İleri'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function startMobileAppTour(): void {
  const g = globalThis as typeof globalThis & { __dracordStartTour?: () => void };
  g.__dracordStartTour?.();
}
