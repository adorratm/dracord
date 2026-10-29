# @dracord/sdk

Paylaşımlı TypeScript istemci: REST + Socket.IO.

```ts
import { DracordClient, SocketEvents } from '@dracord/sdk';

const client = new DracordClient('https://api.dracord.com.tr');
client.setToken(accessToken);
client.connectSocket();
```

## Semver

- Paket: `packages/sdk` — monorepo `workspace:*` (henüz npm public değil).
- Breaking change’ler major; additive method’lar minor.

## Platform (flag: `PLATFORM_API=true`)

| Method | Endpoint |
| --- | --- |
| `platformHealth()` | `GET /v1/health` |
| `listPlatformApplications()` | `GET /platform/applications` |
| `createPlatformApplication` | `POST /platform/applications` |
| Bot mesaj | `Authorization: Bot <token>` → `POST /v1/channels/:id/messages` |

## Billing

| Method | Endpoint |
| --- | --- |
| `requestBillingMe()` | `GET /billing/me` |
| `checkoutNitro(plan)` | `POST /billing/nitro/checkout` (PayTR iframe veya demo) |
| `subscribeNitro` / `cancelNitro` | `/billing/nitro/*` |

## Stickers / funnel / events

| Method | Endpoint |
| --- | --- |
| `listStickerMarketplace()` | `GET /stickers/marketplace` |
| `installStickerPack(id)` | `POST /stickers/marketplace/:id/install` |
| `trackFunnel(event, meta?)` | `POST /metrics/funnel` |
| `rsvpGuildEvent(guildId, eventId, interested?)` | `POST /guilds/:id/events/:eventId/rsvp` |
| `createGuildEvent(..., { isStage })` | stage flag destekli |

## Realtime

- `onSocketReconnect(handler)` — VOICE_SYNC yenilemek için
- `patchActivityState(id, state, { expectedVersion })` — CAS
