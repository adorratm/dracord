# Dracord HTTP API — özet

Discovery: `GET /.well-known/dracord`

## Auth

| Method | Path | Not |
| --- | --- | --- |
| Bearer | `Authorization: Bearer <jwt>` | Kullanıcı |
| Bot | `Authorization: Bot <token>` | Platform bot (`PLATFORM_API`) |

## OAuth2 (`PLATFORM_OAUTH`)

| Method | Path | Not |
| --- | --- | --- |
| GET | `/oauth2/application/:clientId` | Consent: name + scopes |
| POST/GET | `/oauth2/authorize` | `scope` (boşluklu); Bearer kullanıcı |
| POST | `/oauth2/token` | `authorization_code` **veya** `refresh_token` → `access_token` + `refresh_token` + `scope` |

## Billing / hediyeler

| Method | Path |
| --- | --- |
| GET | `/billing/gifts` |
| POST | `/billing/gifts` `{ kind: nitro\|boost }` |
| POST | `/billing/gifts/redeem` `{ code }` |

## OpenAPI

`GET /openapi.json` · kaynak: `docs/developer/openapi.json` · site: `yarn docs` → `:3002`

## Rate limit / audit

| Env | Varsayılan | Not |
| --- | --- | --- |
| `REDIS_URL` | — | Varsa bot RL paylaşılır |
| `PLATFORM_RATE_LIMIT` | `60` | pencere başına istek |
| `PLATFORM_RATE_WINDOW_MS` | `60000` | |

Bot mesaj / slash sync → `platform_audit_logs`. Admin: `GET /platform-admin/platform-audit`

## Kullanıcı / sunucu (örnek)

| Method | Path |
| --- | --- |
| GET | `/guilds` |
| GET | `/guilds/:id` |
| GET | `/guilds/:id/safety-policy` |
| POST | `/guilds/:id/safety/screen-signal` |
| GET | `/guilds/:id/channels` |
| POST | `/channels/:id/messages` |
| POST | `/reports` |

## Media / GIF (Klipy; `/media/tenor/*` alias)

| Method | Path |
| --- | --- |
| GET | `/media/tenor/status` |
| GET | `/media/tenor/search?q=` |
| GET | `/media/tenor/featured` |

## Platform bot (`PLATFORM_API=true`)

| Method | Path |
| --- | --- |
| GET | `/v1/health` |
| GET | `/v1/users/@me` |
| GET | `/v1/guilds/:id` |
| POST | `/v1/channels/:id/messages` |
| PUT | `/v1/applications/:id/commands` | `guildId: "global"`; `options[]` type 3–11 |

## Bot Gateway (Socket.IO)

- Namespace: `/v1/gateway`
- Event: `packet`
- Hello `op:10` → Identify `op:2` `{ token }` → READY `op:0` `t:READY`
- Heartbeat `op:1` → ACK `op:11`
- Dispatch: webhook ile aynı event adları (`MESSAGE_CREATE`, …)

## Admin

`/platform-admin/*` + `/platform-admin/trust-safety/*`

## Hatalar

NestJS JSON: `{ statusCode, message, error? }` · 429 rate limit bot guard.
