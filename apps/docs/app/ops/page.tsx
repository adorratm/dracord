export default function OpsPage() {
  return (
    <>
      <h1>Ops</h1>
      <h2>Migration</h2>
      <pre>{`yarn db:migrate
# veya
yarn workspace @dracord/api db:migrate`}</pre>
      <p>
        Prod’da <code>DATABASE_SYNCHRONIZE</code> kapalı tut; şema için migration
        çalıştır.
      </p>
      <h2>Hash import</h2>
      <pre>{`POST /platform-admin/trust-safety/hashes/import
{ "text": "abc123...\\ndef456...,sha256-prefix,csam,0.99,note" }`}</pre>
      <p>PhotoDNA / NCMEC ortaklığı değildir — yerel DB.</p>
      <h2>Gateway shard</h2>
      <pre>{`INSTANCE_ID=api-0
INSTANCE_SHARD_ID=0
INSTANCE_SHARD_COUNT=2
REDIS_URL=redis://...
SOCKET_REDIS_REQUIRED=true`}</pre>
      <p>
        Guild hash: <code>(guildId &gt;&gt; 22) % count</code>. Bot identify{' '}
        <code>shard: [id, count]</code>. Chat voice yanlış dilimde{' '}
        <code>WRONG_SHARD</code>. Ayrıntı:{' '}
        <code>docs/developer/scaling.md</code>
      </p>
      <h2>Funnel</h2>
      <pre>{`GET /health/funnel`}</pre>
      <h2>Docs publish</h2>
      <pre>{`yarn docs                 # Next :3002
# Mintlify cloud: docs/mintlify/docs.json`}</pre>
    </>
  );
}
