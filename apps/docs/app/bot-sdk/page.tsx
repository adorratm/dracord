export default function BotSdkPage() {
  return (
    <>
      <h1>@dracord/bot-sdk</h1>
      <p>
        Monorepo: <code>packages/bot-sdk</code>. npm publish için hazır (
        <code>publishConfig.access=public</code>).
      </p>
      <pre>{`import { DracordBot, guildShardIndex } from '@dracord/bot-sdk';

const bot = await DracordBot.fromDiscovery(
  'http://localhost:4000',
  process.env.BOT_TOKEN!,
);

await bot.sendMessage(channelId, 'merhaba');
await bot.syncCommands(appId, guildId, [
  { name: 'ping', description: 'Pong' },
]);

bot.connectGateway({ shard: [0, 1], onReady: console.log });
guildShardIndex(guildId, 2);`}</pre>
      <h2>API</h2>
      <ul>
        <li>
          <code>fromDiscovery(origin, token)</code>
        </li>
        <li>
          <code>health</code> · <code>me</code> · <code>getGuild</code>
        </li>
        <li>
          <code>sendMessage</code> · <code>syncCommands</code>
        </li>
        <li>
          <code>connectGateway</code> / <code>disconnectGateway</code>
        </li>
        <li>
          <code>guildShardIndex</code>
        </li>
      </ul>
      <h2>Publish</h2>
      <pre>{`yarn workspace @dracord/bot-sdk build
yarn workspace @dracord/bot-sdk npm publish --access public`}</pre>
    </>
  );
}
