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
  manual?: boolean;
  dev?: boolean;
};

type DracordRegisteredGame = {
  appId: string;
  name: string;
  exePath?: string | null;
  exeName?: string | null;
  exeNames?: string[];
  imageUrl?: string | null;
  url?: string | null;
  source?: string;
  enabled?: boolean;
  installPath?: string | null;
  installDir?: string | null;
  steamAppId?: string | null;
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
  checkForUpdates?: () => Promise<{
    ok: boolean;
    dev?: boolean;
    currentVersion?: string;
    error?: string;
  }>;
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
    steamRoot?: string | null;
    error?: string;
  }>;
  importGameScan?: () => Promise<{
    ok: boolean;
    games?: Array<DracordRegisteredGame>;
    added?: number;
    steamCount?: number;
    epicCount?: number;
    steamRoot?: string | null;
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
  renameRegisteredGame?: (
    appId: string,
    name: string,
  ) => Promise<{ ok: boolean; games?: Array<DracordRegisteredGame>; error?: string }>;
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
    games?: Array<DracordRegisteredGame>;
    error?: string;
  }>;
  onSpotifyOAuthDone?: (
    callback: (payload: { status?: string }) => void,
  ) => () => void;
  toggleGameOverlay?: () => Promise<unknown>;
  isGameOverlayVisible?: () => Promise<boolean>;
  setGameOverlayState?: (state: unknown) => Promise<unknown>;
  setOverlayPrefs?: (prefs: {
    enabled?: boolean;
    hotkey?: string;
    followDisplay?: boolean;
    showMembers?: boolean;
    showQuickChat?: boolean;
    opacity?: number;
    watchPartyAdblock?: boolean;
  }) => Promise<unknown>;
  getOverlayPrefs?: () => Promise<Record<string, unknown>>;
  setWatchPartyAdblock?: (enabled: boolean) => Promise<unknown>;
  setRemoteControlBounds?: (bounds: {
    x?: number;
    y?: number;
    width: number;
    height: number;
  } | null) => Promise<unknown>;
  injectRemoteControlInput?: (ev: {
    type: string;
    nx?: number;
    ny?: number;
    button?: number;
    deltaY?: number;
    key?: string;
    code?: string;
    keyAction?: string;
  }) => Promise<{ ok?: boolean; error?: string }>;
  onOverlayVoiceCommand?: (
    callback: (payload: unknown) => void,
  ) => () => void;
  onOverlayQuickChat?: (callback: (payload: unknown) => void) => () => void;
  /** Klip kaydı (A3) */
  setClipArmed?: (armed: boolean) => Promise<{ ok: boolean; accelerator: string | null }>;
  saveClip?: (data: Uint8Array, name: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  openClipsFolder?: (filePath?: string | null) => Promise<{ ok: boolean }>;
  onClipHotkey?: (callback: () => void) => () => void;
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
