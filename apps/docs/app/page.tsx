import Link from 'next/link';

export default function DocsHome() {
  return (
    <>
      <div className="hero-card">
        <h1>Dracord Developer</h1>
        <p>
          Platform bot API, OAuth2, Socket.IO gateway, guild shard MVP ve OpenAPI.
          Base URL uydurma — discovery’den oku.
        </p>
        <div className="pill-row">
          <span className="pill">bot-sdk</span>
          <span className="pill">gateway shard</span>
          <span className="pill">OpenAPI</span>
        </div>
      </div>
      <pre>{`GET /.well-known/dracord
GET /openapi.json`}</pre>
      <h2>Hızlı başlangıç</h2>
      <ol>
        <li>Uygulama oluştur → bot token al</li>
        <li>
          <code>PLATFORM_API=true</code>
        </li>
        <li>
          <Link href="/bot-sdk">
            <code>@dracord/bot-sdk</code>
          </Link>{' '}
          veya ham HTTP
        </li>
        <li>
          Slash sync: <code>PUT /v1/applications/:id/commands</code>
        </li>
        <li>
          Gateway: <Link href="/bot-gateway">/v1/gateway</Link> (+ isteğe{' '}
          <code>shard: [id, count]</code>)
        </li>
      </ol>
      <h2>Paketler</h2>
      <ul>
        <li>
          <code>@dracord/bot-sdk</code> — bot REST + gateway
        </li>
        <li>
          <code>@dracord/sdk</code> — kullanıcı istemcisi
        </li>
      </ul>
      <h2>Publish</h2>
      <p>
        Yerel site: <code>yarn docs</code> → :3002. Mintlify cloud iskeleti:{' '}
        <code>docs/mintlify</code>.
      </p>
    </>
  );
}
