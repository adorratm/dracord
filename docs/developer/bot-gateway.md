# Bot Gateway

Socket.IO namespace **`/v1/gateway`** (ana chat gateway’den ayrı).

## Bağlan

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000/v1/gateway', {
  transports: ['websocket'],
  path: '/socket.io',
});

socket.on('packet', (p) => {
  if (p.op === 10) {
    // Hello — p.d.shard_id / shard_count
    socket.emit('packet', {
      op: 2,
      d: {
        token: process.env.BOT_TOKEN,
        shard: [p.d.shard_id ?? 0, p.d.shard_count ?? 1],
      },
    });
    setInterval(() => socket.emit('packet', { op: 1, d: null }), p.d.heartbeat_interval);
  }
  if (p.op === 0 && p.t === 'READY') {
    console.log('ready', p.d); // d.shard: [id, count]
  }
  if (p.op === 0) {
    console.log('dispatch', p.t, p.d);
  }
});
```

`PLATFORM_API=true` gerekir. Token, uygulama bot token’ıdır (`Authorization: Bot …` ile aynı).

### Shard MVP

Guild hash: `(BigInt(guildId) >> 22n) % shardCount` — ayrıntı: [scaling.md](./scaling.md).

HTTPS webhook hâlâ `dispatchWebhook` ile gider; gateway bağlı botlara aynı anda `packet` dispatch eder (`guildId` varsa shard filtresi).
