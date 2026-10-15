import { Platform, DeviceEventEmitter, type EmitterSubscription } from 'react-native';

export const VOICE_CALL_EVENTS = {
  MUTE_TOGGLE: 'dracord.voice.muteToggle',
  DEAFEN_TOGGLE: 'dracord.voice.deafenToggle',
  LEAVE: 'dracord.voice.leave',
  OPEN: 'dracord.voice.open',
} as const;

type StartOpts = {
  channelName: string;
  muted?: boolean;
  deafened?: boolean;
  connected?: boolean;
  camOn?: boolean;
  screenSharing?: boolean;
};

let androidServiceReady = false;
let androidClickBridge: (() => void) | null = null;
let lastOpts: StartOpts | null = null;

function buildMessage(opts: StartOpts): string {
  if (opts.connected === false) return `${opts.channelName} · bağlanıyor…`;
  const bits: string[] = [opts.channelName, 'seste'];
  if (opts.muted) bits.push('mikrofon kapalı');
  if (opts.deafened) bits.push('kulaklık kapalı');
  if (opts.camOn) bits.push('kamera açık');
  if (opts.screenSharing) bits.push('ekran paylaşılıyor');
  return bits.join(' · ');
}

async function ensureAndroidService() {
  if (Platform.OS !== 'android' || androidServiceReady) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactNativeForegroundService = require('@supersami/rn-foreground-service').default;
    ReactNativeForegroundService.register({
      config: {
        alert: false,
        onServiceErrorCallBack: () => {
          /* LogBox spam olmasın */
        },
      },
    });
    if (!androidClickBridge) {
      const cleanup = ReactNativeForegroundService.eventListener(
        (payload: { main?: string; button?: string; button2?: string } | null) => {
          const action = payload?.button2 || payload?.button || payload?.main;
          if (typeof action === 'string' && action.length > 0) {
            DeviceEventEmitter.emit(action);
          }
        },
      );
      androidClickBridge = typeof cleanup === 'function' ? cleanup : () => undefined;
    }
    androidServiceReady = true;
  } catch {
    /* native modül yoksa (Expo Go) sessizce geç */
  }
}

async function notifyIos(title: string, message: string) {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      identifier: 'dracord-voice-ongoing',
      content: {
        title,
        body: message,
        sticky: true,
        data: { type: 'voice-ongoing' },
      },
      trigger: null,
    });
  } catch {
    /* notifications izni yok */
  }
}

const androidNotificationBase = (title: string, message: string) => ({
  id: 7342,
  title,
  message,
  icon: 'ic_launcher',
  importance: 'low' as const,
  vibration: false,
  visibility: 'public' as const,
  // Android 14+: mikrofon + medya (ekran paylaşımı / kamera için FGS tipi manifestte)
  ServiceType: 'microphone|mediaPlayback',
  button: true,
  button2: true,
  buttonText: 'Mikrofon',
  button2Text: 'Ayrıl',
  buttonOnPress: VOICE_CALL_EVENTS.MUTE_TOGGLE,
  button2OnPress: VOICE_CALL_EVENTS.LEAVE,
  mainOnPress: VOICE_CALL_EVENTS.OPEN,
  setOnlyAlertOnce: true,
  color: '#bd93f9',
});

/** Ses oturumu aktifken arka plan + bildirim şeridi / ada */
export async function startVoiceCallService(opts: StartOpts) {
  lastOpts = opts;
  const title = 'Dracord Ses';
  const message = buildMessage(opts);

  if (Platform.OS === 'android') {
    await ensureAndroidService();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ReactNativeForegroundService = require('@supersami/rn-foreground-service').default;
      if (ReactNativeForegroundService.is_running?.()) {
        await ReactNativeForegroundService.update(androidNotificationBase(title, message));
      } else {
        await ReactNativeForegroundService.start(androidNotificationBase(title, message));
      }
    } catch {
      /* Expo Go / eksik native */
    }
  } else if (Platform.OS === 'ios') {
    await notifyIos(title, message);
  }
}

export async function updateVoiceCallService(opts: Partial<StartOpts> & { channelName?: string }) {
  const merged: StartOpts = {
    channelName: opts.channelName ?? lastOpts?.channelName ?? 'Ses kanalı',
    muted: opts.muted ?? lastOpts?.muted,
    deafened: opts.deafened ?? lastOpts?.deafened,
    connected: opts.connected ?? lastOpts?.connected,
    camOn: opts.camOn ?? lastOpts?.camOn,
    screenSharing: opts.screenSharing ?? lastOpts?.screenSharing,
  };
  lastOpts = merged;
  const title = 'Dracord Ses';
  const message = buildMessage(merged);

  if (Platform.OS === 'android') {
    await ensureAndroidService();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ReactNativeForegroundService = require('@supersami/rn-foreground-service').default;
      if (ReactNativeForegroundService.is_running?.()) {
        await ReactNativeForegroundService.update(androidNotificationBase(title, message));
      } else {
        await ReactNativeForegroundService.start(androidNotificationBase(title, message));
      }
    } catch {
      /* ignore */
    }
  } else if (Platform.OS === 'ios') {
    await notifyIos(title, message);
  }
}

export async function stopVoiceCallService() {
  lastOpts = null;
  if (Platform.OS === 'android') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ReactNativeForegroundService = require('@supersami/rn-foreground-service').default;
      await ReactNativeForegroundService.stop();
    } catch {
      /* ignore */
    }
  }
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.dismissNotificationAsync('dracord-voice-ongoing');
  } catch {
    /* ignore */
  }
}

export function setupVoiceCallServiceListeners(
  handlers: Partial<{
    onMuteToggle: () => void;
    onDeafenToggle: () => void;
    onLeave: () => void;
    onOpen: () => void;
  }>,
) {
  const subs: EmitterSubscription[] = [];
  if (handlers.onMuteToggle) {
    subs.push(DeviceEventEmitter.addListener(VOICE_CALL_EVENTS.MUTE_TOGGLE, handlers.onMuteToggle));
  }
  if (handlers.onDeafenToggle) {
    subs.push(
      DeviceEventEmitter.addListener(VOICE_CALL_EVENTS.DEAFEN_TOGGLE, handlers.onDeafenToggle),
    );
  }
  if (handlers.onLeave) {
    subs.push(DeviceEventEmitter.addListener(VOICE_CALL_EVENTS.LEAVE, handlers.onLeave));
  }
  if (handlers.onOpen) {
    subs.push(DeviceEventEmitter.addListener(VOICE_CALL_EVENTS.OPEN, handlers.onOpen));
  }
  return () => {
    for (const s of subs) s.remove();
  };
}
