# Mintlify publish

Kaynak markdown: `docs/developer/*`, `docs/sdk.md`, ops rehberleri.
Config: `docs/docs.json` (Mintlify path = `docs`) · kopya: `docs/mintlify/docs.json`.

## Yerel Next docs

```bash
yarn docs
# http://localhost:3002
yarn docs:check
```

## Mintlify Cloud

1. [mintlify.com](https://mintlify.com) → GitHub repo bağla
2. Docs directory: **`docs`**
3. `docs/docs.json` otomatik okunur
4. Deploy: dashboard veya `npx mintlify deploy` (CLI login)

Doğrulama: `.github/workflows/docs-mintlify.yml` push’ta `check-docs` + Next build çalıştırır.

Hosted URL genelde `*.mintlify.app` — `DOCS_PUBLIC_URL` / discovery `endpoints.docs` ile hizala.
