# EAS kurulum (bir kez)

```bash
cd apps/mobile
npx eas-cli login
npx eas init
```

`eas init` `app.json` → `extra.eas.projectId` ve `updates.url` yazar. Sonra:

```json
"updates": { "enabled": true, "url": "https://u.expo.dev/<projectId>" }
```

Production API zaten `eas.json` → `production.env.EXPO_PUBLIC_API_URL`.

Apple: Developer’da App ID’de **Sign In with Apple** capability; API’de `APPLE_CLIENT_ID` (bundle id veya Services ID).
