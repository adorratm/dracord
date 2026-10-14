/**
 * Vite (desktop-ui) + Electron birlikte.
 * Vite hazır olunca Electron açılır.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const viteUrl = 'http://127.0.0.1:5173';

function waitForVite(timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(viteUrl, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error('Vite 5173 zaman aşımı'));
          return;
        }
        setTimeout(tick, 400);
      });
    };
    tick();
  });
}

const vite = spawn(
  process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
  ['workspace', '@dracord/desktop-ui', 'dev'],
  { cwd: root, stdio: 'inherit', shell: true, env: process.env },
);

void (async () => {
  try {
    await waitForVite();
    const electron = spawn(
      process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
      ['workspace', '@dracord/desktop', 'electron:dev'],
      {
        cwd: root,
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, DRACORD_ELECTRON_DEV: '1' },
      },
    );
    electron.on('exit', (code) => {
      vite.kill();
      process.exit(code ?? 0);
    });
  } catch (e) {
    console.error(e);
    vite.kill();
    process.exit(1);
  }
})();

process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});
