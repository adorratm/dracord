# Mintlify (public developer docs)

## Kritik ayar

Mintlify dashboard → **Docs directory = `docs/mintlify`**

`docs/` kökünü seçme: prod rollout, migration, roadmap ve dahili checklist gizli sayfa olarak yayınlanır (URL + arama).

## Deploy

```bash
cd docs/mintlify
npx mintlify dev    # lokal
# push → otomatik deploy (bağlı repo)
```

Ana sayfa: `/` (`index.mdx`)  
Eski kırık link `/developer/README` → redirect `/`

## İçerik politikası

Public: bot, OAuth, HTTP, gateway, SDK, discovery, OpenAPI  
Private (repo `docs/` altında kalsın): prod-*, gelisim-*, scaling ops, platform-admin, T&S

Doğrulama: `yarn docs:check`
