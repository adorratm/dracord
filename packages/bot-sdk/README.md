# @dracord/bot-sdk

Dracord platform bot istemcisi — HTTP `/v1/*` + Socket.IO `/v1/gateway`.

## Kurulum

```bash
yarn add @dracord/bot-sdk
# veya monorepo: workspace:*
```

```ts
import { DracordBot, guildShardIndex } from '@dracord/bot-sdk';

const bot = await DracordBot.fromDiscovery('http://localhost:4000', process.env.BOT_TOKEN!);
await bot.sendMessage('channelId', 'merhaba');

bot.connectGateway({
  // İsteğe bağlı — Hello’daki dilim de kullanılır
  shard: [0, 1],
  onReady: (d) => console.log('ready', d),
  onDispatch: (t, d) => console.log(t, d),
});

console.log(guildShardIndex('123456789012345678', 2));
```

`PLATFORM_API=true` gerekir. Token, uygulama bot token’ıdır.

## Publish (bakımcı)

Paket `publishConfig.access=public`. Monorepo kökünden:

```bash
yarn workspace @dracord/bot-sdk build
# npm login sonrası:
yarn workspace @dracord/bot-sdk npm publish --access public
```

`prepublishOnly` build çalıştırır. Sürüm: `packages/bot-sdk/package.json` → `version`.

## API özeti

| Metod | Açıklama |
| --- | --- |
| `fromDiscovery(origin, token)` | `/.well-known/dracord` |
| `health` / `me` / `getGuild` | REST |
| `sendMessage` / `syncCommands` | REST |
| `connectGateway` / `disconnectGateway` | Socket.IO |
| `guildShardIndex` | Discord-parity hash |
