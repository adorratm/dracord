# @dracord/desktop-ui

Electron için **tam native** React UI (Vite). WebView / uzak site yok.

Web ile aynı görsel kabuk: **`@dracord/ui`** + Tailwind tasarım tokenları (TitleBar, ServerRail, ChannelSidebar, MessageList, ChatInput, MemberList, FriendsHub, VoiceStage, SettingsShell, QuickSwitcher).

- `@dracord/sdk` — API + socket  
- `@dracord/game-core` — oyun kuralları  
- Three.js — aktivite sahneleri  
- LiveKit — ses / DM call / ekran paylaşımı  

## Özellikler (web UI parity)

TitleBar + NotificationBell, ServerRail (sağ tık), ChannelSidebar + UserPanel, MessageList/ChatInput (emoji/GIF/mention), MemberList, FriendsHub, VoiceStage, Ctrl+K QuickSwitcher, SettingsShell, keşfet / guild ayarları.

Parity matrisi: [`docs/native-parity-checklist.md`](../../docs/native-parity-checklist.md).

```bash
yarn workspace @dracord/desktop-ui dev    # :5173
yarn workspace @dracord/desktop-ui build
```

`VITE_API_URL` — API tabanı (varsayılan `https://api.dracord.com.tr`).
