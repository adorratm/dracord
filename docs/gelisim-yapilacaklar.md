# Dracord — Gelişim yapılacaklar

Ürün / teknik roadmap. Canlıyı bozmadan büyüme.

Yayın: [yayin-ve-buyume-rehberi.md](./yayin-ve-buyume-rehberi.md) · Smoke: [native-parity-checklist.md](./native-parity-checklist.md) · [prod-migration.md](./prod-migration.md) · [platform-api-tasarim.md](./platform-api-tasarim.md) · [prod-guvenli-rollout.md](./prod-guvenli-rollout.md) · [sdk.md](./sdk.md)

---

## Durum özeti

P0–P2 **çalışır MVP** tamam. P3: platform olgunlaştırma + ölçek (shard). Prod’da agresif özellikler flag arkasında.

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

## P3 — Sonraki (opsiyonel)

- [ ] Socket.IO / API **shard**
- [ ] Platform: OAuth refresh, Redis rate limit, Bot WS, `@dracord/bot-sdk`
- [ ] TypeORM migration runner (sync-once yerine)
- [ ] Funnel metrikleri kalıcı store

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
| `APPLE_CLIENT_ID` | — | Apple Sign In gerçek verify |
| `PAYTR_*` | — | Merchant |

Deploy: [prod-guvenli-rollout.md](./prod-guvenli-rollout.md) · Yayın ops: [yayin-ve-buyume-rehberi.md](./yayin-ve-buyume-rehberi.md)
