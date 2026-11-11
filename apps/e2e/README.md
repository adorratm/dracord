# Dracord E2E duman testleri (Playwright)

```bash
yarn install
yarn workspace @dracord/e2e install-browsers   # bir kez: Chromium

# Herkese açık testler (hiçbir şey yazmaz) — canlıya karşı da güvenli
E2E_BASE_URL=https://dracord.com.tr E2E_API_URL=https://api.dracord.com.tr yarn e2e:public

# Tümü (yerel geliştirme: web :3000, API :4000)
E2E_REFRESH_TOKEN=... E2E_CHANNEL=<guildId>/<channelId> yarn e2e
```

| Dosya | Kapsam |
|---|---|
| `tests/public.spec.ts` | API sağlık, ana sayfa (JS hatası yok), giriş ekranı, oturumsuz yönlendirme, indirme sayfası, olmayan `/s/` → 404, `returnUrl=//` açık yönlendirme |
| `tests/chat.spec.ts` | mesaj gönder/gör, **Ctrl+V ile ekran görüntüsü yükleme**, **önizleme tam ekran** (gerileme testi) |
| `tests/resilience.spec.ts` | ağ koparken gelen mesaj ağ dönünce yenilemeden görünür; sekme gizle/göster |

**Oturum:** giriş yalnız Google/Apple/passkey ile olduğu için form doldurulmaz. Test hesabıyla tarayıcıda
giriş yap, DevTools › Application › Local Storage › `dracord_refresh_token` değerini `E2E_REFRESH_TOKEN` olarak ver.
Belirteç her yenilemede değişir; kurulum yenisini `apps/e2e/.auth/refresh-token` dosyasına yazar (gitignore'da),
sonraki çalıştırmalarda env gerekmez. Ayrı bir **test hesabı** ve **test sunucusu/kanalı** kullan: oturumlu testler
kanala yazar ve sonunda yalnız kendi yazdıklarını siler.
