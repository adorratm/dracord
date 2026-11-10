# Dracord — Yol haritası (2026 Q4 →)

> Çalışma belgesi. Önce **seçim** yapılır, sonra madde madde ilerlenir.
> Durum işaretleri: `[x]` bitti · `[~]` devam · `[ ]` bekliyor · `(?)` karar bekliyor.
> Önceki roadmap (P0–P3, tamamlandı): [gelisim-yapilacaklar.md](./gelisim-yapilacaklar.md)

## İlkeler

1. **Üç platform birlikte:** web (Next.js) · desktop (Electron + desktop-ui/Vite) · mobil (Expo). Bir
   özellik bir platformda yoksa bu belgede açıkça "web/desktop önce" diye yazılır.
2. **Canlıyı bozma:** yeni davranış flag arkasında, varsayılan **off**; `yarn smoke` +
   [native-parity-checklist.md](./native-parity-checklist.md) geçmeden açılmaz.
3. **Ortak kod önce:** UI `packages/ui`, tipler `packages/types`, oyun mantığı `packages/game-core`.
   `apps/web/lib` ↔ `apps/desktop-ui/src/hooks` kopyaları (ör. `use-remote-control.ts` = `useRemoteControl.ts`)
   paylaşılan pakete taşınır.

---

## Faz 0 — Bildirilen hatalar

### 0.1 Keşfet banner'ı okunmuyor `[x]`
- **Neden:** Koyu temada `--color-on-primary-container: #4e2484` (koyu mor) yazı, koyu mavi→mor
  gradyan üstünde. Açık temada beyaz yazı açık gri üstünde. Kontrast ~1.5:1 (WCAG en az 4.5:1).
- **Düzeltme:** Banner metni sabit beyaz + gölge, metnin arkasına soldan koyu perde
  (`from-black/55`). Hem "Topluluğunu bul" hem "Aktivite kısayolları" banner'ı.
- **Dosyalar:** `apps/desktop-ui/src/views/DiscoverPage.tsx`, `apps/web/app/discover/page.tsx`
  (aynı hata webde de vardı). Mobil kendi tema renklerini kullanıyor, etkilenmedi.
- [ ] Görsel kontrol: desktop + web, koyu ve açık tema.

### 0.2 Uzak kontrol — çıkılamıyor + kalite `[~]` (kod tamam, Windows'ta test bekliyor)
Tespit edilen kök nedenler (kod okunarak; canlıda doğrulanacak):

**A. Kontrol eden kişi çıkamıyor** — `packages/ui/src/components/VoiceStage.tsx`
- Kontrol yüzeyi `absolute inset-0 z-[3]`, alttaki "Kontrolü bırak" çubuğu `z-[2]` → buton
  yüzeyin **altında** kalıyor; tıklama butona değil karşı bilgisayara gidiyor.
- `cursor-none` → kendi imlecin görünmüyor.
- `setPointerCapture` alınıyor, bırakılmıyor → fare yüzeye yapışık kalıyor.
- Tüm tuşlar `preventDefault` + karşıya iletiliyor; **Esc dahil** → klavyeden kaçış yok.

Plan:
- [x] Kontrol çubuğu yüzeyin üstünde (`z-[4]`) + yüzeyin tepesinde ayrı **Bırak** şeridi.
- [x] Görünür imleç (`crosshair`), capture `pointerup`/`lostpointercapture`'da bırakılıyor.
- [x] Kaçış: **Esc 0,8 sn basılı tut** veya `Ctrl+Alt+Esc` (kısa Esc karşıya normal gider). Odak kaybında basılı tuşlar bırakılır.
- [x] Üst şerit: "Kontrol ediyorsun · Esc basılı tut = bırak" — `packages/ui/src/components/RemoteControlSurface.tsx`.

**B. Paylaşan kişi** — `apps/desktop/main.js`, `apps/desktop/remote-input.js`
- [x] Global acil durdurma **Ctrl+Shift+F12** (Dracord odakta olmasa da). Önce yerelde inject'i keser, sonra oturumu kapatır.
- [x] Paylaşanın kendi faresi hareket edince kontrolü 1,5 sn durdur (GetCursorPos sapması >12 px; hook gerektirmeden). UI'a `remote-control:user-override` gider.

**C. İmleç yanlış yere gidiyor (yüksek ihtimal)**
- Sınırlar `window.screen`'den alınıyor (DIP), `SetCursorPos` fiziksel piksel istiyor →
  %125/%150 Windows ölçeklemede imleç kayar.
- Paylaşılan kaynak değil, Dracord penceresinin bulunduğu ekran kullanılıyor → çoklu monitörde
  ve **pencere paylaşımında** koordinatlar yanlış.
- [x] Hedef main process'te: ekran → `display_id` eşleşmesi + `dipToScreenRect` (fiziksel piksel); pencere → HWND + DWM görünür sınırları (pencere taşınsa da doğru). PowerShell per-monitor DPI aware v2.

**D. Klavye eksikleri**
- `keyToVk` Shift/Ctrl/Alt/Win, F1–F12, noktalama ve Türkçe karakterleri (ğüşıöç) eşlemiyor;
  `ctrl/alt/shift` bayrakları gönderiliyor ama inject tarafında kullanılmıyor → Ctrl+C gibi kısayollar çalışmaz.
- [x] `KeyboardEvent.code` → **scancode** (SendInput, layout bağımsız: Ctrl/Shift/Alt/Win, F1–F12, numpad, ğüşıöç). Bilinmeyen tuşta `KEYEVENTF_UNICODE`.

**E. Gecikme / akıcılık**
- Her olay: socket → API → socket → IPC → PowerShell `ConvertFrom-Json`. Fare hareketi 30 Hz.
- [x] Fare hareketi socket **volatile** (tıkanınca birikmez), 60 Hz. Satır tabanlı protokol (JSON parse yok).
- [ ] LiveKit data channel'a taşıma — ölçüm sonrası gerekirse.
- [x] `mouse_event/keybd_event` yerine `SendInput`. (Native modül/koffi gerekirse sonra.)

**F. Görüntü kalitesi**
- `adaptiveStream: true` izleyicide küçük öğe için düşük katman seçebiliyor; 1080p yayında
  ikinci katman yalnızca h720.
- ≥30 FPS'de `contentHint: 'motion'` → metin bulanıklaşır (uzak kontrolde metin önemli).
- Codec belirtilmemiş (VP8 varsayılan).
- [x] Kontrol aktifken izleyicide `source` kalite zorlanır (`setRemoteControlQualityBoost`), bitince kullanıcının ayarına döner (ayar değişmez).
- [x] Kontrol edilirken paylaşanda canlı `contentHint='detail'` + `maintain-resolution` (`setRemoteControlSharerDetail`).
- [ ] Codec denemesi: H.264 (donanım encode) ve VP9/AV1 SVC — flag ile A/B.
- [ ] Yayına "istatistik" katmanı (çözünürlük, fps, bitrate, kayıp) — teşhis için.

**Test:** `node apps/desktop/scripts/remote-input-smoke.js` (Windows) → imleç ortaya gitmeli.
Manuel: %150 ölçekli ekranda tık konumu · pencere paylaşımı · Ctrl+C/V · ğüş · Esc basılı · Ctrl+Shift+F12.

**G. Platform kapsamı**
- Karar (2026-11-09): **önce Windows sağlamlaştırılır**, ardından:
- [~] Mobil **kontrol eden**: mobil **web** hazır (dokunuş/uzun bas/sürükle/iki parmak). Expo uygulaması sonraki adım.
- [x] macOS **kontrol edilen** (`remote-input-mac.js`: JXA + CGEvent, Accessibility izni; şimdilik yalnız tüm ekran paylaşımı). Test: `node apps/desktop/scripts/remote-input-smoke-mac.js`.
- Karar (2026-11-09): **hiçbir şey ertelenmiyor** — 0.2 başladı.

---

## Faz 1 — Optimizasyon ve sağlamlık

- [ ] **Ortak hook'ları pakete taşı:** web ↔ desktop-ui kopya dosyaları (`use-remote-control`, ses/ekran ayarları) → `packages/*`.
- [ ] **Performans bütçesi:** desktop açılış süresi, web LCP/INP, mobil soğuk açılış; her sürümde ölçüm.
- [ ] **Bundle diyeti:** web/desktop-ui chunk analizi, oyunlar ve ağır modüller lazy.
- [ ] **Bağlantı dayanıklılığı:** socket/LiveKit yeniden bağlanma senaryoları (uyku, ağ değişimi, mobil arka plan).
- [ ] **E2E smoke:** Playwright (web) + Windows desktop E2E — giriş, mesaj, ses, ekran paylaşımı, uzak kontrol.
- [ ] **Erişilebilirlik/kontrast taraması:** tüm ekranlar koyu+açık tema (`ui-ux-pro-max`, `frontend-a11y`).
- [ ] **Hata görünürlüğü:** istemci hata raporlama (Sentry/GlitchTip self-host) `(?)`
- [ ] Repo temizliği: `apps/desktop/_tts-smoke*.js`, `tts-log*.txt`, `sync-test.txt`, kökteki
  `youtube-cookies.*` (gitignore'da ama kökte duruyor) gözden geçir.

---

## Faz 2 — Oyun platformu altyapısı (COOMBIE için zemin)

Hedef: Dracord içinde **gerçek zamanlı** oyun odaları; web/mobil/desktop fark etmeksizin
arkadaşlarla oynama. COOMBIE Dracord'da **ücretsiz** kalır; Steam sürümü ayrı dağıtım, ortak kod.

Gözlem: Mevcut aktiviteler (okey, tavla, bilardo, blackjack, trivia, words, watch party)
**sıra tabanlı CAS state** ile çalışıyor (`packages/game-core/activity-sync.ts`). COOMBIE
(PROTOCOL-Z: NestJS + socket.io + three.js, aynı Yarn 4/TS 6 yığını) ise gerçek zamanlı aksiyon →
farklı bir taşıma katmanı ister.

- [ ] **Dracord Embedded SDK** (`@dracord/embedded-sdk`): iframe/webview içindeki oyuna kimlik,
  oda üyeleri, davet, ses kanalı durumu, `postMessage` köprüsü. Harici geliştiricilere de açılabilir.
- [ ] **Oyun odası (lobby) modeli:** ses kanalına bağlı oda, hazır ol, host, izleyici, davet linki.
- [ ] **Gerçek zamanlı taşıma — karar: oyunun kendi sunucusu.** COOMBIE API (socket.io) oyunu
  yönetir; Dracord kimlik (kısa ömürlü oyun token'ı), oda, davet ve ses kanalını sağlar.
  Aynı sunucu Steam sürümüne de hizmet eder.
- [ ] **Girdi soyutlama:** klavye/fare, gamepad, mobil sanal joystick — oyun SDK'dan alır.
- [ ] **Profilde oyun:** "COOMBIE oynuyor" durumu, başarımlar, skor tablosu (sunucu bazlı).
- [ ] **Mobil performans profili:** three.js için düşük kalite modu, pil/ısı sınırı.

### COOMBIE oyun içi notlar (oyun tarafında yapılacak — şimdilik park)
- Boss'lar ve özel yetenekleri yok.
- Başlangıçta çok fazla spawn.
- Silah hasarı / zombi canı dengesizliği çok yüksek (başta çok mermi gidiyor).
- Zombiler oyun ilerledikçe güçlenmeli (dalga/zamanla ölçeklenen can, hız, hasar).

---

## Faz 3 — Yeni özellik menüsü (seçim yapılacak)

Mevcutta var olanlar (tekrar önerilmedi): forum/thread, anket, TOTP 2FA, etkinlik/RSVP, stage,
Nitro, sticker, Spotify, müzik botu, watch party, bot platformu, keşfet, otomod.

Etiket: Etki **Y/O/D** · Efor **S/M/L** · Platform **W/D/M**

### A. İletişim
| # | Özellik | Etki | Efor | Platform |
| --- | --- | --- | --- | --- |
| A1 | Sesli mesaj (DM/kanal, dalga formu, hız) | Y | M | W/D/M |
| A2 | Soundboard (sunucu ses efektleri, ses kanalında) | Y | M | W/D/M |
| A3 | Klip kaydı — son 30 sn oyun/ekran (desktop) | Y | L | D (W kısıtlı) |
| A4 | Ekran paylaşımında çizim/işaretleme | O | M | W/D |
| A5 | Mesaj zamanlama + hatırlatıcıya dönüştür | O | S | W/D/M |
| A6 | Ses kanalı durum metni ("Valorant ranked") | O | S | W/D/M |
| A7 | Canlı altyazı / transkript (ses kanalı) | O | L | W/D/M |

### B. Topluluk
| # | Özellik | Etki | Efor | Platform |
| --- | --- | --- | --- | --- |
| B1 | Seviye/XP + rol ödülleri (bot gerekmeden) | Y | M | W/D/M |
| B2 | Sunucu istatistik paneli (aktiflik, büyüme) | O | M | W/D |
| B3 | Sunucu tanıtım sayfası + vanity URL | O | M | W |
| B4 | Sunucu rozetleri / profil vitrini | O | S | W/D/M |

### C. Oyun ve aktivite
| # | Özellik | Etki | Efor | Platform |
| --- | --- | --- | --- | --- |
| C1 | Faz 2 altyapısı + COOMBIE odası | Y | L | W/D/M |
| C2 | Turnuva modu (braket, okey/tavla/bilardo) | O | M | W/D/M |
| C3 | Haftalık meydan okuma / sezon skor tablosu | O | M | W/D/M |
| C4 | Oyun overlay iyileştirme (FPS, sesli kişiler) | O | M | D |

### D. Yapay zekâ (Draco)
| # | Özellik | Etki | Efor | Platform |
| --- | --- | --- | --- | --- |
| D1 | "Ne kaçırdım?" kanal özeti | Y | M | W/D/M |
| D2 | AI destekli moderasyon (toksisite skoru → otomod) | O | M | sunucu |
| D3 | Mesaj çevirisi (tek tık) | O | S | W/D/M |
| D4 | Draco asistan bot (sunucu SSS, komutlar) | O | M | W/D/M |

### E. Güvenlik ve hesap
| # | Özellik | Etki | Efor | Platform |
| --- | --- | --- | --- | --- |
| E1 | Passkey (WebAuthn) ile giriş | O | M | W/D/M |
| E2 | Oturum/cihaz yönetimi (uzaktan çıkış) | O | S | W/D/M |
| E3 | Uçtan uca şifreli DM (opsiyonel) | O | L | W/D/M |

---

## Kararlar (2026-11-09)

- **Her şey yapılacak**, ertelenen madde yok; sıra yalnızca uygulama sırasıdır.
- **Yapay zekâ bütçesi: 0 ₺.** Sunucuya model/API maliyeti eklenmez. Kurallar:
  - Çeviri/özet **istemci cihazında** çalışır (tarayıcı yerleşik Translator/Summarizer API varsa o;
    yoksa `transformers.js` ile küçük açık model, isteğe bağlı indirme, önbellekli).
  - Cihaz desteklemiyorsa **yapay zekâsız yedek**: "Ne kaçırdım" = bahsetmeler + en çok tepki alanlar +
    sabitlenenler + bağlantılar (sunucuda basit SQL, maliyetsiz).
  - Moderasyon (D2): mevcut otomod + kelime/regex + spam skorlaması; model yok.
- **Oyun SDK'sı herkese açık.** Herkes geliştirir ve test eder (geliştirici modu / kendi sunucusunda
  test kanalı); **Dracord'da yayın kararı admin'de** (`admin.dracord.com.tr` → Oyunlar → İnceleme).
  Geliştirici dokümantasyonu Mintlify'da (`docs/mintlify`) ayrıntılandırılır.

## İlk dalga (karar 2026-11-09: dört grubun hepsi)

Sıralama önerisi — küçük ve bağımsız olanlar önce, büyük altyapı paralel:

| Sıra | Madde | Neden bu sırada |
| --- | --- | --- |
| 1 | A6 ses kanalı durumu · A5 mesaj zamanlama · D3 çeviri | Küçük (S), hızlı kazanım, her platformda |
| 2 | B1 seviye/XP + rol ödülü | Topluluğu canlı tutar; mevcut mesaj/ses olaylarına bağlanır |
| 3 | A1 sesli mesaj · A2 soundboard | Orta efor, mevcut upload + LiveKit altyapısını kullanır |
| 4 | D1 "Ne kaçırdım?" özeti | Cihaz üstü AI + yapay zekâsız yedek |
| 5 | C1 Embedded SDK + oyun odası (lobby) | Büyük; 1–4 ile paralel yürüyebilir |
| 6 | B2 istatistik · C2 turnuva · A3 klip · A4 çizim · D2/D4 | Sonraki dalga adayları |

## Dalga 1 durumu

### A6 Ses kanalı durum metni `[x]` (kod tamam · test bekliyor)
- Kanaldaki herkes ayarlar/temizler (≤100 karakter, 1,5 sn hız sınırı); kanal boşalınca otomatik silinir,
  boş kanala ilk giren eski durumu görmez. Redis'te (`voice:status:*`, 12 sa TTL) — **DB değişikliği yok**.
- Soket: `voice:channel-status` (ack'li) · `VOICE_SYNC.statusByChannel`.
- UI: kanal listesinde üye avatarlarının üstünde satır (web/desktop/mobil) · ses odası başlığında
  düzenlenebilir çip (web/desktop) · mobil ses odasında düzenleme alanı.
- Dosyalar: `voice-presence.service.ts`, `chat.gateway.ts`, `socket-broadcast.service.ts`,
  `packages/ui/.../VoiceChannelStatusChip.tsx`, `use-voice-channel-status.ts`, mobil `VoiceRoom.tsx`, `ChannelList.tsx`.

### A5 Mesaj zamanlama `[x]` (kod tamam · test bekliyor)
- `scheduled_messages` tablosu (migration `1762700000000-ScheduledMessages`; schema-sync de oluşturur).
- REST: `POST/GET /channels/:id/scheduled-messages`, `GET /users/me/scheduled-messages`,
  `PATCH|DELETE /users/me/scheduled-messages/:id`, `POST …/:id/send-now`.
- Gönderim mevcut 20 sn `REMINDERS_TICK` içinde; Redis kuyruğu yoksa doğrudan. `pending → sending`
  atomik geçişi → çoklu API instance'ta çift gönderim yok; çöken gönderim 5 dk sonra yeniden denenir.
- Gönderim anında izin + otomod yeniden kontrol; kalıcı hata → kullanıcıya SİSTEM bildirimi.
- Sınırlar: ≥1 dk, ≤30 gün, kullanıcı başına 25 bekleyen.
- UI: web/desktop `+` menüsü → **Mesajı zamanla** (hazır seçenekler + özel saat), giriş kutusunun
  üstünde bekleyenler çubuğu (Şimdi gönder / İptal). Mobil: gönder tuşuna **uzun bas** veya araç
  çubuğundaki ⏰ → sayfa. Thread / forum gönderilerinde kapalı.

### D3 Mesaj çevirisi `[x]` (kod tamam · test bekliyor) — **0 ₺**
- Chrome 138+ / Edge 148+ masaüstü web: tarayıcı yerleşik **Translator + LanguageDetector** (cihaz üstü,
  metin cihazdan çıkmaz; dil paketi ilk kullanımda iner, ilerleme gösterilir). Sonuç mesajın altında,
  "Orijinali göster".
- Desteklemeyen her yer (Electron desktop, Firefox, Safari, mobil): **Çevir** → Google Çeviri
  sayfası/uygulaması kullanıcının cihazında açılır.
- [ ] Sonraki adım: transformers.js + opus-mt (Web Worker) ile Electron'da da cihaz üstü çeviri.

### Test listesi (Dalga 1)
- [ ] İki kullanıcı aynı ses kanalında: biri durum yazar → diğerinin kanal listesinde anında görünür; herkes çıkınca kaybolur.
- [ ] Mesajı 2 dk sonraya zamanla → gönderilir, çubuktan düşer; "Şimdi" ve "İptal" çalışır; izni olmayan kanalda bildirim gelir.
- [ ] Chrome'da yabancı dilde mesaj → Çevir → dil paketi iner → Türkçe çıktı; Electron'da harici sayfa açılır.

## Dalga 2 durumu

### B1 Seviye / XP `[x]` (kod tamam · test bekliyor)
- Tablolar: `member_levels`, `guild_level_configs` (migration `1762710000000-MemberLevels`).
- Mesaj: 15–25 XP, kişi başı **60 sn cooldown** (atomik SQL, çoklu instance güvenli). Ses: dakika × 4 XP,
  oturum bitince (en fazla 240 dk), AFK kanalı ve "XP yok" kanalları hariç. Bot hariç.
- Eğri: `5n² + 50n + 100` (`levelFromXp` ortak). Seviye atlama → rol ödülleri + SİSTEM bildirimi + `level:up` soketi.
- REST: `GET /guilds/:id/levels/leaderboard|me|members/:userId|config`, `PATCH …/config`, `POST …/config/resync-rewards`.
- UI: web/desktop kanal paneli → **Seviyeler** (lider tablosu + senin seviyen); sunucu ayarları → **Seviyeler**
  (aç/kapa, XP aralığı, ses XP, bildirim, rol ödülleri, XP'siz kanallar, geriye dönük ödül). Mobil: sunucu menüsü → Seviyeler.
- Varsayılan **açık** (yan etkisi yalnız bildirim); sunucu ayarından kapatılabilir.

### A1 Sesli mesaj `[x]` (kod tamam · test bekliyor)
- Ek tipine `voice`, `durationSec`, `waveform` (sunucuda `sanitizeVoiceAttachment` ile sınırlanır). En fazla 5 dk.
- Web/desktop: metin boşken gönder tuşu **mikrofona** dönüşür → kayıt şeridi (süre, seviye, iptal, gönder).
  MediaRecorder (opus/webm; Safari mp4). Oynatıcı: dalga formu, sarma, 1/1,5/2× hız.
- Mobil: expo-audio (m4a), aynı oynatıcı. **Ses kanalındayken mobil kayıt kapalı** (LiveKit ses oturumuyla çakışmasın).
- Düzeltme: `audio/webm` ekler yanlışlıkla video sanılıyordu (`isVideo`).

### A2 Soundboard `[x]` (kod tamam · test bekliyor)
- `guild_sounds` (migration `1762720000000-GuildSounds`). Sunucu başına 24 ses, ≤5,5 sn, ≤512 KB; URL yalnız
  kendi `sounds/<kullanıcı>/` yüklemen olabilir. Yönetim: MANAGE_GUILD.
- Çalma: soket `soundboard:play` (kanalda olmalı, sağır değil, kişi başı 2 sn). Her dinleyici **kendi cihazında**
  çalar (LiveKit'e karışmaz → sunucu yükü yok), kişisel soundboard ses düzeyi, aynı anda en fazla 3.
- UI: web/desktop ses odası kontrol çubuğunda 🎛 düğmesi (çal, ses düzeyi, ekle/sil). Mobil: ses odasında
  ses çipleri (çalma); ekleme web/desktop'tan.

### D1 "Ne kaçırdım?" `[x]` (kod tamam · test bekliyor) — **0 ₺**
- `GET /channels/:id/catchup` — son okumadan (veya açılıştaki okunmamış sayısından) bu yana: bahsetmeler + sana
  yanıtlar, en çok tepki alanlar, sabitlenenler, anketler, bağlantılar, en aktifler. Kural tabanlı, model yok.
- Chrome/Edge'de **Summarizer API** varsa "Yapay zekâ ile özetle (cihazında)" — mesajlar cihazdan çıkmaz.
- UI: kanal başlığında 📝 (15+ okunmamışta vurgulu), mesaja atla. Mobil: kanal başlığı → sayfa.

### Test listesi (Dalga 2)
- [ ] 2 mesaj arka arkaya → yalnız ilki XP; 5. seviyede ödül rolü gelir, bildirim düşer.
- [ ] Seste 3 dk kal, çık → ses dakikası/XP artar; AFK kanalında artmaz.
- [ ] Web'de sesli mesaj kaydet/gönder → mobilde oynat (ve tersi); 1,5× hız.
- [ ] Soundboard'a 3 sn mp3 ekle → kanaldakiler duyar, kanal dışı duymaz, sağır olan duymaz.
- [ ] 20+ okunmamış kanala gir → "Ne kaçırdım?" bahsetme ve öne çıkanları gösterir.

## C1 Oyun platformu + SDK + admin onayı `[x]` (kod tamam · test bekliyor)

**Akış:** herkes oyun oluşturur (taslak) → kendisi + testçiler sunucularda test eder → **incelemeye gönder** →
`admin.dracord.com.tr/games` onaylar / reddeder / askıya alır → onaylı oyun herkesin ses kanalı oyun listesinde.
Onaylı oyunun **adı veya adresi** değişirse otomatik yeniden incelemeye düşer.

- API (`apps/api/src/games`): tablolar `game_apps`, `game_sessions` (migration `1762730000000-GamePlatform`).
  - Geliştirici: `GET /games/mine`, `POST /games`, `PATCH|DELETE /games/:id`, `POST /games/:id/submit|secret|testers`.
  - Oturum: `GET /games/catalog`, `GET /games/sessions`, `POST /games/:id/sessions`, `POST /games/sessions/:sid/join|leave|launch`.
    Ses kanalında olmak zorunlu; ses kanalından çıkan oyuncu oturumdan düşer; son oyuncu çıkınca biter.
  - Oyun sunucusu: `POST /v1/games/verify` (`Authorization: Game <secret>`) → kimlik + oturum. Token 10 dk, oyuna özel `aud`.
  - Admin: `GET /games/admin/list`, `POST /games/admin/:id/review` (platform admin). Karar geliştiriciye bildirim olarak gider.
- `packages/embedded-sdk` (`@dracord/embedded-sdk`, npm'e açık, bağımlılıksız): `ready()`, oturum/token/görünürlük
  olayları, `setStatus` (ses kanalı durumu), `toast`, `openInvite`, `openExternal`, `close`; sunucu yardımcısı `verifyDracordToken`.
- Host: web/desktop ses odası kontrol çubuğunda 🎮 (başlat / katıl), oyun sahneyi kaplayan sandbox iframe
  (`GameFrame`: yalnız oyun origin'i + kendi iframe'i, token yalnız oyun origin'ine). Mobil: ses odasında oyun
  şeridi + tam ekran WebView köprüsü (oyun origin'ine kilitli gezinme).
- Geliştirici portalı: web **Ayarlar → Gelişmiş → Oyunlarım** (oluştur, düzenle, testçiler, gizli anahtar, gönder).
- Admin: **Oyunlar** sayfası (sekmeler, kontrol listesi, sandbox önizleme, onay/red/askı + gerekçe).
- Mintlify: `docs/mintlify/games/*` — genel bakış, hızlı başlangıç, SDK, doğrulama, çok oyunculu (COOMBIE örneği),
  mobil, yayın kuralları. Root `docs/docs.json` nav + `/games/*` yönlendirmeleri. `yarn docs:check` geçiyor.
- [ ] `@dracord/embedded-sdk` npm publish (bot-sdk gibi workflow; NPM_TOKEN ile manuel).
- [ ] OpenAPI'ye `/v1/games/verify` ekle.
- [ ] COOMBIE'ye `connectFromDracord` entegrasyonu (oyun reposunda).

### Test listesi (C1)
- [ ] Ayarlar → Gelişmiş → Oyunlarım → Yeni oyun (`http://localhost:5173`) → anahtar bir kez görünür.
- [ ] Ses kanalı → 🎮 → oyun TEST etiketiyle görünür → başlat → iframe'de `ready()` bağlamı gelir.
- [ ] Testçi olmayan kullanıcı taslak oyuna katılamaz; testçi katılabilir.
- [ ] Oyun sunucusu `verify` ile 200; yanlış anahtar / süresi dolmuş token 401.
- [ ] İncelemeye gönder → admin onay → başka kullanıcının listesinde görünür; ad değişince yeniden incelemede.
- [ ] Mobilde mobil platformlu oyun açılır, "Çık" oturumdan düşürür.

## Kalan işler (2026-11-09 itibarıyla — sıradaki oturumda buradan devam)

Tamamlananlar: Faz 0.1 banner · 0.2 uzak kontrol (Windows) · Dalga 1 (A6, A5, D3) · Dalga 2 (B1, A1, A2, D1) · C1 oyun platformu.
Hepsi **kod tamam, canlıda test bekliyor** — test listeleri yukarıda.

### Öncelik 1 — yarım kalan kenarlar
- [x] Uzak kontrol: **Expo uygulamasında kontrol eden** — mobil artık ekran paylaşımını da gösteriyor (`voice/ScreenShareViewer.tsx`): dokun = tık, uzun bas = sağ tık, sürükle, iki parmak = kaydır, ⌨ klavye, tam ekran. Cihazda test bekliyor.
- [x] Uzak kontrol: **macOS kontrol edilen** (kod tamam, Mac'te test bekliyor; pencere paylaşımı henüz desteklenmiyor).
- [x] Uzak kontrol: paylaşanın fiziksel faresi oynayınca kontrolü geçici durdur.
- [x] Çeviri: Electron/Firefox/Safari'de cihaz üstü — `packages/ui/src/lib/translate-local.ts`: transformers.js 3.8.1 (jsDelivr, npm bağımlılığı yok) + opus-mt, Web Worker; ilk kullanımda boyut gösterip onay ister (→en ~110 MB, →tr ~300 MB ek). Hedef dil: tr/en. Mobil uygulama hâlâ tarayıcıya yönlendirir.
- [x] Soundboard: mobilde ses ekleme — Sunucu menüsü › **Sesler** sekmesi: mikrofondan ≤5 sn kayıt, dinle, sil (dosya seçici native modül ister → OTA'yı bozmamak için kayıt; dosyadan ekleme web/desktop'ta).
- [x] `@dracord/embedded-sdk` npm publish workflow (`.github/workflows/publish-embedded-sdk.yml`, manuel, `NPM_TOKEN` secret) + OpenAPI'ye `/v1/games/verify` (`game` güvenlik şeması, `GameTokenClaims`).
- [~] COOMBIE: Dracord köprüsü + sunucu doğrulaması + oturum başına ortak oda (oyun reposu, `docs/dracord.md`). Kalan: maç ağ kodu (oyun tarafıyla birlikte) ve oyunu portalda kaydet + `DRACORD_GAME_SECRET` (senin hesabınla).

### Öncelik 2 — Faz 3 menüsünün kalanı
- [x] B2 Sunucu istatistik paneli — `GET guilds/:id/stats?days=7|30|90` (MANAGE_GUILD, 5 dk önbellek). Mesajlar mevcut tablodan (geçmiş dahil); katılan/ayrılan + ses dakikası yeni `guild_stats_daily` sayaçlarından (bu sürümden itibaren). Web/desktop: Sunucu ayarları › İstatistikler; mobil: Sunucu menüsü › İstatistik.
- [x] B3 Sunucu tanıtım sayfası + özel adres — `dracord.com.tr/s/<adres>` (SSR, OG önizleme) ve `/invite/<adres>` süresiz davet. Ayar: web Sunucu ayarları › Tanıtım sayfası, desktop ayrı sekme (MANAGE_GUILD). Sayfa yalnız açıkça açılırsa görünür; mesaj göstermez, yalnız kilitsiz/izin kısıtı olmayan metin kanalı adları. Ayrıca: girişsiz davet açılınca girişten sonra davete dönülür; `returnUrl` açık yönlendirme (`//`) kapatıldı.
- [x] B4 Sunucu rozeti + profil vitrini — yönetici rozet etiketi (2–5 harf) + emoji belirler (Tanıtım sayfası bölümü); üye Ayarlar › Profil'de bir sunucu rozetini seçer; profil kartında (web/desktop/mobil) rozet + o sunucudaki seviye görünür. Üyelikten çıkınca / rozet kalkınca otomatik gizlenir. API: `showcase/*`.
- [x] C2 Turnuva modu — tek eleme 1v1 (tavla, bilardo, bowling, kelime, bilgi yarışması, harici oyun). Kayıt → rastgele tohum + otomatik bye → maç hazır bildirimi → iki oyuncu sonucu bildirir (uyuşursa ya da kaybeden kabul ederse biter; uyuşmazsa düzenleyiciye bildirim) → şampiyon bildirimi. Canlı güncelleme `tournament:update`. Web/desktop: sunucu menüsü › Turnuvalar (oluştur/yönet); mobil: Sunucu menüsü › Turnuva (katıl/bildir/yönet, oluşturma yok).
  - [ ] Sonraki: okey (4'lü masa) formatı, maçı doğrudan etkinlikten başlatıp sonucu oyundan otomatik alma, çift eleme / round-robin.
- [x] C3 Haftalık görevler + sezon — her sunucuya her hafta 3 görev (mesaj / ses dakikası / XP; kademe hafta+sunucuya göre belirlenimli), tamamlanınca "Ödülü al" ile bir kez bonus XP (seviye atlatır). Haftalık ve aylık sezon skor tablosu (puan = kazanılan XP + görev ödülü), geçen sezonun ilk üçü. Yeni `member_weekly_stats` + `challenge_claims`; seviye sistemi kapalıysa kapalı. Web/desktop: Seviyeler penceresi; mobil: Seviyeler sekmesi. Sayım bu sürümden itibaren başlar.
- [x] C4 Oyun overlay iyileştirme — konuşan HUD artık sayfayı yeniden yüklemiyor (titreme yok, yerinde güncelleme); konum (4 köşe), aynı anda 1–6 kişi, aç/kapat; kendi mikrofon kapalı / sağır uyarısı; isteğe bağlı CPU/RAM/saat göstergesi. Ayar: Masaüstü › Ayarlar › Overlay › Konuşan HUD.
  - [ ] Oyun FPS'i: Electron'dan ölçülemez; Windows'ta PresentMon (MIT) gibi harici araçla entegrasyon gerekir — ayrı karar.
- [x] A3 Klip kaydı (desktop) — ses kanalında ekran paylaşımı varken kontrol çubuğunda **Klip**: arabelleği açar; "Klibi kaydet" ya da **Ctrl+Shift+K** (oyundayken de) son 30–60 sn'yi `Videolar/Dracord Klipleri` klasörüne .webm olarak yazar. Kendi paylaşımın ya da izlediğin paylaşım (görüntü + paylaşım sesi). İki kademeli MediaRecorder; ek kodlama yok. İzlenen paylaşımda kalite izlediğin kaliteyle aynıdır.
  - [ ] Sonraki: paylaşım yokken doğrudan oyun penceresinden klip, kırpma/paylaşma (kanala yükle).
- [x] A4 Ekran paylaşımına çizim — paylaşımın sol altında kalem: 6 renk, "çizimlerimi sil"; çizgiler herkeste canlı görünür, ~3,5 sn sonra solar (lazer kalem). Yalnız aynı ses kanalındakilere gider (sunucu doğrular, saniyede 40 mesaj sınırı). Desktop'ta paylaşan kişi çizimleri **kendi gerçek ekranında** da görür (şeffaf, tıklanamaz, yakalamaya girmeyen pencere; ekran paylaşımı — pencere paylaşımında yok). Mobil: çizimleri görür (çizim yok).
- [x] A7 Canlı altyazı (cihaz üstü, bütçe 0) — ses kontrol çubuğunda **Altyazı**: "Altyazıları göster" (izleyen) ve "Konuşmamı altyazıla" (konuşan, ayrı onay). Tanıma konuşanın cihazında: Chrome/Edge masaüstünde Web Speech `processLocally` (SODA dil paketi), Electron/Firefox'ta Whisper-base (~80 MB, bir kez, onaylı; transformers.js Worker, basit VAD ile parçalı). Bulut tanıma hiç kullanılmaz; yalnız metin aynı ses kanalına gider, saklanmaz; susturunca durur. Mobil: altyazıları görür.
  - [ ] Sonraki: altyazıyı çeviriyle birleştirme (D3), mobilde kendi konuşmanı altyazılama.
- [x] D2 Otomatik moderasyon (model yok) — sunucu başına: yasaklı kelime/ifade (Türkçe + leet + aralıklı yazım normalize; kelime parçası yanlış pozitifine karşı sınırlı eşleşme) ve düzenli ifade (ReDoS riskli kalıplar reddedilir); spam: hız (10 sn), tekrar (30 sn), etiket, bağlantı, büyük harf, başka sunucu daveti, zalgo; tekrarlayan ihlalde otomatik zaman aşımı; rol/kanal muafiyeti (mesaj yönetenler ve botlar her zaman muaf); "Dene" kutusu; son 500 olay günlüğü. Ayar: Sunucu ayarları › Otomatik moderasyon (web), Moderasyon sekmesi (desktop). Not: hız/tekrar sayaçları API süreç belleğinde (çok örnekte örnek başına).
- [ ] D4 Draco asistan bot (SSS, komutlar; kural tabanlı).
- [ ] E1 Passkey (WebAuthn) · E2 Oturum/cihaz yönetimi · E3 Uçtan uca şifreli DM.

### Öncelik 3 — Faz 1 optimizasyon ve sağlamlık
- [ ] web ↔ desktop-ui kopya hook'ları ortak pakete (`use-remote-control`, ses ayarları); mobil kopyalar
  (`useVoiceChannelStatuses`, `useScheduledMessages`) için RN-güvenli alt paket (`@dracord/ui/core`).
- [ ] E2E smoke: Playwright (web) + Windows desktop — giriş, mesaj, ses, ekran paylaşımı, uzak kontrol, oyun.
- [ ] Performans bütçesi (desktop açılış, web LCP/INP, mobil soğuk açılış) + bundle analizi.
- [ ] Bağlantı dayanıklılığı (uyku, ağ değişimi, mobil arka plan).
- [ ] Erişilebilirlik/kontrast taraması (koyu + açık tema).
- [ ] Repo temizliği: `apps/desktop/_tts-smoke*.js`, `tts-log*.txt`, `sync-test.txt`, kökteki `youtube-cookies.*`.

## Karar bekleyen sorular

1. ~~Faz 0.2 hemen mi?~~ → beklemede. Kaçış kısayolu tercihi başlarken sorulacak.
2. ~~Uzak kontrol kapsamı~~ → önce Windows, sonra mobil kontrol eden + macOS kontrol edilen.
3. ~~İlk dalga~~ → dört grup; sıra yukarıda (onay bekliyor).
4. ~~COOMBIE taşıma~~ → oyunun kendi sunucusu.
5. ~~SDK kapsamı~~ → herkese açık, yayın onayı admin'de.
6. ~~AI bütçesi~~ → 0; cihaz üstü + yedek.

## Değişiklik günlüğü
- 2026-11-08 — Belge oluşturuldu. Keşfet banner kontrastı düzeltildi (web + desktop).
  `.claude/` altına caveman, ui-ux-pro-max ve ECC (seçilmiş) yetenekleri eklendi.
- 2026-11-09 — Kararlar işlendi: ilk dalga 4 grup, COOMBIE kendi sunucusu.
- 2026-11-09 — Her şey yapılacak; AI bütçesi 0 (cihaz üstü); SDK açık + admin onayı. Uzak kontrol (Windows) kodu tamamlandı.
- 2026-11-09 — Dalga 1 (A6 ses durumu, A5 zamanlama, D3 çeviri) kodu tamamlandı; typecheck: api/web/desktop-ui/mobile/ui/sdk temiz.
- 2026-11-09 — Dalga 2 (B1 seviye/XP, A1 sesli mesaj, A2 soundboard, D1 ne kaçırdım) kodu tamamlandı; typecheck temiz.
- 2026-11-09 — C1 oyun platformu: API + embedded SDK + web/desktop/mobil host + geliştirici portalı + admin onay + Mintlify belgeleri.
- 2026-11-09 — Öncelik 1 kapandı: mobil uzak kontrol (kontrol eden + ekran izleme), macOS kontrol edilen, fiziksel fare önceliği, mobil soundboard kaydı, embedded-sdk publish + OpenAPI, Electron/Firefox çevirisi, COOMBIE köprüsü (oyun reposunda).
