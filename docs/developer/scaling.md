# Ölçekleme — Redis adapter + gateway shard MVP

## Çoklu API örneği

1. **Redis Socket.IO adapter** — `REDIS_URL` (+ isteğe `SOCKET_REDIS_REQUIRED=true`)
2. **LB sticky session** — aynı istemci aynı pod’a (websocket upgrade)
3. **Instance kimliği + shard dilimi** — discovery’de yayınlanır

## Env

| Değişken | Anlam |
| --- | --- |
| `INSTANCE_ID` | Örn. `api-a` |
| `INSTANCE_SHARD_ID` | 0-based dilim (bu süreç) |
| `INSTANCE_SHARD_COUNT` | Toplam dilim sayısı (`1` = shard kapalı) |
| `REDIS_URL` | Adapter + rate limit + BullMQ |
| `SOCKET_REDIS_REQUIRED` | `true` → Redis yoksa health fail |

## Guild → shard (Discord-parity)

```ts
Number((BigInt(guildId) >> 22n) % BigInt(shardCount))
```

Non-numeric id’lerde FNV-1a fallback kullanılır.

## Bot identify

Hello (`op:10`) `shard_id` / `shard_count` taşır.

```js
socket.emit('packet', {
  op: 2,
  d: { token: process.env.BOT_TOKEN, shard: [0, 2] },
});
```

- `shard` verilmezse ve `INSTANCE_SHARD_COUNT > 1` ise süreç kendi dilimini kullanır.
- Yanlış dilim → `op:9` `{ error: 'wrong_shard', ... }` + disconnect.
- Dispatch’te `guildId` varsa yalnızca ilgili shard oturumuna gider.
- Chat `voice:sync` yanlış dilimde `WRONG_SHARD` döner.

## Discovery

```http
GET /.well-known/dracord
```

`instance.shard_id` / `shard_count` / `shard_algorithm` / `features.gateway_shard`

## SDK

```ts
bot.connectGateway({ shard: [0, 2], onReady: console.log });
// veya Hello’daki dilimi otomatik kullan
```

`guildShardIndex(guildId, count)` `@dracord/bot-sdk` içinde export.
