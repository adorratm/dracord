/**
 * ui/ yoksa veya desktop-ui kaynağından eskiyse yeniden build + kopyala.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const desktopRoot = path.join(__dirname, '..');
const repoRoot = path.join(desktopRoot, '..', '..');
const uiIndex = path.join(desktopRoot, 'ui', 'index.html');
const srcRoot = path.join(repoRoot, 'apps', 'desktop-ui', 'src');

function newestMtime(dir) {
  let newest = 0;
  if (!fs.existsSync(dir)) return 0;
  const walk = (d) => {
    for (const name of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, name.name);
      if (name.isDirectory()) walk(p);
      else {
        const t = fs.statSync(p).mtimeMs;
        if (t > newest) newest = t;
      }
    }
  };
  walk(dir);
  return newest;
}

const uiTime = fs.existsSync(uiIndex) ? fs.statSync(uiIndex).mtimeMs : 0;
const srcTime = newestMtime(srcRoot);
const stale = !uiTime || srcTime > uiTime;

if (!stale) {
  console.log('desktop ui güncel:', uiIndex);
  process.exit(0);
}

console.log(uiTime ? 'desktop ui eski — yeniden build…' : 'desktop ui yok — build…');
execSync('yarn workspace @dracord/desktop-ui build', {
  stdio: 'inherit',
  cwd: repoRoot,
});
execSync('node ./scripts/copy-ui.js', {
  stdio: 'inherit',
  cwd: desktopRoot,
});
