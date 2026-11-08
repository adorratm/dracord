/**
 * Uzak kontrol inject smoke testi (yalnız Windows).
 * Çalıştır:  node apps/desktop/scripts/remote-input-smoke.js
 * Beklenen: "READY", imleç birincil ekranın ortasına, sonra sol üst çeyreğe gider; hata satırı yok.
 * Not: Electron gerekmez; PowerShell + C# (SendInput) derlemesini doğrular.
 */
const Module = require('module');
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'electron') return { screen: {} };
  return origLoad.call(this, req, ...rest);
};
const { spawn } = require('child_process');
const { _PS_BOOT } = require('../remote-input');

if (process.platform !== 'win32') {
  console.log('Yalnız Windows.');
  process.exit(0);
}
const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', _PS_BOOT], {
  stdio: ['pipe', 'pipe', 'pipe'],
});
let ok = false;
ps.stderr.on('data', (b) => process.stderr.write('[stderr] ' + b));
ps.stdout.on('data', (b) => {
  const t = String(b);
  process.stdout.write(t);
  if (!ok && t.includes('READY')) {
    ok = true;
    // 1920x1080 varsayımı yerine gerçek ekran: PS tarafı S satırıyla alır
    ps.stdin.write('S 0 0 1920 1080\n');
    ps.stdin.write('m 500000 500000\n');
    setTimeout(() => ps.stdin.write('m 250000 250000\n'), 600);
    setTimeout(() => {
      ps.stdin.write('Q\n');
      console.log('OK — imleç hareket ettiyse inject çalışıyor.');
    }, 1200);
  }
});
ps.on('exit', (code) => {
  if (!ok) console.error('FAIL — PowerShell READY yazmadı (Add-Type derleme hatası olabilir). code=', code);
  process.exit(ok ? 0 : 1);
});
