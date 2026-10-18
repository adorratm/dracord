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

type DracordRegisteredGame = {
  appId: string;
  name: string;
  exePath?: string | null;
  exeName?: string | null;
  imageUrl?: string | null;
  url?: string | null;
  source?: string;
  enabled?: boolean;
  installPath?: string | null;
  installDir?: string | null;
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
  detectGames?: () => Promise<{
    ok: boolean;
    games: Array<{
      appId: string;
      name: string;
      imageUrl?: string | null;
      url?: string | null;
      details?: string | null;
    }>;
    error?: string;
  }>;
  scanGameLibrary?: () => Promise<{
    ok: boolean;
    games: Array<DracordRegisteredGame>;
    steamCount?: number;
    epicCount?: number;
    error?: string;
  }>;
  importGameScan?: () => Promise<{
    ok: boolean;
    games?: Array<DracordRegisteredGame>;
    added?: number;
    error?: string;
  }>;
  getRegisteredGames?: () => Promise<{
    ok: boolean;
    games: Array<DracordRegisteredGame>;
    error?: string;
  }>;
  addManualGame?: (entry: {
    exePath: string;
    name?: string;
    imageUrl?: string | null;
    url?: string | null;
  }) => Promise<{ ok: boolean; games?: Array<DracordRegisteredGame>; error?: string }>;
  removeRegisteredGame?: (
    appId: string,
  ) => Promise<{ ok: boolean; games?: Array<DracordRegisteredGame>; error?: string }>;
  setGameEnabled?: (
    appId: string,
    enabled: boolean,
  ) => Promise<{ ok: boolean; games?: Array<DracordRegisteredGame>; error?: string }>;
  pickGameExe?: () => Promise<{
    ok: boolean;
    canceled?: boolean;
    exePath?: string;
    name?: string;
    error?: string;
  }>;
  onSpotifyOAuthDone?: (
    callback: (payload: { status?: string }) => void,
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
