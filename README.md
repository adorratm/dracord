# Dracord

Dracula temalı topluluk sohbeti monoreposu: NestJS API, Next.js web ve admin, Electron masaüstü, paylaşımlı `@dracord/*` paketleri.

## Gereksinimler

- [Volta](https://volta.sh) — Node ve Yarn sürümleri repoda sabitlenir
- Docker Desktop (veya Docker Engine + Compose) — Postgres, Redis, LiveKit
- Yarn 4 (Berry), Corepack ile

### Volta pinleri

Kök `package.json`:

- **Node** `26.10.0`
- **Yarn** `4.18.1`

Volta kuruluysa bu dizinde otomatik kullanılır.

## Kurulum

```bash
cp .env.example .env
# apps/api/.env ve apps/web/.env ihtiyaca göre kopyalayın veya kök .env'yi paylaşın

yarn install
```

## Altyapı (Docker)

Postgres, PgBouncer, Redis, LiveKit ve isteğe bağlı API/web/admin imajları:

```bash
yarn docker:up
```

Yalnızca veri katmanı + LiveKit (postgres / pgbouncer / redis / livekit). Tüm stack imajlarıyla (api/web/admin build):

```bash
yarn docker:up:all
```

**Not:** Yerelde Postgres host portu **5434** (`5434:5432`) — Windows’ta sık görülen 5432 çakışmasını önlemek için. `DATABASE_URL` örneği: `postgresql://dracord:dracord@localhost:5434/dracord`. PgBouncer host’ta **6432**.

Durdurmak:

```bash
yarn docker:down
```

### Veritabanı

Geliştirmede şema **TypeORM `synchronize`** ile API açılışında güncellenir (`NODE_ENV !== production`).

```bash
yarn db:seed
```

## Geliştirme komutları

| Komut | Açıklama |
| --- | --- |
| `yarn api` | API — varsayılan `http://localhost:4000` |
| `yarn web` | Web istemcisi — `http://localhost:3000` |
| `yarn admin` | Admin paneli — `http://localhost:3001` |
| `yarn desktop` | Electron (önce `yarn web`) |
| `yarn dev` | Turbo ile tüm `dev` görevleri paralel |

## Alan adları (üretim)

Caddy yapılandırması (`docker/Caddyfile`):

| Alan | Hizmet |
| --- | --- |
| [dracord.com.tr](https://dracord.com.tr) | Web |
| [www.dracord.com.tr](https://www.dracord.com.tr) | → ana domain yönlendirme |
| [api.dracord.com.tr](https://api.dracord.com.tr) | API |
| [admin.dracord.com.tr](https://admin.dracord.com.tr) | Admin |
| [rtc.dracord.com.tr](https://rtc.dracord.com.tr) | LiveKit (WebRTC) |

Yerelde: web `3000`, admin `3001`, API `4000`, LiveKit `7880` (ws).

## Ses: DeepFilterNet ve Krisp

Web ses kanallarında gürültü azaltma için **DeepFilterNet 3** (`denoise-voice-clarity` / `VoiceClarityProcessor`) kullanılır. Tarayıcı desteklemiyorsa veya yükleme başarısız olursa yerleşik **`noiseSuppression`**’a düşülür. **Krisp** entegre değildir.

Ayrıntılar: `apps/web/hooks/useVoiceRoom.ts`, ayarlar → Ses (`apps/web/app/settings/voice`).

## LiveKit

Sesli/görüntülü odalar [LiveKit](https://livekit.io) üzerinden çalışır. Yerel geliştirmede `docker/livekit.yaml` ve `LIVEKIT_*` ortam değişkenleri API ile hizalanmalıdır. İstemciler `NEXT_PUBLIC_LIVEKIT_URL` (yerelde `ws://localhost:7880`, üretimde `wss://rtc.dracord.com.tr`) kullanır.

## Workspace yapısı

```
apps/
  api/       @dracord/api
  web/       @dracord/web
  admin/     @dracord/admin
  desktop/   @dracord/desktop
  mobile/    @dracord/mobile (stub)
packages/
  config/    Tailwind + TSConfig
  types/     Paylaşımlı tipler
  sdk/       HTTP + Socket istemcisi
  ui/        React bileşenleri
```

## Mobil

`apps/mobile` bilinçli olarak minimal tutulmuştur; Google / Apple oturum açma ileride eklenecek. Bkz. `apps/mobile/README.md`.

## Lisans

Proje sahibinin belirlediği lisans geçerlidir (kökte LICENSE varsa ona bakın).
