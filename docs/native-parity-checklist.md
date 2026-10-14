# Native tam parity — Desktop / iOS / Android

WebView yok. Referans: `apps/web`. Ortak: `@dracord/sdk`, `@dracord/game-core`, `@dracord/app-theme`.

Durum: `Y` = işlevsel parity · `P` = kısmi · `-` = yok · `N/A` = platform kısıtı

| Özellik | Desktop | iOS | Android |
|--------|---------|-----|---------|
| Login / Google OAuth | Y | Y | Y |
| Onboarding username | Y | Y | Y |
| Sunucu rayı + kanal ağacı (kategori) | Y | Y | Y |
| Üye listesi / presence | Y | Y | Y |
| Okunmamış badge | Y | Y | Y |
| Sunucu oluştur / davet katıl / ayrıl | Y | Y | Y |
| Son kanal hatırlama | Y | Y | Y |
| Metin: gönder / düzenle / sil / yanıt | Y | Y | Y |
| Pin / tepki / thread | Y | Y | Y |
| Anket / yazıyor | Y | Y | Y |
| WebP / ek yükleme | Y | Y | Y |
| FriendsHub + engel + ara | Y | Y | Y |
| DM + DM call | Y | Y | Y |
| Voice: mic / deafen / kamera | Y | Y | Y |
| Voice: ekran paylaşımı | Y | N/A | N/A |
| Voice yan sohbet | Y | Y | Y |
| Oyunlar (BJ/bilardo/okey/bowling/tavla) | Y | Y | Y |
| Watch party | Y | Y | Y |
| Global arama + mesaj arama | Y | Y | Y |
| Bildirim merkezi | Y | Y | Y |
| Guild/kanal yönetimi (rol, davet, ban) | Y | Y | Y |
| Kullanıcı ayarları (hesap/ses/görünüm/…) | Y | Y | Y |
| Keşfet | Y | Y | Y |

## Smoke test

1. Google login → (gerekirse) username onboarding → sunucu seç → metin kanalı mesaj  
2. Yanıt / tepki / pin / thread / anket / görsel ek  
3. Arkadaş isteği → DM aç → (isteğe) DM call  
4. Ses odası: mute / deafen / kamera; desktop’ta ekran paylaşımı  
5. Oyun kanalı (BJ veya tavla) + watch party medya URL  
6. Keşfet / Ctrl+K arama / bildirimler / sunucu ayarları / kullanıcı ayarları  

## Notlar

- Electron STUN/GPU logları Chromium gürültüsü olabilir; ses çalışıyorsa engel değil.  
- Mobil ekran paylaşımı OS kısıtlı; API bayrakları / yorum ile belgelendi.  
- Piksel-mükemmel CSS zorunlu değil; aynı akışlar ve API davranışı zorunlu.
