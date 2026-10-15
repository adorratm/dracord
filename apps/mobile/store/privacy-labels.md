# Mağaza gizlilik / Data safety taslağı

App Store Privacy Nutrition Labels ve Google Play Data safety formlarına yapıştırılacak özet.
Gerçek uygulamadaki izinlere göre doldurulmuştur (`apps/mobile/app.json`).

## Toplanan / kullanılan veri (tipik)

| Veri | Amaç | Bağlı mı? | Kullanıcı görebilir/siler mi? |
| --- | --- | --- | --- |
| Hesap bilgisi (e-posta, kullanıcı adı, görünen ad) | Hesap, giriş (Google / ileride Apple) | Evet (hesap kimliği) | Profil + hesap silme |
| Kullanıcı içeriği (mesaj, sunucu, avatar) | Ürün işlevi | Evet | Silme / hesap silme |
| Ses / mikrofon | Sesli odalar, aramalar | Hayır (işlenir, kalıcı kayıt varsayılan değil) | İzin reddi |
| Kamera | Görüntülü / ekran (desteklenen yerler) | Hayır | İzin reddi |
| Bildirim token | Push bildirim | Evet (cihaz) | Ayarlardan kapat / hesap sil |
| Tanılama / çökme (varsa Sentry vb.) | Kararlılık | Hayır | — |
| Analitik (web GA4; mobilde varsa) | Kullanım ölçümü | Hayır / kısmen | Çerez / ayar |

## Kullanılmayan (beyan etme)

- Reklam kimliği / reklamcılık için takip (ilk aşama reklamsız)
- Konum (sürekli GPS) — kullanılmıyorsa “toplamıyoruz”
- Kişiler / rehber — yoksa işaretleme

## İzin gerekçeleri (kısa)

- **Mikrofon:** Ses kanalları ve sesli aramalar için.
- **Kamera:** Görüntülü katılım / desteklenen medya için.
- **Bildirimler:** Bahsetme, DM ve çağrı uyarıları.
- **Ön plan servisi (Android):** Ses odasında arka planda mikrofon için.

## Hesap silme

Uygulama içi: Ayarlar → Hesap Durumu → **Hesabı kalıcı sil** (onay: `SİL`).
Web: `https://dracord.com.tr/settings/account-status`

## Legal URL’ler

- Gizlilik: `https://dracord.com.tr/legal/privacy`
- Koşullar: `https://dracord.com.tr/legal/terms`
- KVKK: `https://dracord.com.tr/legal/kvkk`
- Topluluk: `https://dracord.com.tr/legal/community`

## Destek e-postası

Mağaza formuna kendi destek adresini yaz (ör. `info@dracord.com.tr`).
