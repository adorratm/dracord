# @dracord/desktop

Dracord için Electron masaüstü kabuğu. Geliştirmede yerel web uygulamasını (`http://localhost:3000`), üretimde `https://dracord.com.tr` adresini yükler.

## Çalıştırma

Önce web istemcisini başlatın:

```bash
yarn web
```

Ardından masaüstü uygulamasını:

```bash
yarn desktop
```

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `DRACORD_APP_URL` | Yüklenecek URL (varsayılan: dev → `http://localhost:3000`, prod → `https://dracord.com.tr`) |
| `DRACORD_ELECTRON_DEV` | `1` ise `NODE_ENV=production` olsa bile dev URL kullanılır |
| `DRACORD_FRAMELESS` | `true` ise çerçevesiz pencere (`titleBarStyle: hidden`) |

## OAuth (`dracord://`)

Uygulama `dracord://` özel protokolünü kaydeder. OAuth geri dönüşleri şimdilik web `/auth/callback` yoluna yönlendirilir (stub). Windows’ta ikinci örnek (`second-instance`), macOS’ta `open-url` olayları dinlenir.

## Pencere kontrolleri

`preload.js`, sayfaya `window.windowControls` API’sini açar (`minimize`, `maximize`, `close`). Özel başlık çubuğu kullanmak için `DRACORD_FRAMELESS=true` ile birlikte bu API’yi çağırın.

## Paketleme

```bash
yarn workspace @dracord/desktop build
```

Çıktılar `apps/desktop/release` altında oluşur.
