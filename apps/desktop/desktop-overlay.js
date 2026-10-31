/**
 * Discord/Steam tarzı harici oyun overlay — şeffaf alwaysOnTop pencere + globalShortcut.
 * Exclusive fullscreen oyunlarda güvenilir değildir; borderless önerilir.
 */
const { BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');

/** @type {BrowserWindow | null} */
let overlayWindow = null;
let visible = false;
let currentAccelerator = 'Control+Shift+`';
const DEFAULT_ACCELERATOR = 'Control+Shift+`';

/** @type {{
 *  enabled: boolean,
 *  hotkey: string,
 *  followDisplay: boolean,
 *  showMembers: boolean,
 *  showQuickChat: boolean,
 *  opacity: number,
 *  watchPartyAdblock: boolean,
 * }} */
let prefs = {
  enabled: true,
  hotkey: DEFAULT_ACCELERATOR,
  followDisplay: true,
  showMembers: true,
  showQuickChat: true,
  opacity: 0.94,
  watchPartyAdblock: true,
};

/** @type {{ members: Array<{ name: string; muted?: boolean; speaking?: boolean }>, toast?: string }} */
let overlayState = { members: [], toast: '' };

/** @type {(() => void) | null} */
let displayUnsub = null;

function overlayHtml() {
  const opacity = Math.min(1, Math.max(0.4, Number(prefs.opacity) || 0.94));
  const membersDisplay = prefs.showMembers ? 'block' : 'none';
  const chatDisplay = prefs.showQuickChat ? 'flex' : 'none';
  const hotkeyHint = String(prefs.hotkey || DEFAULT_ACCELERATOR);
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Dracord Overlay</title>
  <style>
    html, body { margin: 0; background: transparent; overflow: hidden; font-family: system-ui, sans-serif; }
    #panel {
      margin: 24px; width: 300px; max-height: 74vh; overflow: auto;
      background: rgba(17, 19, 30, ${opacity}); color: #e1e1f1;
      border: 1px solid #44475a; border-radius: 12px; padding: 12px 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,.45);
    }
    h1 { font-size: 14px; margin: 0 0 6px; color: #bd93f9; }
    p.hint { font-size: 11px; margin: 0 0 10px; color: #6272a4; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    button {
      cursor: pointer; border: 0; border-radius: 8px; padding: 8px 10px;
      background: #44475a; color: #f8f8f2; font-size: 12px;
    }
    button:hover { background: #6272a4; }
    #members { list-style: none; margin: 0; padding: 0; max-height: 180px; overflow: auto; display: ${membersDisplay}; }
    #members li {
      display: flex; justify-content: space-between; gap: 8px;
      font-size: 12px; padding: 4px 0; border-bottom: 1px solid #2a2d3a;
    }
    #members li .meta { color: #6272a4; font-size: 10px; }
    #toast {
      font-size: 11px; color: #50fa7b; min-height: 1.2em; margin-top: 8px;
      white-space: pre-wrap; word-break: break-word;
    }
    #chat {
      margin-top: 8px; display: ${chatDisplay}; gap: 6px;
    }
    #chat input {
      flex: 1; border-radius: 8px; border: 1px solid #44475a; background: #11131e;
      color: #f8f8f2; padding: 6px 8px; font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="panel">
    <h1>Dracord Overlay</h1>
    <p class="hint">${hotkeyHint} ile kapat · borderless oyun önerilir</p>
    <div class="row">
      <button type="button" id="btn-mute">Mikrofon</button>
      <button type="button" id="btn-deafen">Sağırlaştır</button>
      <button type="button" id="btn-main">Ana pencere</button>
    </div>
    <ul id="members"></ul>
    <div id="chat">
      <input id="chat-input" maxlength="200" placeholder="Hızlı mesaj (toast)…" />
      <button type="button" id="btn-send">Gönder</button>
    </div>
    <div id="toast"></div>
  </div>
  <script>
    const toastEl = document.getElementById('toast');
    const membersEl = document.getElementById('members');
    const setToast = (t) => { toastEl.textContent = t || ''; };
    const renderMembers = (list) => {
      membersEl.innerHTML = '';
      (list || []).forEach((m) => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.textContent = m.name || 'Üye';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = [m.speaking ? 'konuşuyor' : '', m.muted ? 'susturuldu' : ''].filter(Boolean).join(' · ');
        li.appendChild(name);
        li.appendChild(meta);
        membersEl.appendChild(li);
      });
    };
    window.dracordOverlay?.onState?.((s) => {
      renderMembers(s?.members || []);
      if (s?.toast) setToast(s.toast);
    });
    document.getElementById('btn-mute').onclick = () => {
      window.dracordOverlay?.toggleMute?.();
      setToast('Mute komutu gönderildi');
    };
    document.getElementById('btn-deafen').onclick = () => {
      window.dracordOverlay?.toggleDeafen?.();
      setToast('Deafen komutu gönderildi');
    };
    document.getElementById('btn-main').onclick = () => {
      window.dracordOverlay?.showMain?.();
    };
    document.getElementById('btn-send').onclick = () => {
      const input = document.getElementById('chat-input');
      const text = (input.value || '').trim();
      if (!text) return;
      window.dracordOverlay?.sendQuickChat?.(text);
      input.value = '';
      setToast('Gönderildi: ' + text);
    };
  </script>
</body>
</html>`;
}

function pushStateToOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const members = prefs.showMembers ? overlayState.members : [];
  overlayWindow.webContents.send('overlay:state', {
    ...overlayState,
    members,
  });
}

function reloadOverlayUi() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml())}`,
  );
}

function targetDisplay() {
  try {
    const pt = screen.getCursorScreenPoint();
    return screen.getDisplayNearestPoint(pt) || screen.getPrimaryDisplay();
  } catch {
    return screen.getPrimaryDisplay();
  }
}

function positionOverlayOnDisplay(win) {
  const display = targetDisplay();
  const { x, y, width, height } = display.workArea;
  const w = Math.min(380, width);
  const h = Math.min(420, height);
  win.setBounds({ x: x + 24, y: y + 24, width: w, height: h }, false);
}

function applyFullscreenAffinity(win) {
  try {
    win.setAlwaysOnTop(true, 'screen-saver');
  } catch {
    try {
      win.setAlwaysOnTop(true);
    } catch {
      /* ignore */
    }
  }
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    /* ignore */
  }
  if (process.platform === 'win32') {
    try {
      win.setAlwaysOnTop(true, 'pop-up-menu', 1);
    } catch {
      /* ignore */
    }
  }
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;
  const display = targetDisplay();
  const { width, height } = display.workAreaSize;
  overlayWindow = new BrowserWindow({
    width: Math.min(380, width),
    height: Math.min(420, height),
    x: display.workArea.x + 24,
    y: display.workArea.y + 24,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  applyFullscreenAffinity(overlayWindow);
  overlayWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml())}`,
  );
  overlayWindow.webContents.on('did-finish-load', () => pushStateToOverlay());
  overlayWindow.on('closed', () => {
    overlayWindow = null;
    visible = false;
  });
  return overlayWindow;
}

function setOverlayVisible(next) {
  if (!prefs.enabled && next) return false;
  const win = createOverlayWindow();
  visible = Boolean(next);
  if (visible) {
    if (prefs.followDisplay) positionOverlayOnDisplay(win);
    applyFullscreenAffinity(win);
    win.setIgnoreMouseEvents(false);
    win.showInactive();
    win.moveTop();
    pushStateToOverlay();
  } else {
    win.setIgnoreMouseEvents(true, { forward: true });
    win.hide();
  }
  return visible;
}

function toggleOverlay() {
  if (!prefs.enabled) {
    setOverlayVisible(false);
    return false;
  }
  setOverlayVisible(!visible);
  return visible;
}

function unregisterHotkey() {
  try {
    if (currentAccelerator) globalShortcut.unregister(currentAccelerator);
  } catch {
    /* ignore */
  }
}

function registerHotkey(accel) {
  unregisterHotkey();
  const next = String(accel || DEFAULT_ACCELERATOR).trim() || DEFAULT_ACCELERATOR;
  currentAccelerator = next;
  if (!prefs.enabled) return false;
  const ok = globalShortcut.register(next, () => {
    toggleOverlay();
  });
  if (!ok) {
    console.warn('[overlay] globalShortcut register failed:', next);
  }
  return ok;
}

function applyPrefs(next) {
  const prev = { ...prefs };
  prefs = {
    enabled: next?.enabled !== false,
    hotkey: String(next?.hotkey || DEFAULT_ACCELERATOR),
    followDisplay: next?.followDisplay !== false,
    showMembers: next?.showMembers !== false,
    showQuickChat: next?.showQuickChat !== false,
    opacity: Math.min(1, Math.max(0.4, Number(next?.opacity) || 0.94)),
    watchPartyAdblock: next?.watchPartyAdblock !== false,
  };
  if (prev.hotkey !== prefs.hotkey || prev.enabled !== prefs.enabled) {
    registerHotkey(prefs.hotkey);
  }
  if (!prefs.enabled) {
    setOverlayVisible(false);
  }
  if (
    prev.opacity !== prefs.opacity ||
    prev.showMembers !== prefs.showMembers ||
    prev.showQuickChat !== prefs.showQuickChat ||
    prev.hotkey !== prefs.hotkey
  ) {
    reloadOverlayUi();
  } else {
    pushStateToOverlay();
  }
  return { ...prefs };
}

/**
 * @param {{ showMainWindow: () => void, getMainWindow: () => import('electron').BrowserWindow | null, onPrefs?: (p: typeof prefs) => void }} deps
 */
function registerGameOverlay(deps) {
  createOverlayWindow();
  setOverlayVisible(false);
  registerHotkey(prefs.hotkey);

  const onDisplayChange = () => {
    if (
      prefs.followDisplay &&
      visible &&
      overlayWindow &&
      !overlayWindow.isDestroyed()
    ) {
      positionOverlayOnDisplay(overlayWindow);
      applyFullscreenAffinity(overlayWindow);
    }
  };
  screen.on('display-metrics-changed', onDisplayChange);
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);
  displayUnsub = () => {
    try {
      screen.removeListener('display-metrics-changed', onDisplayChange);
      screen.removeListener('display-added', onDisplayChange);
      screen.removeListener('display-removed', onDisplayChange);
    } catch {
      /* ignore */
    }
  };

  ipcMain.handle('overlay:toggle', () => toggleOverlay());
  ipcMain.handle('overlay:reposition', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      positionOverlayOnDisplay(overlayWindow);
      applyFullscreenAffinity(overlayWindow);
    }
    return true;
  });
  ipcMain.handle('overlay:is-visible', () => visible);
  ipcMain.handle('overlay:get-prefs', () => ({ ...prefs }));
  ipcMain.handle('overlay:set-prefs', (_e, next) => {
    const applied = applyPrefs(next || {});
    deps.onPrefs?.(applied);
    return applied;
  });
  ipcMain.handle('overlay:show-main', () => {
    deps.showMainWindow();
    return true;
  });
  ipcMain.handle('overlay:voice-toggle', (_e, kind) => {
    const main = deps.getMainWindow?.();
    if (main && !main.isDestroyed()) {
      main.webContents.send('overlay:voice-command', { kind });
    }
    return true;
  });
  ipcMain.handle('overlay:set-state', (_e, state) => {
    overlayState = {
      members: Array.isArray(state?.members) ? state.members.slice(0, 24) : [],
      toast:
        typeof state?.toast === 'string'
          ? state.toast.slice(0, 240)
          : overlayState.toast,
    };
    pushStateToOverlay();
    return true;
  });
  ipcMain.handle('overlay:quick-chat', (_e, text) => {
    if (!prefs.showQuickChat) return false;
    const main = deps.getMainWindow?.();
    const msg = String(text || '').trim().slice(0, 200);
    if (main && !main.isDestroyed() && msg) {
      main.webContents.send('overlay:quick-chat', { text: msg });
    }
    overlayState = {
      ...overlayState,
      toast: msg ? `Sen: ${msg}` : overlayState.toast,
    };
    pushStateToOverlay();
    return true;
  });

  return {
    toggle: toggleOverlay,
    setState: (state) => {
      overlayState = {
        members: Array.isArray(state?.members) ? state.members.slice(0, 24) : [],
        toast:
          typeof state?.toast === 'string' ? state.toast : overlayState.toast,
      };
      pushStateToOverlay();
    },
    applyPrefs,
    getPrefs: () => ({ ...prefs }),
    destroy: () => {
      unregisterHotkey();
      displayUnsub?.();
      displayUnsub = null;
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
      overlayWindow = null;
    },
  };
}

module.exports = { registerGameOverlay, DEFAULT_ACCELERATOR };
