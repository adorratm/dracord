export default function BotGatewayPage() {
  return (
    <>
      <h1>Bot Gateway</h1>
      <p>
        Socket.IO namespace <code>/v1/gateway</code> — chat gateway’den ayrı. Hello
        paketinde <code>shard_id</code> / <code>shard_count</code> gelir.
      </p>
      <pre>{`import { DracordBot } from '@dracord/bot-sdk';

const bot = new DracordBot({
  token: process.env.BOT_TOKEN!,
  baseUrl: 'http://localhost:4000',
});

bot.connectGateway({
  shard: [0, 1], // multi-instance: Hello dilimi veya açık pair
  onReady: (d) => console.log('ready', d),
  onDispatch: (t, d) => console.log(t, d),
});`}</pre>
      <h2>Paket akışı</h2>
      <ul>
        <li>
          Hello <code>op:10</code> → Identify <code>op:2</code>{' '}
          <code>{'{ token, shard? }'}</code>
        </li>
        <li>
          Heartbeat <code>op:1</code> → ACK <code>op:11</code>
        </li>
        <li>
          READY <code>d.shard: [id, count]</code>
        </li>
        <li>
          Dispatch <code>op:0</code> — <code>guildId</code> varsa shard filtresi
        </li>
      </ul>
      <h2>Guild hash</h2>
      <pre>{`Number((BigInt(guildId) >> 22n) % BigInt(shardCount))`}</pre>
      <p>
        Ayrıntı: repo <code>docs/developer/scaling.md</code>.
      </p>
    </>
  );
}
