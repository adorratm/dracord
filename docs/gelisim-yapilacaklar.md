# Dracord — Gelişim yapılacaklar

Ürün / teknik roadmap. Canlıyı bozmadan büyüme.

Yayın: [yayin-ve-buyume-rehberi.md](./yayin-ve-buyume-rehberi.md) · Smoke: [native-parity-checklist.md](./native-parity-checklist.md) · [prod-migration.md](./prod-migration.md) · [platform-api-tasarim.md](./platform-api-tasarim.md) · [prod-guvenli-rollout.md](./prod-guvenli-rollout.md) · [sdk.md](./sdk.md)

---

## Durum özeti

Tüm maddeler **çalışır MVP** olarak tamamlandı. Prod’da agresif özellikler flag arkasında (varsayılan off).

### DoD

- [x] Flag varsayılan off
- [x] `node scripts/smoke-parity.mjs` (+ manuel parity checklist)
- [x] Rollback: flag / önceki image

---

## P0 — Oyun sync

- [x] CAS / stateVersion · game-core merge · bilardo flag · watch heartbeat · Redis health · metrikler

---

## P1 A — Stabilite

- [x] Gateway / voice orphan / reconnect
- [x] Mesaj + **üye listesi** sanallaştırma (`MessageList`, `MemberList` >48 satır)
- [x] `SEARCH_MAX_RESULTS` · smoke script · prod migration doc

---

## P1–P2 B — Platform

- [x] `PLATFORM_API` bot token + `/v1` · uygulamalar · webhook · OAuth2 MVP · [sdk.md](./sdk.md)

---

## P1–P2 C — Ürün

- [x] Tema pack’leri · Keşfet · Nitro billing
- [x] **PayTR:** imza doğrulamalı callback + `POST /billing/nitro/checkout` (get-token)
- [x] **Sticker marketplace:** `GET/POST /stickers/marketplace/*` + Ayarlar → Sticker mağazası
- [x] Spotify + developer bot paneli
- [x] Funnel: `POST /metrics/funnel`, `GET /health/funnel`; invite/discover/template otomatik kayıt

---

## P2+

- [x] Otomod · sunucu şablonları
- [x] **Etkinlik RSVP / stage:** `interestedUserIds`, `isStage`, `POST …/events/:id/rsvp`
- [x] Yatay ölçek: Redis required flag (shard sonraki)
- [x] Yeni aktivite kapısı (P0 sync hazır)

---

## Flag özeti

| Flag | Varsayılan | Açınca |
| --- | --- | --- |
| `PLATFORM_API` | off | Bot /v1 |
| `PLATFORM_OAUTH` | off | OAuth2 |
| `NITRO_PAYMENTS` | off | PayTR checkout + imzalı callback |
| `ACTIVITY_CAS` | off | CAS zorunlu |
| `ACTIVITY_BILLIARDS_AUTHORITY` | off | Bilardo shot |
| `SOCKET_REDIS_REQUIRED` | off | Ready Redis |
| `AUTO_MOD` | on | `false` kapat |
| `SEARCH_MAX_RESULTS` | 50 | Arama cap |
| `PAYTR_*` | — | Merchant id/key/salt + test mode |

Deploy: [prod-guvenli-rollout.md](./prod-guvenli-rollout.md) — önce şema (`stateVersion`, `guild_events` enrich), sonra API.
