# Platform API tasarımı (spec — henüz kod yok)

Hedef: Discord benzeri **bot / uygulama ekosistemi** ve **Dracord ile giriş**, mevcut kullanıcı JWT + chat gateway’i bozmadan.

**Durum:** tasarım only. Feature flag varsayılan **off**. Uygulama ayrı PR’larda.

---

## İlkeler

1. Kullanıcı oturumu (`Authorization: Bearer` kullanıcı JWT) ile **bot/app token** aynı header’da karışmaz; ayrı auth guard.
2. Public yüzeyler yeni route prefix: `/v1/...` (mevcut `/guilds`, `/messages` dokunulmaz veya ince proxy).
3. Rate limit + scope zorunlu; audit log.
4. Gateway: mevcut Socket.IO chat gateway’e bot bağlanmaz; ayrı **Bot Gateway** (WS veya HTTP webhook).

---

## 1. Uygulama / bot kaydı

| Alan | Not |
| --- | --- |
| `Application` | owner userId, name, icon, redirect URIs |
| `BotUser` | özel user tipi (`isBot`); guild’e davet |
| Token | `Bot <token>` — hash’li saklanır, bir kez gösterilir |
| Scopes | `identify`, `guilds`, `guilds.join`, `bot`, `messages.read`, `messages.write`, `applications.commands` |

Portal: `admin` altında veya ileride `developers.dracord.com.tr` (flag).

Mevcut genişletme noktası: `slash_commands` + `GET /bots/commands` (yalnızca built-in). Public slash → bot applicationId ile kayıt.

---

## 2. Public REST (`/v1`)

Örnek (taslak):

- `GET /v1/users/@me` — bot veya OAuth user token
- `GET /v1/guilds/:id` — scope `guilds`
- `POST /v1/channels/:id/messages` — scope `messages.write`
- `PUT /v1/applications/:id/commands` — slash sync

Rate limit: uygulama + guild başına (Redis). Mevcut `@dracord/sdk` **kullanıcı SDK** kalır; ayrı `@dracord/bot-sdk` veya dokümante HTTP örnekleri.

---

## 3. Bot Gateway / webhook

- **Webhook inbound:** guild/channel event → HTTPS POST (imza HMAC)
- **Opsiyonel WS:** `wss://api…/v1/gateway` — identify + heartbeat; chat gateway’den izole Redis channel

Event örnekleri: `MESSAGE_CREATE`, `GUILD_MEMBER_ADD`, `VOICE_STATE_UPDATE` (privacy’ye dikkat).

---

## 4. Dracord ile giriş (OAuth2)

Kullanıcı Google/Apple login’inden **ayrı**:

1. 3. parti `client_id` + `redirect_uri` (application kaydı)
2. `GET /oauth2/authorize` → kullanıcı onay
3. `POST /oauth2/token` → access + refresh (scope `identify` …)
4. Widget / “Dracord ile devam et” butonu (web SDK snippet)

Token tipi: `User OAuth` ≠ bot token ≠ session JWT (web app).

---

## 5. Aşamalar

| Aşama | İçerik | Flag |
| --- | --- | --- |
| B0 | Bu spec + boş `/v1/health` stub | `PLATFORM_API=false` |
| B1 | Application CRUD (admin) + bot token üret | off |
| B2 | Slash public kayıt + mesaj gönder (write) | off |
| B3 | Webhook outbound | off |
| B4 | OAuth2 authorize/token + Login widget | off |

---

## 6. Güvenlik / canlı

- Prod’da flag off iken `/v1` 404 veya 503.
- Bot mesajları audit + rate limit.
- Mevcut müzik botu / `DRACORD_BOT_USER_ID` migration planı: sistem botu “first-party application” olarak işaretlenir; token rotasyonu ayrı iş.

## Rollback

`PLATFORM_API` kapat → public yüzey iner; kullanıcı sohbeti etkilenmez.
