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

type DracordDesktopApi = {
  isElectron: true;
  setSystemPrefs: (prefs: { openOnStartup?: boolean; minimizeToTray?: boolean }) => void;
  openExternal?: (url: string) => Promise<{ ok: boolean; error?: string }>;
  getDesktopSources: () => Promise<DracordDesktopCaptureSource[]>;
  setDisplayMediaSelection: (selection: {
    sourceId: string;
    systemAudio: boolean;
  }) => Promise<{ ok: boolean }>;
  clearDisplayMediaSelection: () => Promise<{ ok: boolean }>;
  synthesizeDealerTts?: (text: string) => Promise<DracordDesktopDealerTtsResult>;
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
