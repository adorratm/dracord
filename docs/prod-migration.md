# Prod şema / migration stratejisi

**Kural:** Üretimde TypeORM `synchronize` kapalı kalır (`NODE_ENV=production` ve `DATABASE_SYNCHRONIZE` unset/false).

## Neden sync ile değil?

- Çalışan API `DATABASE_URL` çoğu zaman **PgBouncer** üzerinden gider.
- `ALTER TYPE` / bazı DDL işlemleri transaction pool’da kırılır veya Nest bootstrap’i düşürür.
- Bu yüzden şema güncellemesi **doğrudan Postgres**’e, one-shot container ile yapılır.

## Standart akış (deploy)

1. Kodda entity / enum değişikliği merge edilir.
2. Deploy script: `DRACORD_SCHEMA_SKIP_RECREATE=1 bash docker/schema-sync-once.sh`  
   (`docker/deploy-remote.sh` zaten çağırır.)
3. Script:
   - Compose ile **api**’yi `DATABASE_SYNCHRONIZE=true` + `DATABASE_URL=…@postgres:5432` (direct) kısa süre çalıştırır
   - Enum genişletmeleri (`FORUM` / `GAME` / `WATCH_PARTY`) SQL ile garanti eder
   - Tablo varlığını smoke eder (`accounts` vb.)
4. Normal API pod’ları **sync kapalı** image ile ayağa kalkar.
5. Boot’ta `DatabaseBootstrapService` güvenli `ADD COLUMN IF NOT EXISTS` yapar (ör. `stateVersion`, `hiddenAt`, `guild_events.interestedUserIds`, `guild_events.isStage`). PgBouncer URL’de enum DDL atlanır.

## Manuel / acil

```bash
# VPS / opt/dracord
bash docker/schema-sync-once.sh
# veya deploy sırasında:
DRACORD_SCHEMA_SKIP_RECREATE=1 bash docker/schema-sync-once.sh
```

Referans: [`docker/schema-sync-once.sh`](../docker/schema-sync-once.sh), [`apps/api/src/database/database.module.ts`](../apps/api/src/database/database.module.ts), [`database-bootstrap.service.ts`](../apps/api/src/database/database-bootstrap.service.ts).

## Geliştirme

- Local: `synchronize` açık (`NODE_ENV !== production`).
- `yarn db:seed` — seed; migration runner değil.

## Gelecek (opsiyonel)

- TypeORM migration dosyaları + `migration:run` — sync-once’un yerini alabilir.
- O zamana kadar **tek kaynak**: entity + bootstrap + `schema-sync-once.sh`.

## Rollback

- Uygulama: önceki image / flag kapat.
- Şema: kolon eklemeleri genelde geriye uyumlu bırakılır; yıkıcı DROP yapılmaz. Gerekirse manuel SQL (dikkat).

## Checklist (yeni kolon / enum)

- [ ] Entity güncellendi
- [ ] Gerekirse `DatabaseBootstrapService` `IF NOT EXISTS`
- [ ] Enum ise `schema-sync-once.sh` SQL bloğuna ekle
- [ ] Staging’de `schema-sync-once` + API boot smoke
- [ ] Prod deploy (script sync + rolling API)
