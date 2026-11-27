/**
 * Windows derlemesinde Intel PresentMon'u (MIT) indirir, SHA-256 ile doğrular.
 * İkili dosya depoya girmez; yalnız derleme makinesinde vendor/presentmon'a iner.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const VERSION = '2.6.0';
const URL = `https://github.com/GameTechDev/PresentMon/releases/download/v${VERSION}/PresentMon-${VERSION}-x64.exe`;
const SHA256 = 'b2a706bc6ad475749e3b7e3409263aa1e6906d45bdcf993f6dbc0f660188f1af';
const LICENSE_URL = `https://raw.githubusercontent.com/GameTechDev/PresentMon/v${VERSION}/LICENSE.txt`;

const dir = path.join(__dirname, '..', 'vendor', 'presentmon');
const exe = path.join(dir, 'PresentMon.exe');

function get(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'user-agent': 'dracord-build' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume();
          return resolve(get(res.headers.location, redirects - 1));
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} ${url}`));
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  if (fs.existsSync(exe) && sha(fs.readFileSync(exe)) === SHA256) {
    console.log(`presentmon: v${VERSION} hazır`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const bin = await get(URL);
  const got = sha(bin);
  if (got !== SHA256) throw new Error(`presentmon: SHA-256 uyuşmuyor (${got})`);
  fs.writeFileSync(exe, bin);
  try {
    fs.writeFileSync(path.join(dir, 'LICENSE.txt'), await get(LICENSE_URL));
  } catch {
    fs.writeFileSync(path.join(dir, 'LICENSE.txt'), 'PresentMon — MIT License — https://github.com/GameTechDev/PresentMon\n');
  }
  console.log(`presentmon: v${VERSION} indirildi ve doğrulandı`);
})().catch((e) => {
  // FPS isteğe bağlı: indirme başarısızsa derleme düşmesin, özellik "bulunamadı" der
  console.warn(String(e && e.message ? e.message : e));
});
