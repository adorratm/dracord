export default function OauthPage() {
  return (
    <>
      <h1>OAuth2</h1>
      <p>
        Flag: <code>PLATFORM_OAUTH=true</code>. Consent UI:{' '}
        <code>/oauth/authorize</code>
      </p>
      <table>
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Not</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>GET /oauth2/application/:id</code>
            </td>
            <td>name + scopes</td>
          </tr>
          <tr>
            <td>
              <code>POST /oauth2/authorize</code>
            </td>
            <td>scope seçimi, Bearer kullanıcı</td>
          </tr>
          <tr>
            <td>
              <code>POST /oauth2/token</code>
            </td>
            <td>
              <code>authorization_code</code> | <code>refresh_token</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Token yanıtı: <code>access_token</code>, <code>refresh_token</code>,{' '}
        <code>expires_in</code>, <code>scope</code>
      </p>
    </>
  );
}
