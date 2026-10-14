# @dracord/desktop

Dracord **tam native** Electron istemcisi (WebView / uzak site yok). Paketlenmiş [`apps/desktop-ui`](../desktop-ui): AppShell, zengin sohbet, Friends/DM, LiveKit ses+ekran, oyunlar, arama, bildirimler, sunucu yönetimi, ayarlar. Ortak mantık `@dracord/sdk` + `@dracord/game-core`.

Parity: [`docs/native-parity-checklist.md`](../../docs/native-parity-checklist.md).

## Çalıştırma

```bash
# Paketli UI ile (Vite gerekmez) — önerilen
yarn desktop

# Hot-reload: Vite + Electron birlikte
yarn desktop:dev
```

Pencere / taskbar / tray ikonu: `build/icon.png` + `build/icon.ico` (Draco maskotu). Yenilemek için:

```bash
yarn workspace @dracord/desktop icons
```

İsteğe bağlı API: `yarn api`.

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `DRACORD_APP_URL` | UI URL override (varsayılan: dev → `http://localhost:5173`) |
| `DRACORD_ELECTRON_DEV` | `1` → production NODE_ENV’de bile Vite URL |
| `DRACORD_FRAMELESS` | `true` → çerçevesiz pencere |
| `VITE_API_URL` | desktop-ui API (varsayılan prod `https://api.dracord.com.tr`) |

## Paketleme

```bash
yarn workspace @dracord/desktop build:win   # veya build:mac / build:linux
```

`prebuild`: `desktop-ui` derlenir → `apps/desktop/ui/` kopyalanır → `electron-builder` paketler. Prod’da `loadFile(ui/index.html)` (HashRouter).

Çıktılar: `apps/desktop/release/`.

## Kod imzalama

`electron-builder` ortam değişkenlerini okur.

### Windows (Authenticode)

| Değişken | Açıklama |
| --- | --- |
| `CSC_LINK` | `.pfx` yolu veya base64 |
| `CSC_KEY_PASSWORD` | PFX şifresi |

### macOS (Developer ID + Notarize)

| Değişken | Açıklama |
| --- | --- |
| `CSC_LINK` / Keychain identity | Developer ID Application |
| `APPLE_ID` | Apple ID e-posta |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Team ID |

### Linux

AppImage için imza zorunlu değil.

## OAuth (`dracord://`)

Protokol kaydı + deep link → HashRouter `/auth/callback?electron=1&payload=…`. Tray: kapatınca gizle (tercih `system-prefs` IPC).

## Parity (masaüstü)

| Özellik | Durum |
| --- | --- |
| Login / session | Evet |
| Guilds + text | Evet |
| DMs | Evet |
| Voice + ekran paylaşımı* | Ses Evet; ekran paylaşımı LiveKit ile genişletilebilir |
| Oyunlar (game-core + Three) | Evet |
| Watch party | Activity paneli üzerinden |
| Keşfet / ayarlar | Evet |

\* Tam ekran paylaşımı web LiveKit ile aynı Chromium yığını üzerindedir.
