/**
 * Discord/Steam tarzı harici oyun overlay — şeffaf alwaysOnTop pencere + globalShortcut.
 * Ayrıca konuşan HUD (tıklanamaz, overlay kapalıyken de görünür).
 * Exclusive fullscreen oyunlarda güvenilir değildir; borderless önerilir.
 */
const { BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const os = require('os');
const path = require('path');

/** @type {BrowserWindow | null} */
let overlayWindow = null;
/** @type {BrowserWindow | null} */
let speakingHudWindow = null;
let visible = false;
let currentAccelerator = 'Control+Shift+`';
const DEFAULT_ACCELERATOR = 'Control+Shift+`';
const SPEAK_HOLD_MS = 2600;
const HUD_MAX_DEFAULT = 3;
const HUD_POSITIONS = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right']);

/** @type {{
 *  enabled: boolean,
 *  hotkey: string,
 *  followDisplay: boolean,
 *  showMembers: boolean,
 *  showQuickChat: boolean,
 *  opacity: number,
 *  watchPartyAdblock: boolean,
 *  hudEnabled: boolean,
 *  hudPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
 *  hudMax: number,
 *  perfHud: boolean,
 * }} */
let prefs = {
  enabled: true,
  hotkey: DEFAULT_ACCELERATOR,
  followDisplay: true,
  showMembers: true,
  showQuickChat: true,
  opacity: 0.94,
  watchPartyAdblock: true,
  hudEnabled: true,
  hudPosition: 'top-left',
  hudMax: HUD_MAX_DEFAULT,
  perfHud: false,
};

/** @type {{
 *  members: Array<{ id?: string; name: string; avatarUrl?: string | null; muted?: boolean; speaking?: boolean }>,
 *  toast?: string,
 *  inVoice?: boolean,
 *  selfMuted?: boolean,
 *  selfDeafened?: boolean,
 * }} */
let overlayState = {
  members: [],
  toast: '',
  inVoice: false,
  selfMuted: false,
  selfDeafened: false,
};

/** @type {Map<string, { id: string; name: string; avatarUrl: string | null; lastSpokeAt: number; speaking: boolean }>} */
const recentSpeakers = new Map();
/** @type {ReturnType<typeof setInterval> | null} */
let hudTickTimer = null;

/** @type {(() => void) | null} */
let displayUnsub = null;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function overlayHtml() {
  const opacity = Math.min(1, Math.max(0.4, Number(prefs.opacity) || 0.94));
  const membersDisplay = prefs.showMembers ? 'block' : 'none';
  const chatDisplay = prefs.showQuickChat ? 'flex' : 'none';
  const hotkeyHint = String(prefs.hotkey || DEFAULT_ACCELERATOR);
  const muteLabel = overlayState.selfMuted ? 'Mikrofon aç' : 'Sustur';
  const deafLabel = overlayState.selfDeafened ? 'Sağırlığı aç' : 'Sağırlaştır';
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
    button.active { background: #ff5555; color: #fff; }
    #members { list-style: none; margin: 0; padding: 0; max-height: 180px; overflow: auto; display: ${membersDisplay}; }
    #members li {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      font-size: 12px; padding: 4px 0; border-bottom: 1px solid #2a2d3a;
    }
    #members li .left { display: flex; align-items: center; gap: 8px; min-width: 0; }
    #members li img, #members li .av {
      width: 22px; height: 22px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
      background: #44475a;
    }
    #members li .av {
      display: grid; place-items: center; font-size: 10px; color: #f8f8f2;
    }
    #members li .meta { color: #6272a4; font-size: 10px; white-space: nowrap; }
    #members li.speaking .meta { color: #50fa7b; }
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
      <button type="button" id="btn-mute" class="${overlayState.selfMuted ? 'active' : ''}">${muteLabel}</button>
      <button type="button" id="btn-deafen" class="${overlayState.selfDeafened ? 'active' : ''}">${deafLabel}</button>
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
    const btnMute = document.getElementById('btn-mute');
    const btnDeafen = document.getElementById('btn-deafen');
    const setToast = (t) => { toastEl.textContent = t || ''; };
    const initial = (name) => (name || '?').trim().slice(0, 1).toUpperCase();
    const renderMembers = (list) => {
      membersEl.innerHTML = '';
      (list || []).forEach((m) => {
        const li = document.createElement('li');
        if (m.speaking) li.classList.add('speaking');
        const left = document.createElement('div');
        left.className = 'left';
        if (m.avatarUrl) {
          const img = document.createElement('img');
          img.src = m.avatarUrl;
          img.alt = '';
          img.referrerPolicy = 'no-referrer';
          left.appendChild(img);
        } else {
          const av = document.createElement('div');
          av.className = 'av';
          av.textContent = initial(m.name);
          left.appendChild(av);
        }
        const name = document.createElement('span');
        name.textContent = m.name || 'Üye';
        left.appendChild(name);
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = [m.speaking ? 'konuşuyor' : '', m.muted ? 'susturuldu' : ''].filter(Boolean).join(' · ');
        li.appendChild(left);
        li.appendChild(meta);
        membersEl.appendChild(li);
      });
    };
    const applySelf = (s) => {
      const muted = Boolean(s?.selfMuted);
      const deaf = Boolean(s?.selfDeafened);
      btnMute.textContent = muted ? 'Mikrofon aç' : 'Sustur';
      btnDeafen.textContent = deaf ? 'Sağırlığı aç' : 'Sağırlaştır';
      btnMute.classList.toggle('active', muted);
      btnDeafen.classList.toggle('active', deaf);
    };
    window.dracordOverlay?.onState?.((s) => {
      renderMembers(s?.members || []);
      applySelf(s);
      if (s?.toast) setToast(s.toast);
    });
    document.getElementById('btn-mute').onclick = () => {
      window.dracordOverlay?.toggleMute?.();
      setToast('Mikrofon komutu gönderildi');
    };
    document.getElementById('btn-deafen').onclick = () => {
      window.dracordOverlay?.toggleDeafen?.();
      setToast('Sağırlaştır komutu gönderildi');
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

/**
 * Konuşan HUD — bir kez yüklenir, içerik `window.__hud(data)` ile yerinde güncellenir
 * (her değişimde sayfa yeniden yüklenmez → titreme yok).
 */
function speakingHudHtml() {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
  <style>
    html, body {
      margin: 0; background: transparent !important; overflow: hidden; height: 100%;
      font-family: "Segoe UI", system-ui, sans-serif;
      pointer-events: none; user-select: none;
    }
    #root { padding: 12px; display: flex; flex-direction: column; gap: 8px; width: 216px; box-sizing: border-box; }
    body.right #root { align-items: flex-end; margin-left: auto; }
    body.bottom #root { position: absolute; bottom: 0; }
    body.bottom.right #root { right: 0; }
    .row {
      display: flex; align-items: center; gap: 10px; max-width: 100%;
      padding: 4px 10px 4px 4px; border-radius: 999px;
      background: rgba(10, 12, 18, 0.45); backdrop-filter: blur(6px);
      transition: opacity .35s ease;
    }
    .row.fade { opacity: 0.55; }
    .av {
      width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
      box-shadow: 0 0 0 2px rgba(35, 165, 90, 0.95), 0 0 10px rgba(35, 165, 90, 0.55);
      background: #44475a; display: grid; place-items: center; color: #f8f8f2; font-size: 14px; font-weight: 600;
    }
    .row.fade .av { box-shadow: 0 0 0 2px rgba(255,255,255,0.2); }
    .name { color: #fff; font-size: 13px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,.85);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
    .self { color: #ffb86c; font-size: 12px; font-weight: 700; }
    .perf { display: inline-flex; gap: 10px; padding: 3px 10px; border-radius: 8px; background: rgba(10,12,18,0.55);
      color: #e6e6f0; font-size: 11px; font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0,0,0,.8); }
    .perf b { color: #fff; font-weight: 700; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function () {
      var root = document.getElementById('root');
      function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
      window.__hud = function (d) {
        document.body.className = (d.position || 'top-left').split('-').join(' ');
        root.textContent = '';
        var rows = d.speakers || [];
        for (var i = 0; i < rows.length; i++) {
          var s = rows[i];
          var row = el('div', 'row' + (s.speaking ? '' : ' fade'));
          var av;
          if (s.avatarUrl && /^https:/.test(s.avatarUrl)) { av = el('img', 'av'); av.src = s.avatarUrl; av.alt = ''; av.referrerPolicy = 'no-referrer'; }
          else av = el('div', 'av', (s.name || '?').trim().slice(0, 1).toUpperCase());
          row.appendChild(av);
          row.appendChild(el('span', 'name', s.name || 'Üye'));
          root.appendChild(row);
        }
        if (d.self) root.appendChild(el('div', 'row self', d.self));
        if (d.perf) {
          var p = el('div', 'perf');
          [['CPU', d.perf.cpu + '%'], ['RAM', d.perf.ram + '%'], ['', d.perf.time]].forEach(function (x) {
            var span = el('span'); if (x[0]) span.appendChild(document.createTextNode(x[0] + ' ')); span.appendChild(el('b', '', x[1])); p.appendChild(span);
          });
          root.appendChild(p);
        }
      };
    })();
  </script>
</body>
</html>`;
}

/** Sistem CPU kullanımı (örnekler arası fark) */
let lastCpu = null;
function sampleCpuPercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  const prev = lastCpu;
  lastCpu = { idle, total };
  if (!prev || total <= prev.total) return 0;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - (idle - prev.idle) / (total - prev.total)))));
}
function perfSnapshot() {
  const ram = Math.round(100 * (1 - os.freemem() / Math.max(1, os.totalmem())));
  const d = new Date();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { cpu: sampleCpuPercent(), ram, time };
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

function positionSpeakingHud(win) {
  const display = targetDisplay();
  const { x, y, width, height } = display.workArea;
  const w = Math.min(240, width);
  const h = Math.min(60 + 46 * hudMax() + (prefs.perfHud ? 30 : 0), height);
  const pos = HUD_POSITIONS.has(prefs.hudPosition) ? prefs.hudPosition : 'top-left';
  const nx = pos.endsWith('right') ? x + width - w - 10 : x + 10;
  const ny = pos.startsWith('bottom') ? y + height - h - 10 : y + 10;
  win.setBounds({ x: nx, y: ny, width: w, height: h }, false);
}

function hudMax() {
  return Math.max(1, Math.min(6, Math.floor(Number(prefs.hudMax) || HUD_MAX_DEFAULT)));
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

function createSpeakingHudWindow() {
  if (speakingHudWindow && !speakingHudWindow.isDestroyed()) return speakingHudWindow;
  const display = targetDisplay();
  speakingHudWindow = new BrowserWindow({
    width: 240,
    height: 200,
    x: display.workArea.x + 10,
    y: display.workArea.y + 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    focusable: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  applyFullscreenAffinity(speakingHudWindow);
  try {
    speakingHudWindow.setIgnoreMouseEvents(true, { forward: true });
  } catch {
    speakingHudWindow.setIgnoreMouseEvents(true);
  }
  hudReady = false;
  speakingHudWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(speakingHudHtml())}`);
  speakingHudWindow.webContents.on('did-finish-load', () => {
    hudReady = true;
    lastHudFingerprint = '';
    renderSpeakingHud();
  });
  speakingHudWindow.on('closed', () => {
    speakingHudWindow = null;
    hudReady = false;
  });
  return speakingHudWindow;
}

function listHudSpeakers() {
  const now = Date.now();
  const all = [...recentSpeakers.values()]
    .filter((s) => s.speaking || now - s.lastSpokeAt <= SPEAK_HOLD_MS)
    .sort((a, b) => b.lastSpokeAt - a.lastSpokeAt)
    .slice(0, hudMax());
  return all;
}

/** @type {string} */
let lastHudFingerprint = '';
let hudReady = false;
let lastPerfAt = 0;
/** @type {{ cpu: number; ram: number; time: string } | null} */
let lastPerf = null;

function hudFingerprint(speakers) {
  return (speakers || [])
    .map((s) => `${s.id}:${s.speaking ? 1 : 0}:${s.name}:${s.avatarUrl || ''}`)
    .join('|');
}

function renderSpeakingHud() {
  const win = createSpeakingHudWindow();
  const speakers = overlayState.inVoice && prefs.hudEnabled ? listHudSpeakers() : [];
  const self =
    overlayState.inVoice && prefs.hudEnabled
      ? overlayState.selfDeafened
        ? 'Sağırlaştırıldın'
        : overlayState.selfMuted
          ? 'Mikrofonun kapalı'
          : ''
      : '';
  const perfOn = prefs.hudEnabled && prefs.perfHud && overlayState.inVoice;
  if (perfOn && Date.now() - lastPerfAt > 1500) {
    lastPerf = perfSnapshot();
    lastPerfAt = Date.now();
  }
  const perf = perfOn ? lastPerf : null;
  const show = speakers.length > 0 || Boolean(self) || Boolean(perf);
  const fp = `${hudFingerprint(speakers)}#${self}#${perf ? `${perf.cpu}/${perf.ram}/${perf.time}` : ''}#${prefs.hudPosition}`;
  if (prefs.followDisplay) positionSpeakingHud(win);
  applyFullscreenAffinity(win);
  try {
    win.setIgnoreMouseEvents(true, { forward: true });
  } catch {
    win.setIgnoreMouseEvents(true);
  }
  if (hudReady && fp !== lastHudFingerprint) {
    lastHudFingerprint = fp;
    const data = JSON.stringify({ speakers, self, perf, position: prefs.hudPosition });
    // JSON → JS literal; </script> enjeksiyonu yok (DOM API ile basılır)
    win.webContents.executeJavaScript(`window.__hud && window.__hud(${data})`, false).catch(() => undefined);
  }
  if (show) {
    if (!win.isVisible()) win.showInactive();
    win.moveTop();
  } else if (win.isVisible()) {
    win.hide();
  }
}

function ingestMembersForHud(members) {
  const now = Date.now();
  const seen = new Set();
  for (const m of members || []) {
    const id = String(m.id || m.name || '').trim();
    if (!id) continue;
    seen.add(id);
    const speaking = Boolean(m.speaking);
    const prev = recentSpeakers.get(id);
    if (speaking) {
      recentSpeakers.set(id, {
        id,
        name: String(m.name || 'Üye'),
        avatarUrl: typeof m.avatarUrl === 'string' ? m.avatarUrl : null,
        lastSpokeAt: now,
        speaking: true,
      });
    } else if (prev) {
      recentSpeakers.set(id, {
        ...prev,
        name: String(m.name || prev.name),
        avatarUrl:
          typeof m.avatarUrl === 'string' ? m.avatarUrl : prev.avatarUrl,
        speaking: false,
      });
    }
  }
  for (const [id, s] of [...recentSpeakers.entries()]) {
    if (!s.speaking && now - s.lastSpokeAt > SPEAK_HOLD_MS) {
      recentSpeakers.delete(id);
    }
  }
}

function ensureHudTicker() {
  if (hudTickTimer) return;
  hudTickTimer = setInterval(() => {
    const before = recentSpeakers.size;
    const now = Date.now();
    for (const [id, s] of [...recentSpeakers.entries()]) {
      if (!s.speaking && now - s.lastSpokeAt > SPEAK_HOLD_MS) {
        recentSpeakers.delete(id);
      }
    }
    if (recentSpeakers.size !== before || overlayState.inVoice) {
      renderSpeakingHud();
    }
    if (!overlayState.inVoice && recentSpeakers.size === 0 && hudTickTimer) {
      clearInterval(hudTickTimer);
      hudTickTimer = null;
    }
  }, 400);
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
    hudEnabled: next?.hudEnabled !== false,
    hudPosition: HUD_POSITIONS.has(next?.hudPosition) ? next.hudPosition : 'top-left',
    hudMax: Math.max(1, Math.min(6, Math.floor(Number(next?.hudMax) || HUD_MAX_DEFAULT))),
    perfHud: Boolean(next?.perfHud),
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
  if (speakingHudWindow && !speakingHudWindow.isDestroyed()) {
    positionSpeakingHud(speakingHudWindow);
    lastHudFingerprint = '';
    renderSpeakingHud();
  }
  return { ...prefs };
}

function applyOverlayState(state) {
  overlayState = {
    members: Array.isArray(state?.members) ? state.members.slice(0, 24) : [],
    toast:
      typeof state?.toast === 'string'
        ? state.toast.slice(0, 240)
        : overlayState.toast,
    inVoice: Boolean(state?.inVoice),
    selfMuted: Boolean(state?.selfMuted),
    selfDeafened: Boolean(state?.selfDeafened),
  };
  if (!overlayState.inVoice) {
    recentSpeakers.clear();
  } else {
    ingestMembersForHud(overlayState.members);
    ensureHudTicker();
  }
  pushStateToOverlay();
  // Mute/deafen etiketleri HTML’de; state değişince hafif reload yerine IPC yeterli
  // (ilk yüklemede self label HTML’de; canlı güncelleme onState ile)
  renderSpeakingHud();
}

/**
 * @param {{ showMainWindow: () => void, getMainWindow: () => import('electron').BrowserWindow | null, onPrefs?: (p: typeof prefs) => void }} deps
 */
function registerGameOverlay(deps) {
  createOverlayWindow();
  createSpeakingHudWindow();
  setOverlayVisible(false);
  registerHotkey(prefs.hotkey);

  const onDisplayChange = () => {
    if (prefs.followDisplay) {
      if (visible && overlayWindow && !overlayWindow.isDestroyed()) {
        positionOverlayOnDisplay(overlayWindow);
        applyFullscreenAffinity(overlayWindow);
      }
      if (speakingHudWindow && !speakingHudWindow.isDestroyed()) {
        positionSpeakingHud(speakingHudWindow);
        applyFullscreenAffinity(speakingHudWindow);
      }
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
    if (speakingHudWindow && !speakingHudWindow.isDestroyed()) {
      positionSpeakingHud(speakingHudWindow);
      applyFullscreenAffinity(speakingHudWindow);
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
    applyOverlayState(state || {});
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
    setState: (state) => applyOverlayState(state || {}),
    applyPrefs,
    getPrefs: () => ({ ...prefs }),
    destroy: () => {
      unregisterHotkey();
      displayUnsub?.();
      displayUnsub = null;
      if (hudTickTimer) {
        clearInterval(hudTickTimer);
        hudTickTimer = null;
      }
      if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.destroy();
      overlayWindow = null;
      if (speakingHudWindow && !speakingHudWindow.isDestroyed()) {
        speakingHudWindow.destroy();
      }
      speakingHudWindow = null;
    },
  };
}

module.exports = { registerGameOverlay, DEFAULT_ACCELERATOR };
