# Anime Blackjack Dealer (VRM)

Kurpiyer karakteri için VRM (tercih) veya GLB modelini buraya koy:

- `anime-dealer.vrm` (önerilen — yüz ifadeleri / humanoid kemikler)
- veya `anime-dealer.glb`

Dosya yoksa oyun otomatik olarak prosedürel (basit) kurpiyere düşer.

## Model önerileri

- [VRoid Studio](https://vroid.com/) ile kendi anime karakterini üret → VRM export
- [VRoid Hub](https://hub.vroid.com/) / [BOOTH](https://booth.pm/) — **ticari / yeniden dağıtım** lisansını kontrol et

## Konsept

Yetişkin görünümlü, platin / sarı saçlı, casino üniforması (siyah–bordo, altın detay), hafif dekolte. Masa arkasında belden yukarı görünür.

## Kalibrasyon

Model yüklendikten sonra konum / ölçek `BlackjackGame.tsx` ve `createDealerWoman.ts` içinden ayarlanır:

- `root.position` — masa arkası (`z ≈ -2.75`)
- `root.scale` — boy
- `root.rotation.y` — oyuncuya bakış yönü
