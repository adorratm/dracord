# Dracord — Senin yapman gerekenler

Ürün / teknik gelişim yapılacaklar (oyun sync, API, bot, tema, Nitro): **[gelisim-yapilacaklar.md](./gelisim-yapilacaklar.md)**  
Prod şema: **[prod-migration.md](./prod-migration.md)** · Platform API spec: **[platform-api-tasarim.md](./platform-api-tasarim.md)**  
Canlıya alma sırası / flag’ler: **[prod-guvenli-rollout.md](./prod-guvenli-rollout.md)**
Kod / SEO / ASO taslakları / indirme popup / hesap silme / desktop CI checksum tarafı repoda hazır.
Bu belge yalnızca **senin** hesap, panel ve yayın adımlarını listeler.

Hesaplar: Google Play ve App Store **var** · Apple Developer **var** → macOS DMG imza + notarize için **ek ücret yok** (yıllık üyelik yeterli). Windows Authenticode (OV/EV) ayrı ve ücretli; şimdilik imzasız + SmartScreen bilgilendirme popup’ı kullanılıyor.

---

## 0. Sıra (önerilen)

1. Windows + Linux Release (imzasız OK) → indirme URL env
2. Android Play listing + EAS build/submit
3. iOS TestFlight → Review
4. macOS notarized DMG (Apple hesabınla)
5. (İsteğe bağlı, bütçe gelince) Windows OV sertifikası

---

## 1. Desktop Release

### Windows / Linux (hemen)

**Önemli:** Actions’ta yalnız *Run workflow* (artifact) = geçici, public değil. Siteye koymak için **GitHub Release** URL’si lazım.

1. Tag ile release üret (asset’ler public indirilebilir olur):

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

2. Release sayfasından asset linklerini kopyala  
   `https://github.com/<owner>/<repo>/releases/latest/download/Dracord-Setup-Windows.exe` (sürümsüz dosya adı; her release’te aynı URL)  
   (Linux AppImage, isteğe MSI/DMG)

3. İndirme URL’leri `apps/web/lib/downloads.ts` + `deploy.yml` içinde **sabit** (public Release linkleri). Sunucu `.env` / Actions Variables tek başına yetmez — web image rebuild şart.
4. **Deploy** workflow’unu çalıştır (veya main’e push).
5. Kontrol: `https://dracord.com.tr/#indir` ve `/download` — Windows’ta SmartScreen popup’ı çıkmalı. iOS App Store id gelince `NEXT_PUBLIC_DOWNLOAD_IOS` / `downloads.ts` güncelle.

Yerel build’i public yapmak: dosyaları aynı Release’e yükle (`gh release upload desktop-v0.1.0 apps/desktop/release/*`) veya tag push ile CI’ya bırak.

Yerel: `yarn workspace @dracord/desktop build:win` / `build:linux`

### macOS (Apple Developer ile — ekstra para yok)

Şu an CI **imzasız** DMG üretir (`apps/desktop` → `build.mac.identity: null`). Gatekeeper uyarısı normal.

İmzalı + notarize için:

- [ ] `package.json` içinden `"identity": null` satırını kaldır
- [ ] GitHub Secrets: `CSC_LINK` (p12/base64), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`
- [ ] Workflow yeniden çalıştır → `NEXT_PUBLIC_DOWNLOAD_MACOS=...`

### Windows imza (sonra, ücretli)

- [ ] OV/EV Authenticode al → `CSC_LINK` + `CSC_KEY_PASSWORD` secrets
- [ ] İmza sonrası popup metnini gevşetmek için agent’a söyle

---

## 2. Mobil ortak

- [ ] `cd apps/mobile` → `npx eas-cli login` → `npx eas init` (`projectId` `app.json`)
- [ ] EAS production profilinde API: `https://api.dracord.com.tr`
- [ ] Google Cloud OAuth: iOS / Android client ID + `dracord://oauth` redirect
- [ ] Ekran görüntüleri + 1024 ikon + Play feature graphic (1024×500) — metin önerisi: `apps/mobile/store/feature-graphic.md`
- [ ] ASO metinlerini Console’a yapıştır: `apps/mobile/store/aso-tr.md`, `aso-en.md`
- [ ] Privacy / Data safety: `apps/mobile/store/privacy-labels.md`
- [ ] Destek e-postası + legal URL’ler (`/legal/privacy` vb.)
- [ ] Reviewer notu: `docs/reviewer-demo.md` (demo hesap bilgilerini sen doldur; public commit etme)

---

## 3. Android (Play — hesabın var)

- [ ] Play Console’da uygulama `com.dracord.mobile` (yoksa oluştur)
- [ ] Data safety + içerik derecelendirme + hedef kitle
- [ ] Build:

```bash
yarn workspace @dracord/mobile exec eas build --platform android --profile production
```

- [ ] `eas submit --platform android` veya AAB yükle
- [ ] Internal → Closed → Production
- [ ] `NEXT_PUBLIC_DOWNLOAD_PLAY=https://play.google.com/store/apps/details?id=com.dracord.mobile`

---

## 4. iOS (App Store — hesabın var)

- [ ] App Store Connect’te uygulama (`com.dracord.mobile`)
- [ ] Banking / vergi / sözleşmeler (eksikse)
- [ ] Privacy Nutrition Labels (`privacy-labels.md`)
- [ ] Age rating
- [ ] **Sign in with Apple**: Apple Developer’da App ID capability + Services ID; API’de `APPLE_CLIENT_ID` (şu an prod Apple login stub — capability açınca kod tamamlat)

```bash
yarn workspace @dracord/mobile exec eas build --platform ios --profile production
yarn workspace @dracord/mobile exec eas submit --platform ios --profile production
```

- [ ] TestFlight → Review
- [ ] `NEXT_PUBLIC_DOWNLOAD_IOS=https://apps.apple.com/app/id…`

Hesap silme (mağaza zorunluluğu) uygulamada hazır: Ayarlar → Hesap Durumu → kalıcı sil.

---

## 5. Web env & büyüme

- [ ] Hosting env: `NEXT_PUBLIC_DOWNLOAD_*` + `NEXT_PUBLIC_SITE_URL=https://dracord.com.tr`
- [ ] Google Search Console / Bing doğrula
- [ ] GA4: `NEXT_PUBLIC_GA_MEASUREMENT_ID` (opsiyonel)
- [ ] Soft launch duyurusu (topluluklar)

İndirme sayfaları: `https://dracord.com.tr/#indir` ve `/download`

---

## 6. Sonra (Nitro / PayTR)

- [ ] PayTR merchant sözleşme + API anahtarları (sunucu `.env`, client’ta değil)
- [ ] Web checkout + entitlement için geliştirme isteği
- [ ] Mobilde dijital abonelik → mümkünse “Web’de yükselt” (IAP dayatmasından kaçın)

---

## 7. Deploy: GHCR `denied` (VPS pull)

CI log’unda:

`Error response from daemon: error from registry: denied`

ve öncesinde `Login Succeeded` görürsen: VPS’te `GITHUB_TOKEN` ile login olabiliyor ama private paket pull reddediliyor.

1. GitHub → Settings → Developer settings → [Personal access tokens](https://github.com/settings/tokens) → classic token: `read:packages` (push için ayrıca `write:packages` gerekmez; sadece pull).
2. Repo → Settings → Secrets → Actions → `GHCR_PULL_TOKEN` = token.
3. Paket erişimi: https://github.com/adorratm/dracord/pkgs/container/dracord%2Fapi → Package settings → Manage Actions access / Ensure repository `adorratm/dracord` linked.
4. Actions → Deploy production → Re-run.

---

## 7b. Deploy: Docker pull Lchown hatası (VPS)

CI log’unda şuna benzer bir satır görürsen:

`failed to extract layer … Lchown … typings.js.map … no such file or directory`

Bu **uygulama bug’ı değil**; Hetzner’de containerd/overlayfs katman çıkarma yarışı. **Docker’ı restart etme** (tüm siteler iner). Önce:

```bash
cd /opt/dracord
docker image rm -f ghcr.io/adorratm/dracord/api:<sha> || true
docker image prune -f
```

Sonra Actions **Re-run**. `docker/pull-prebuilt.sh` retry eder. Restart gerçekten şartsa hemen ardından §8.

---

## 8. Tüm siteler 521 / No vhost (acil recover)

Paylaşılan `ttengamesstudio-nginx` + kardeş stack’ler:

```bash
sudo bash /opt/dracord/docker/recover-all-sites.sh
```

Script: nginx → DB → apps → hydrorage SSL (`/opt/ttengamesstudio/docker/ssl/hydrorage`) → template conf.d → upstream `hydrorage-nginx-1:80` → Dracord sync → smoke.

**Not:** Docker restart sonrası conf.d boşalabilir; templates (`kiliccoffee`, `portfolio-emrekilic` *veya* `portfolio`, `hydrorage`, `dracord`) yeniden kopyalanır. `portfolio.conf` + `portfolio-emrekilic.conf` birlikte kurulmaz (emrekilic.web.tr çakışması → yanlış vhost).

**ttengamesstudio 500:** vhost doğru (`default.conf`); sebep çoğu zaman Nuxt frontend image (`nostics` eksik). Rebuild:

```bash
# Çift vhost temizliği
docker exec ttengamesstudio-nginx rm -f /etc/nginx/conf.d/portfolio.conf /etc/nginx/conf.d/hydrorage.com.tr.conf
docker exec ttengamesstudio-nginx nginx -t && docker exec ttengamesstudio-nginx nginx -s reload

# TTEN frontend (Nuxt) — eksik nostics → yeniden build
cd /opt/ttengamesstudio
docker compose build --no-cache frontend   # veya projedeki compose servis adı
docker compose up -d frontend
docker logs ttengamesstudio-frontend --tail 40
```

---

## 9. Hızlı komutlar

```bash
# Desktop
yarn workspace @dracord/desktop build:win
yarn workspace @dracord/desktop build:linux
yarn workspace @dracord/desktop build:mac

# Mobil
cd apps/mobile
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
npx eas submit --platform android
npx eas submit --platform ios
```

---

## Hazır olanlar (senin işin değil)

| Konu | Yer |
| --- | --- |
| İndirme butonları + Windows SmartScreen popup | `apps/web` `#indir`, `/download` |
| SEO meta, JSON-LD, sitemap `/download` | `layout.tsx`, `sitemap.ts` |
| ASO / privacy / feature graphic taslak | `apps/mobile/store/*` |
| Hesap kalıcı silme | API `DELETE /users/me` + web/mobil/desktop ayarlar |
| Desktop CI + SHA256 + Release attach | `.github/workflows/desktop-release.yml` |
| MSI + NSIS target | `apps/desktop/package.json` |

---

*Mağaza politikaları değişebilir; submit öncesi Apple/Google güncel belgelerine bak.*
