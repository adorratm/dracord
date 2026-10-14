# @dracord/mobile

Tam **native** Expo istemci (**WebView yok**). Expo Router + SecureStore + `@dracord/sdk` + LiveKit React Native + `expo-gl` oyun hostu. Kurallar ve durum `@dracord/game-core` ile web/masaüstü ile paylaşılır.

## Çalıştırma

```bash
yarn   # kök monorepo
yarn workspace @dracord/mobile dev
```

Bu proje **Expo Go değil** — `expo-dev-client` + LiveKit/native modüller. Emülatöre ilk kez (veya native dep değişince):

```powershell
# Emülatör açıkken — Windows’ta kısa Gradle yolu (MAX_PATH / 260 char)
$env:GRADLE_USER_HOME = 'C:\g'
yarn workspace @dracord/mobile android:run
```

APK kurulduktan sonra `yarn workspace @dracord/mobile dev` → `a` ile açılır.  
Expo Go (`s`) LiveKit / native ses-oyun için uygun değil.

Varsayılan API: `https://api.dracord.com.tr`. Lokal: `EXPO_PUBLIC_API_URL=http://localhost:4000` veya `app.json` → `extra.apiUrl`.

### Bağımlılık / Expo check

SDK uyumu: `yarn workspace @dracord/mobile exec npx expo install --check`

Yarn 4 yeni npm yayınlarını kısa süre karantinaya alabilir (`YN0016 … quarantined`). Repoda `npmMinimalAgeGate: 0` (`.yarnrc.yml`). Hâlâ takılırsa:

```bash
yarn config set npmMinimalAgeGate 0
yarn install
```

Not: mobil `react@19.2.3` (Expo SDK 57); masaüstü UI `react@19.3.0` — workspace’lerde ayrı tutulur.

## Ekranlar

| Rota | Açıklama |
| --- | --- |
| `(auth)/login` | Google OAuth + SecureStore |
| `(app)/guilds` | Sunucu rail, kategori ağacı, okunmamış rozetleri, üye sheet, oluştur/katıl/ayrıl |
| `(app)/friends` | Arkadaş hub (istekler, engel, arama, DM aç) |
| `(app)/notifications` | Bildirim merkezi |
| `(app)/search` | Global arama (sunucu/kanal/kullanıcı/mesaj) |
| `(app)/dms` | DM sohbet + LiveKit sesli/görüntülü arama |
| `(app)/guild-settings/[guildId]` | Sunucu adı, kanal CRUD, roller, davet, kick/ban |
| `(app)/onboarding/username` | `usernameConfirmed === false` kapısı |
| `channels/…`, `voice/…`, `activity/…` | Metin, ses (mic/deafen/kamera/sohbet), oyunlar |
| `discover`, `settings` | Keşfet + hesap/profil/gizlilik/ses/görünüm/dil |

## Parity özeti

- Sohbet: düzenle/sil/yanıt/pin/reaksiyon/thread/anket/yazıyor/tarih ayırıcı/görsel yükleme
- Ses: LiveKit RN; ekran paylaşımı **N/A** (OS)
- Oyunlar: blackjack, bilardo, okey, bowling, tavla, watch party — expo-gl + HUD
- Son kanal: `@react-native-async-storage/async-storage`

## EAS / mağaza

- [`eas.json`](eas.json)
- ASO: [`store/aso-tr.md`](store/aso-tr.md), [`store/aso-en.md`](store/aso-en.md)
