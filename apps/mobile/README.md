# @dracord/mobile

Mobil istemci **bilinçli olarak ertelendi**. Bu klasör yalnızca monorepo ad alanını tutar.

## Neden Expo yok?

`expo` → `node-forge` zinciri monorepo `yarn.lock` üzerinde GitHub Dependabot/advisory
üretiyordu (CVE-2026-85393; npm’de yama sürümü henüz yok, `<=1.4.0` etkileniyor).
Mobil prod’a çıkana kadar Expo bağımlılığı eklenmez.

## Planlanan

- Expo SDK + `@dracord/sdk` / `@dracord/types`
- Google ve Apple ile oturum (Sign in with Apple)

## Şimdilik

`yarn workspace @dracord/mobile dev` bilgilendirme mesajı verir. Web / API / desktop önceliklidir.
