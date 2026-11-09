/**
 * macOS uzak kontrol smoke testi.
 * Çalıştır: node apps/desktop/scripts/remote-input-smoke-mac.js
 * Terminal'e Erişilebilirlik izni gerekir (Sistem Ayarları → Gizlilik → Erişilebilirlik).
 * Beklenen: "READY", imleç (400,300) sonra (600,400) noktasına gider.
 */
const { spawn } = require('child_process');
const Module = require('module');
const orig = Module._load;
Module._load = function (r, ...a) {
  if (r === 'electron') return { screen: {}, systemPreferences: {} };
  return orig.call(this, r, ...a);
};
const { _JXA } = require('../remote-input-mac');
if (process.platform !== 'darwin') {
  console.log('Yalnız macOS.');
  process.exit(0);
}
const p = spawn('osascript', ['-l', 'JavaScript', '-e', _JXA], { stdio: ['pipe', 'pipe', 'pipe'] });
let ok = false;
const on = (b) => {
  const t = String(b);
  process.stdout.write(t);
  if (!ok && t.includes('READY')) {
    ok = true;
    p.stdin.write('m 400 300\n');
    setTimeout(() => p.stdin.write('m 600 400\n'), 600);
    setTimeout(() => {
      p.stdin.write('Q\n');
      console.log('OK — imleç hareket ettiyse inject çalışıyor.');
    }, 1200);
  }
};
p.stdout.on('data', on);
p.stderr.on('data', on);
p.on('exit', (c) => {
  if (!ok) console.error('FAIL — JXA READY yazmadı. code=', c);
  process.exit(ok ? 0 : 1);
});
