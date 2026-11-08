# Dracord — Gelişim yapılacaklar

Ürün / teknik roadmap. Canlıyı bozmadan büyüme.

> **Yeni dönem:** [yol-haritasi.md](./yol-haritasi.md) (2026 Q4 → hatalar, optimizasyon, oyun platformu, özellik menüsü)

Yayın: [yayin-ve-buyume-rehberi.md](./yayin-ve-buyume-rehberi.md) · Smoke: [native-parity-checklist.md](./native-parity-checklist.md) · [prod-migration.md](./prod-migration.md) · [platform-api-tasarim.md](./platform-api-tasarim.md) · [prod-guvenli-rollout.md](./prod-guvenli-rollout.md) · [sdk.md](./sdk.md) · [developer/README.md](./developer/README.md)

---

## Durum özeti

P0–P3 platform olgunlaştırma **MVP tamam**. Ölçek: Redis adapter + sticky LB + gateway shard MVP (guild hash / identify). Prod’da agresif özellikler flag arkasında.

### DoD

- [x] Flag varsayılan off
- [x] `node scripts/smoke-parity.mjs` (+ manuel parity checklist)
- [x] Rollback: flag / önceki image

---

## P0 — P2

- [x] Oyun sync (CAS, game-core, bilardo flag, watch, Redis, metrik)
- [x] Stabilite (gateway, mesaj/üye virt, search cap)
- [x] Platform B0–B4 MVP (bot, slash sync, webhook, OAuth widget)
- [x] Tema · Keşfet · Nitro/PayTR · sticker · Spotify · funnel · otomöd · şablon · etkinlik RSVP/stage
- [x] Apple Sign In (JWKS verify + web/mobile UI; `APPLE_CLIENT_ID` gerekir)
- [x] macOS notarize hook (`afterSign`; secrets yoksa no-op) — **Windows OV ücretli hariç**

---

## P3 — Platform olgunlaştırma

- [x] OAuth refresh + scope consent UI
- [x] Redis rate limit (bellek fallback)
- [x] Bot WS gateway `/v1/gateway`
- [x] `@dracord/bot-sdk` paketi (npm publish opsiyonel)
- [x] TypeORM migration runner (`yarn db:migrate`)
- [x] Funnel metrikleri kalıcı store
- [x] Global slash + Discord-parity options
- [x] Gifts API · overlay ayarları · T&S hash import
- [x] Docs sitesi (`apps/docs`) + OpenAPI JSON
- [x] BullMQ: reminder / push / webhook / spotify poll
- [x] Bilardo mid-shot + TrustedGuild T&S
- [x] Desktop overlay + Watch Party adblock (webRequest)
- [x] `GET /.well-known/dracord` (+ `instance.shard_*` + algorithm)
- [x] Guild-hash gateway **shard** MVP (identify `shard`, dispatch filtre, voice WRONG_SHARD)
- [x] Mintlify **public** site (`docs/mintlify` MDX + redirects) — dashboard path=`docs/mintlify`
- [ ] PhotoDNA / NCMEC **yasal** ortaklık
- [x] `@dracord/bot-sdk` publish pipeline (`publish-bot-sdk.yml` + pack) — **NPM_TOKEN ile gerçek publish manuel**
- [x] Shard / staging smoke scriptleri (`yarn smoke:shard`, `yarn smoke:staging`)

---

## Bilinçli dışı

- YouTube mid-roll strip / iframe DOM enjeksiyonu (ToS)
- Exclusive-fullscreen DLL inject
- Harici CSAM ML SaaS (lisanssız)

---

## Flag özeti

| Flag | Varsayılan | Açınca |
| --- | --- | --- |
| `PLATFORM_API` | off | Bot /v1 |
| `PLATFORM_OAUTH` | off | OAuth2 + widget |
| `NITRO_PAYMENTS` | off | PayTR checkout + imzalı callback |
| `ACTIVITY_CAS` | off | CAS zorunlu |
| `ACTIVITY_BILLIARDS_AUTHORITY` | off | Bilardo shot |
| `SOCKET_REDIS_REQUIRED` | off | Ready Redis |
| `AUTO_MOD` | on | `false` kapat |
| `INSTANCE_SHARD_ID` / `COUNT` | 0 / 1 | Discovery instance stub |
| `APPLE_CLIENT_ID` | — | Apple Sign In gerçek verify |
| `PAYTR_*` | — | Merchant |

Deploy: [prod-guvenli-rollout.md](./prod-guvenli-rollout.md) · Ölçek: [developer/scaling.md](./developer/scaling.md) · Yayın ops: [yayin-ve-buyume-rehberi.md](./yayin-ve-buyume-rehberi.md)
