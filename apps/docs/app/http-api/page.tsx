export default function HttpApiPage() {
  return (
    <>
      <h1>HTTP API</h1>
      <p>
        Auth: kullanıcı <code>Bearer</code> · bot <code>Authorization: Bot &lt;token&gt;</code>
      </p>
      <h2>Platform bot</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>GET</td>
            <td>
              <code>/v1/health</code>
            </td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/v1/users/@me</code>
            </td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/v1/guilds/:id</code>
            </td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/v1/channels/:id/messages</code>
            </td>
          </tr>
          <tr>
            <td>PUT</td>
            <td>
              <code>/v1/applications/:id/commands</code>
            </td>
          </tr>
        </tbody>
      </table>
      <h2>Rate limit</h2>
      <p>
        Bot istekleri uygulama başına pencere limiti (<code>PLATFORM_RATE_LIMIT</code>,
        varsayılan 60/dk). Redis varsa paylaşılır; yoksa bellek.
      </p>
      <h2>Kaynak</h2>
      <p>
        Repo: <code>docs/developer/http-api.md</code>
      </p>
    </>
  );
}
