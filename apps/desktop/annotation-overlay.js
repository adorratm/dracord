/**
 * A4 — paylaşan kişinin GERÇEK ekranında çizimler: şeffaf, tıklanamaz, her zaman üstte pencere.
 * Yalnız ekran paylaşımında (pencere paylaşımında konum güvenilir değil). İçerik renderer'dan
 * IPC ile gelir (normalize çizgiler), sayfa bir kez yüklenir.
 */
const { BrowserWindow, ipcMain } = require('electron');

/** @type {BrowserWindow | null} */
let win = null;
let ready = false;
/** @type {string | null} */
let pending = null;

const COLORS = ['#ff5555', '#f1fa8c', '#50fa7b', '#8be9fd', '#ff79c6', '#ffffff'];

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'" />
<style>html,body{margin:0;height:100%;background:transparent!important;overflow:hidden;pointer-events:none}canvas{width:100%;height:100%;display:block}</style>
</head><body><canvas id="c"></canvas><script>
(function(){
  var C=${JSON.stringify(COLORS)};
  var c=document.getElementById('c'),g=c.getContext('2d');
  window.__draw=function(strokes){
    var dpr=window.devicePixelRatio||1,w=innerWidth,h=innerHeight;
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
    g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
    g.lineCap='round';g.lineJoin='round';g.lineWidth=Math.max(3,Math.min(7,w/320));
    g.shadowColor='rgba(0,0,0,0.6)';g.shadowBlur=3;
    for(var i=0;i<strokes.length;i++){var s=strokes[i],p=s.p;if(!p||!p.length)continue;
      g.globalAlpha=s.a;g.strokeStyle=C[s.c]||C[0];g.beginPath();
      for(var j=0;j<p.length;j+=2){var x=p[j]*w,y=p[j+1]*h;if(j===0)g.moveTo(x,y);else g.lineTo(x,y);}
      if(p.length===2)g.lineTo(p[0]*w+0.1,p[1]*h);g.stroke();
      if(s.n){var lx=p[p.length-2]*w,ly=p[p.length-1]*h;g.shadowBlur=0;g.globalAlpha=Math.min(1,s.a);
        g.font='600 13px system-ui,sans-serif';var tw=g.measureText(s.n).width;g.fillStyle='rgba(0,0,0,0.6)';
        g.fillRect(lx+10,ly-20,tw+10,18);g.fillStyle='#fff';g.fillText(s.n,lx+15,ly-6);g.shadowBlur=3;}
    }
    g.globalAlpha=1;
  };
})();
</script></body></html>`;

function ensureWindow(bounds) {
  if (win && !win.isDestroyed()) {
    const b = win.getBounds();
    if (b.x !== bounds.x || b.y !== bounds.y || b.width !== bounds.width || b.height !== bounds.height) win.setBounds(bounds, false);
    return win;
  }
  ready = false;
  win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    // Paylaşılan görüntüye çizimler tekrar girmesin (izleyenler zaten kendi katmanında görür)
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    win.setContentProtection(true);
  } catch {
    /* ignore */
  }
  try {
    win.setAlwaysOnTop(true, 'screen-saver');
  } catch {
    /* ignore */
  }
  try {
    win.setIgnoreMouseEvents(true, { forward: true });
  } catch {
    win.setIgnoreMouseEvents(true);
  }
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(HTML)}`);
  win.webContents.on('did-finish-load', () => {
    ready = true;
    if (pending) flush();
  });
  win.on('closed', () => {
    win = null;
    ready = false;
  });
  return win;
}

function flush() {
  if (!win || win.isDestroyed() || !ready || pending === null) return;
  const data = pending;
  pending = null;
  win.webContents.executeJavaScript(`window.__draw && window.__draw(${data})`, false).catch(() => undefined);
}

function hide() {
  pending = null;
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.executeJavaScript('window.__draw && window.__draw([])', false).catch(() => undefined);
    } catch {
      /* ignore */
    }
    win.hide();
  }
}

/**
 * @param {{ getShareDisplayBounds: () => { x: number, y: number, width: number, height: number } | null }} deps
 */
function registerAnnotationOverlay(deps) {
  ipcMain.handle('annotations:render', (_e, payload) => {
    const strokes = Array.isArray(payload) ? payload.slice(0, 200) : [];
    if (!strokes.length) {
      hide();
      return { ok: true };
    }
    const bounds = deps.getShareDisplayBounds();
    if (!bounds) {
      hide();
      return { ok: false, error: 'window_share' };
    }
    // Yalnız beklenen alanlar, sayı aralıkları kırpılır
    const clean = strokes.map((s) => {
      const p = Array.isArray(s?.p) ? s.p.slice(0, 8000).map((v) => Math.min(1, Math.max(0, Number(v) || 0))) : [];
      return {
        c: Math.max(0, Math.min(COLORS.length - 1, Math.floor(Number(s?.c) || 0))),
        a: Math.max(0, Math.min(1, Number(s?.a) || 0)),
        n: typeof s?.n === 'string' ? s.n.slice(0, 32) : '',
        p,
      };
    });
    const w = ensureWindow(bounds);
    pending = JSON.stringify(clean);
    flush();
    if (!w.isVisible()) w.showInactive();
    return { ok: true };
  });
  ipcMain.handle('annotations:hide', () => {
    hide();
    return { ok: true };
  });
  return {
    destroy() {
      if (win && !win.isDestroyed()) win.destroy();
      win = null;
    },
  };
}

module.exports = { registerAnnotationOverlay };
