# Dracord — Senin yapman gerekenler

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

- [ ] Actions → **Desktop release** çalıştır veya tag: `desktop-v0.1.0`
- [ ] Artifact / Release asset URL’lerini kopyala (`SHA256SUMS.txt` dahil)
- [ ] Prod env’ye yaz:

```env
NEXT_PUBLIC_DOWNLOAD_WINDOWS=https://.../Dracord-Setup-x.y.z.exe
NEXT_PUBLIC_DOWNLOAD_LINUX=https://.../Dracord-x.y.z-linux.AppImage
```

- [ ] Siteyi yeniden deploy et (landing `#indir` + `/download` URL’leri build-time okur)
- [ ] Windows indirmede popup çıktığını kontrol et (SmartScreen talimatları)

Yerel: `yarn workspace @dracord/desktop build:win` / `build:linux`

### macOS (Apple Developer ile — ekstra para yok)

- [ ] Mac’te Keychain’de **Developer ID Application** sertifikası
- [ ] GitHub Secrets (CI notarize için):

  - `APPLE_ID`
  - `APPLE_APP_SPECIFIC_PASSWORD` (appleid.apple.com → uygulama şifresi)
  - `APPLE_TEAM_ID`
  - İsteğe bağlı: `CSC_LINK` / kimlik (CI Mac runner)

- [ ] `build:mac` veya workflow macOS job → DMG
- [ ] `NEXT_PUBLIC_DOWNLOAD_MACOS=...`

Yerelde Xcode / `electron-builder` notarize: secrets doluysa otomatik.

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

## 7. Deploy: Docker pull Lchown hatası (VPS)

CI log’unda şuna benzer bir satır görürsen:

`failed to extract layer … Lchown … typings.js.map … no such file or directory`

Bu **uygulama bug’ı değil**; Hetzner’de containerd/overlayfs katman çıkarma yarışı veya yarım kalmış snapshot. Disk dolu değilse:

```bash
# SSH → sunucu
cd /opt/dracord
docker image rm -f ghcr.io/adorratm/dracord/api:<sha> || true
docker image prune -f
# Gerekirse (diğer siteleri kısa keser):
sudo systemctl restart containerd docker
```

Sonra GitHub Actions’ta deploy’u **Re-run**. `docker/pull-prebuilt.sh` artık birkaç kez retry eder.

Sürekli tekrarlıyorsa: Docker/containerd sürümünü güncelle veya API imajını küçült (prod `node_modules` sadeleştirme).

---

## 8. Hızlı komutlar

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
