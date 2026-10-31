# Platform API tasarımı

Hedef: Discord benzeri **bot / uygulama ekosistemi** ve **Dracord ile giriş**, mevcut kullanıcı JWT + chat gateway’i bozmadan.

**Durum (2026-10):** B0–B4 **MVP kodda** (`PLATFORM_API` / `PLATFORM_OAUTH`, varsayılan off). Bu belge hedef mimari + kalan olgunlaştırma.

---

## İlkeler

1. Kullanıcı oturumu (`Authorization: Bearer` kullanıcı JWT) ile **bot/app token** aynı header’da karışmaz; ayrı auth guard.
2. Public yüzeyler: `/v1/...` (mevcut `/guilds`, `/messages` dokunulmaz).
3. Rate limit + scope; audit log (MVP: in-memory rate limit).
4. Gateway: mevcut Socket.IO chat’e bot bağlanmaz; outbound **HTTPS webhook** (MVP). Ayrı Bot WS sonraki.

---

## Uygulandı (MVP)

| Parça | Flag / path |
| --- | --- |
| `GET /v1/health` | her zaman |
| Application CRUD + bot token | `PLATFORM_API` · `/platform/applications*` |
| `POST /v1/channels/:id/messages` | `Authorization: Bot …` |
| `GET /v1/users/@me` (bot) | Bot guard |
| `GET /v1/guilds/:id` | Bot + üyelik |
| `PUT /v1/applications/:id/commands` | guild slash sync |
| Webhook outbound | `PUT …/webhook` + `dispatchWebhook` |
| OAuth2 code + JWT access | `PLATFORM_OAUTH` · `POST/GET /oauth2/authorize`, `POST /oauth2/token` |
| Consent UI + widget | `/oauth/authorize`, `/sdk/login-with-dracord.js` |
| Portal | Ayarlar → Gelişmiş; admin developers |

SDK: `@dracord/sdk` — `platformHealth`, uygulamalar, `setPlatformWebhook`, `oauthAuthorize`, `syncPlatformCommands`.

---

## Kalan (olgunlaştırma)

- [x] OAuth refresh token + scope seçimi consent UI
- [x] Bot WS gateway (`/v1/gateway` Socket.IO)
- [x] OpenAPI JSON (`/openapi.json`)
- [x] Redis rate limit + platform audit log kalıcılığı
- [x] `@dracord/bot-sdk` paketi (`packages/bot-sdk`; npm publish opsiyonel)
- [x] Docs sitesi iskeleti (`apps/docs`)
- [x] Müzik botu first-party application bootstrap (`Dracord Music`)
- [x] Global (guild’siz) slash sync (`guildId: global`)
- [x] Discord-parity command option schema (tipli argümanlar)
- [x] Funnel persist + `yarn db:migrate`
- [ ] Mintlify hosted publish (yerel docs sitesi mevcut)

---

## Aşamalar (tarihçe)

| Aşama | İçerik | Durum |
| --- | --- | --- |
| B0 | `/v1/health` | ✅ |
| B1 | Application + bot token | ✅ |
| B2 | Slash sync + mesaj write | ✅ MVP |
| B3 | Webhook outbound | ✅ MVP |
| B4 | OAuth2 + Login widget | ✅ MVP |

## Rollback

`PLATFORM_API` / `PLATFORM_OAUTH` kapat → public yüzey iner; kullanıcı sohbeti etkilenmez.
