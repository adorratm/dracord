# Mintlify (public developer docs)

## Canlı site durumu

Mintlify dashboard’da **Docs directory** iki şekilde olabilir:

| Ayar | Sayfa URL’leri | `docs.json` |
| --- | --- | --- |
| `/docs` (şu an canlı) | `/mintlify/quickstart` … | `docs/docs.json` + `.mintignore` |
| `/docs/mintlify` (tercih) | `/quickstart` … | `docs/mintlify/docs.json` |

**Tercih edilen:** Git Settings → “docs.json is in a subdirectory” → path = `docs/mintlify`  
Böylece URL’ler `/quickstart` gibi temiz kalır ve `/mintlify` öneki olmaz.

Path hâlâ `/docs` ise `docs/docs.json` tüm sayfaları `mintlify/*` olarak listeler; MDX’teki `/quickstart` linkleri redirect ile `/mintlify/quickstart`’a gider. Dahili `docs/*.md` dosyaları `.mintignore` ile yayınlanmaz.

## Deploy

```bash
cd docs/mintlify
npx mintlify dev    # lokal (path=docs/mintlify varsayımı)
# push → Mintlify otomatik deploy
```

Doğrulama: `yarn docs:check` (veya `node scripts/check-docs.mjs`)

## İçerik politikası

Public (`docs/mintlify`): bot, OAuth, HTTP, gateway, SDK, discovery, OpenAPI  
Private (repo `docs/` altında, `.mintignore`): prod-*, gelisim-*, scaling, platform-admin, T&S
