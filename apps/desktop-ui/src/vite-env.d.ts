/// <reference types="vite/client" />

type DracordDesktopCaptureSource = {
  id: string;
  name: string;
  displayId: string;
  thumbnail: string;
  appIcon: string | null;
  kind: 'screen' | 'window';
};

type DracordDesktopDealerTtsResult =
  | { ok: true; base64: string; mime: string; voice?: string }
  | { ok: false; error: string };

type DracordDesktopSystemPrefs = {
  openOnStartup?: boolean;
  minimizeToTray?: boolean;
  autoUpdate?: boolean;
};

type DracordDesktopSystemPrefsResult = {
  ok?: boolean;
  openOnStartup?: boolean;
  minimizeToTray?: boolean;
  autoUpdate?: boolean;
  openAtLoginApplied?: boolean;
  error?: string;
};

type DracordDesktopUpdaterStatus = {
  status: string;
  version?: string;
  currentVersion?: string;
  percent?: number;
  message?: string;
};

type DracordDesktopApi = {
  isElectron: true;
  setSystemPrefs: (
    prefs: DracordDesktopSystemPrefs,
  ) => void | Promise<DracordDesktopSystemPrefsResult>;
  getSystemPrefs?: () => Promise<DracordDesktopSystemPrefsResult>;
  openExternal?: (url: string) => Promise<{ ok: boolean; error?: string }>;
  openOAuth?: (url: string) => Promise<{ ok: boolean; error?: string }>;
  getDesktopSources: () => Promise<DracordDesktopCaptureSource[]>;
  setDisplayMediaSelection: (selection: {
    sourceId: string;
    systemAudio: boolean;
  }) => Promise<{ ok: boolean }>;
  clearDisplayMediaSelection: () => Promise<{ ok: boolean }>;
  synthesizeDealerTts?: (text: string) => Promise<DracordDesktopDealerTtsResult>;
  getAppVersion?: () => Promise<string>;
  checkForUpdates?: () => Promise<{ ok: boolean; dev?: boolean }>;
  downloadUpdate?: () => Promise<{ ok: boolean; error?: string }>;
  installUpdate?: () => Promise<{ ok: boolean; error?: string }>;
  onUpdaterStatus?: (
    callback: (payload: DracordDesktopUpdaterStatus) => void,
  ) => () => void;
};

interface Window {
  windowControls?: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    isElectron: boolean;
  };
  dracordDesktop?: DracordDesktopApi;
}
