# Dracord Developer Docs

Fluxer / Discord tarzı geliştirici dokümantasyonu iskeleti.

## Keşif

```http
GET /.well-known/dracord
GET /openapi.json
```

Örnek yanıt alanları: `endpoints.api_public`, `endpoints.gateway`, `endpoints.bot_gateway`, `endpoints.openapi`, `endpoints.cdn`, `endpoints.docs`.

Botlar ve üçüncü parti istemciler base URL’i origin’den uydurmasın; discovery nesnesini kullansın.

## Bölümler

| Bölüm | Dosya / not |
| --- | --- |
| HTTP API | [http-api.md](./http-api.md) |
| OpenAPI | [openapi.json](./openapi.json) · canlı `GET /openapi.json` |
| Ölçek | [scaling.md](./scaling.md) — Redis adapter + instance stub |
| Gateway | Socket.IO chat — [`../sdk.md`](../sdk.md) |
| Bot Gateway | [bot-gateway.md](./bot-gateway.md) |
| Voice | LiveKit grant + presence |
| Auth | Bearer kullanıcı JWT · `Authorization: Bot <token>` |
| OAuth2 | refresh_token + scope consent (`PLATFORM_OAUTH`) |
| Admin API | `/platform-admin/*` (platform admin ACL) |
| Rate limits | MVP in-memory; Redis rate limit planlı |
| Errors | NestJS JSON exception filter |

## Bot hızlı başlangıç

1. Admin → Geliştiriciler veya Ayarlar → uygulama oluştur  
2. Bot token al  
3. `PUT /v1/applications/:id/commands` ile slash sync  
4. `POST /v1/channels/:id/messages` ile `Authorization: Bot …`  
5. Webhook: `PUT /platform/applications/:id/webhook`  
6. İsteğe bağlı: Socket.IO ` /v1/gateway` — [bot-gateway.md](./bot-gateway.md)

Ayrıntılar: [`../platform-api-tasarim.md`](../platform-api-tasarim.md) · SDK: [`../sdk.md`](../sdk.md)

## Dokümanlar

- [HTTP API özet](./http-api.md)
- [OpenAPI JSON](./openapi.json)
- [Bot Gateway](./bot-gateway.md)
- [SDK](../sdk.md)
- [Platform tasarım](../platform-api-tasarim.md)

## Kalan parity (Fluxer)

- [x] Bot Gateway Socket.IO `/v1/gateway` (live)
- [x] GIF arama — Klipy (`/media/tenor/*`)
- [x] Kullanıcı `POST /reports` → T&S kuyruğu
- [x] OAuth refresh + scope consent UI
- [x] OpenAPI JSON (`/openapi.json`) — Mintlify/Nextra site sonraki
- [x] Gifts / premium hediye API + ayarlar yüzeyi
- [x] Yerel içerik hash DB (PhotoDNA stub altyapısı)
- [x] `@dracord/bot-sdk` paketi (`packages/bot-sdk`)
- [x] Redis rate limit (bellek fallback) + `platform_audit_logs`
- [x] Docs sitesi iskeleti (`apps/docs`, port 3002)
- [x] Global slash sync (`guildId: global`)
- [x] First-party müzik bot → Platform Application bootstrap
- [x] Overlay ayarları (web Ayarlar → Oyun Overlay)
- [x] Slash option schema (Discord-parity tipler + `{opt.name}` şablon)
- [x] Funnel metrik kalıcılığı (`funnel_events`)
- [x] TypeORM migration runner (`yarn db:migrate`)
- [x] Hash DB toplu import (yerel; PhotoDNA ortaklığı değil)
- [x] NSFW eşikleri guild safety floor’a bağlandı (nsfwjs)
- [x] Instance shard stub (`INSTANCE_SHARD_*` + discovery)
- [x] Gateway shard MVP (guild hash + identify `shard` + dispatch filtre)
- [ ] PhotoDNA / NCMEC hash **yasal ortaklığı** (import altyapısı hazır)
- [x] Mintlify config + CI (`docs/docs.json`, `docs-mintlify.yml`) — hosted bağlama manuel
- [x] `@dracord/bot-sdk` publish workflow — npm’e basmak için `NPM_TOKEN` + dry_run=false

## Bilinçli dışı (yapılmayacak)

| Madde | Neden |
| --- | --- |
| YouTube mid-roll strip / iframe DOM | ToS ihlali; desktop’ta yalnızca reklam **host** filtresi |
| Exclusive-fullscreen DLL inject | AV / mağaza / stabilite riski |
| Harici CSAM ML / PhotoDNA SDK | Yasal lisans + NCMEC şart; hash import stub yeterli |

## Trust & Safety (platform)

- TrustedGuild: seçili sunucularda NSFW/telif/kumar floor muaf  
- Diğer sunucularda floor kapatılamaz; yalnızca eşik soften  
- Admin: `/trust-safety` paneli + `/platform-admin/trust-safety/*` (+ hashes)
- İstemci: `GET /guilds/:id/safety-policy` · ekran sinyali `POST …/safety/screen-signal`
- BullMQ `media.scan` + hash DB eşlemesi; link preview async `link.preview`

## Discovery

```http
GET /.well-known/dracord
```
