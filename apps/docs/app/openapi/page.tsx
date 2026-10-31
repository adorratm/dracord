import Link from 'next/link';

export default function OpenApiPage() {
  return (
    <>
      <h1>OpenAPI</h1>
      <p>
        Statik özet belge. Canlı API:{' '}
        <code>GET /openapi.json</code> · bu sitede:{' '}
        <Link href="/openapi.json">/openapi.json</Link>
      </p>
      <p>
        Kaynak dosya: <code>docs/developer/openapi.json</code>. Nest dekoratör
        generate sonraki aşama; Mintlify/Nextra tam site yerine bu iskelet
        kullanılıyor.
      </p>
      <pre>{`curl -s http://localhost:4000/openapi.json | head`}</pre>
    </>
  );
}
