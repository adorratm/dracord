const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'desktop-ui', 'dist');
const dest = path.join(__dirname, '..', 'ui');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

if (!fs.existsSync(src)) {
  console.error('desktop-ui dist yok — önce yarn workspace @dracord/desktop-ui build');
  process.exit(1);
}
fs.rmSync(dest, { recursive: true, force: true });
copyDir(src, dest);
console.log('Copied desktop-ui dist → apps/desktop/ui');
