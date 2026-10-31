export default function SlashOptionsPage() {
  return (
    <>
      <h1>Slash options</h1>
      <p>
        Discord-parity tipli argümanlar. Sync:{' '}
        <code>PUT /v1/applications/:id/commands</code>
      </p>
      <pre>{`{
  "guildId": "global",
  "commands": [{
    "name": "ban",
    "description": "Kullanıcıyı yasakla",
    "usage": "/ban user:@x reason:spam",
    "options": [
      { "type": 6, "name": "user", "description": "Hedef", "required": true },
      { "type": 3, "name": "reason", "description": "Sebep", "required": false }
    ],
    "responseTemplate": "{user} yasakladı: {opt.user} ({opt.reason})"
  }]
}`}</pre>
      <h2>Tipler</h2>
      <table>
        <thead>
          <tr>
            <th>type</th>
            <th>Anlam</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>3</td>
            <td>STRING</td>
          </tr>
          <tr>
            <td>4</td>
            <td>INTEGER</td>
          </tr>
          <tr>
            <td>5</td>
            <td>BOOLEAN</td>
          </tr>
          <tr>
            <td>6</td>
            <td>USER</td>
          </tr>
          <tr>
            <td>7</td>
            <td>CHANNEL</td>
          </tr>
          <tr>
            <td>8</td>
            <td>ROLE</td>
          </tr>
          <tr>
            <td>9</td>
            <td>MENTIONABLE</td>
          </tr>
          <tr>
            <td>10</td>
            <td>NUMBER</td>
          </tr>
          <tr>
            <td>11</td>
            <td>ATTACHMENT</td>
          </tr>
        </tbody>
      </table>
      <p>
        Çağrı: <code>/ban user:@mina reason:spam</code> veya konumlu{' '}
        <code>/ban @mina spam</code>
      </p>
    </>
  );
}
