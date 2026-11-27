/**
 * Paketlenen dosya listesi (package.json build.files) main sürecin require ettiği
 * her yerel dosyayı içeriyor mu? Eksikse derleme burada düşer — kullanıcıda
 * "Cannot find module" ile açılmayan uygulama yerine.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const files = new Set((pkg.build && pkg.build.files) || []);
const entry = pkg.main || 'main.js';

const seen = new Set();
const missing = [];
function walk(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  if (!files.has(rel)) missing.push(rel);
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const m of src.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
    let dep = path.normalize(path.join(path.dirname(rel), m[1])).replace(/\\/g, '/');
    if (!dep.endsWith('.js') && fs.existsSync(path.join(root, dep + '.js'))) dep += '.js';
    if (dep.startsWith('ui/') || dep.startsWith('build/')) continue;
    if (fs.existsSync(path.join(root, dep))) walk(dep);
  }
}
for (const f of [entry, 'preload.js', 'overlay-preload.js']) if (fs.existsSync(path.join(root, f))) walk(f);

if (missing.length) {
  console.error(`check-packaged-files: build.files listesinde eksik: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`check-packaged-files: ${seen.size} dosya, eksik yok`);
