# Prod güvenli rollout (son değişiklikler)

Amaç: Canlıda **hiçbir mevcut özellik kırılmadan** yeni sync / gateway / keşfet kodunun çalışması.

## Varsayılanlar (flag’siz = eski davranışa yakın)

| Env | Varsayılan | Etki |
| --- | --- | --- |
| `ACTIVITY_CAS` | off | `expectedVersion` zorunlu değil. İstemci gönderirse mismatch → 409 + snapshot (zararsız reconcile) |
| `ACTIVITY_BILLIARDS_AUTHORITY` | **off** | Shot sıra doğrulaması kapalı; eski bilardo akışı aynı |
| `SOCKET_REDIS_REQUIRED` | off | Redis adapter yoksa ready yine 200 (tek instance OK) |
| `VOICE_ORPHAN_CLEANUP` | on (unset) | 90s soketsiz ses hayaletini temizler; kapat: `false` |

## Deploy sırası (zorunlu)

1. **Şema:** `stateVersion` kolonu  
   - `bash docker/schema-sync-once.sh` veya API boot `DatabaseBootstrapService` (`ADD COLUMN IF NOT EXISTS`)
2. API image roll (yeni kod)
3. Web / desktop / mobile istemciler (CAS reconcile + reconnect)

Kolon yokken yeni API `stateVersion` okursa hata alabilir → **önce şema, sonra API**.

## Davranış doğrulama (smoke)

- [ ] Metin kanalı mesaj / presence
- [ ] Ses odası join / leave / roster (reconnect sonrası liste dolu)
- [ ] Bilardo vuruş (flag’siz)
- [ ] Watch party play/seek (host heartbeat sessiz)
- [ ] Trivia / kelime / blackjack turu (state silinmemeli)
- [ ] Keşfet sunucu listesi + katıl
- [ ] `GET /health/ready`, `/health/activity-sync`, `/health/gateway`

## Rollback

- Önceki API/web image
- Flag’leri açtıysan kapat (`ACTIVITY_CAS`, `ACTIVITY_BILLIARDS_AUTHORITY`, `SOCKET_REDIS_REQUIRED`)
- `VOICE_ORPHAN_CLEANUP=false` ile hayalet temizliği kapatılabilir

## Bilinen güvenli farklar (kırılma değil)

- İstemci `expectedVersion` gönderir → eşzamanlı patch’te 409 + otomatik reconcile (oyun devam eder)
- Keşfet “Aktiviteler” sekmesi mağaza değil; sunucu listesi gerçek API
- Gateway metrikleri: `GET /health/gateway`
