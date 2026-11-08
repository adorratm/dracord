# @dracord/embedded-sdk

Dracord ses kanallarında arkadaşlarla oynanan oyunlar için SDK. Web, desktop (iframe) ve mobil
(WebView) aynı API.

```bash
npm i @dracord/embedded-sdk
```

```ts
import { DracordEmbed } from '@dracord/embedded-sdk';

const dracord = new DracordEmbed();
const ctx = await dracord.ready();      // { user, session, participants, token, platform, ... }
await fetch('/api/join', { method: 'POST', body: JSON.stringify({ token: ctx.token }) });
dracord.onSessionUpdate(({ participants }) => renderLobby(participants));
```

Sunucuda (gizli anahtar yalnız sunucuda):

```ts
import { verifyDracordToken } from '@dracord/embedded-sdk';
const claims = await verifyDracordToken({ token, gameSecret: process.env.DRACORD_GAME_SECRET! });
```

Tam belge: https://dracord.mintlify.site/games
