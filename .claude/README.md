# Dracord — Claude Code yetenekleri (skills / agents / rules)

Proje kapsamlı (project scope) kurulum. Claude Code bu klasörü repoda otomatik okur;
global `~/.claude` ayarlarına dokunulmadı. Hook ve MCP **kurulmadı** (bilinçli: canlı akışı
etkilemesin). Kaynak commit'leri: `vendor-licenses/SOURCES.txt`.

## 1. caveman — kısa/az token çalışma modu (22 skill, Apache-2.0)
Kaynak: github.com/JuliusBrussee/caveman · `skills/`

| Skill | Ne zaman |
| --- | --- |
| `caveman`, `ultracave`, `megacave` | `/caveman` ile kısa cevap modu; "normal mode" ile kapanır |
| `caveman-review`, `caveman-evidence-review` | Kısa, kanıtlı kod incelemesi |
| `caveman-commit` | Kısa conventional commit mesajı |
| `caveman-explore`, `caveman-discover`, `investigate-first` | Değiştirmeden önce kodu keşfet |
| `surgical-patch`, `safe-refactor`, `lean-build`, `migration` | Minimum dokunuşla değişiklik |
| `verify-and-stop` | Doğrula, kanıt yoksa "bitti" deme |
| `cavecrew` | Çok ajanlı kısa görev dağıtımı |
| `caveman-compress/optimize/stats/learn/manage/setup/help` | Bağlam sıkıştırma ve mod yönetimi |

`vendor/caveman-build/` — caveman'in derleme yardımcıları (skill değil, referans için).

## 2. ui-ux-pro-max — UI/UX tasarım zekâsı (7 skill, MIT)
Kaynak: github.com/nextlevelbuilder/ui-ux-pro-max-skill · `.claude/skills/`

`ui-ux-pro-max` (stil/palet/tipografi/UX kuralları, arama scriptleri), `design`, `design-system`,
`ui-styling`, `brand`, `banner-design`, `slides`.
Scriptler Python 3 ister (`python scripts/search.py ...`). Dracula paletiyle çalışırken
kontrast (WCAG 4.5:1) kuralını özellikle kullan — Keşfet banner hatası bu tipti.

## 3. ECC — mühendislik yetenekleri (seçilmiş alt küme, MIT)
Kaynak: github.com/affaan-m/ECC — 314 skill'in tamamı yerine Dracord yığınına uyan **37 skill**,
**17 agent** ve **rules** alındı (NestJS · Next.js · Vite/Electron · Expo · Postgres · Redis · Docker).

- Skills: `nestjs-patterns`, `nextjs-turbopack`, `vite-patterns`, `react-patterns`, `react-performance`,
  `react-testing`, `react-native-patterns`, `typescript-patterns`, `postgres-patterns`, `redis-patterns`,
  `database-migrations`, `api-design`, `backend-patterns`, `frontend-patterns`, `error-handling`,
  `latency-critical-systems`, `docker-patterns`, `deployment-patterns`, `security-review`, `security-scan`,
  `e2e-testing`, `browser-qa`, `windows-desktop-e2e`, `tdd-workflow`, `verification-loop`,
  `accessibility`, `frontend-a11y`, `make-interfaces-feel-better`, `motion-foundations`, `motion-patterns`,
  `i18n-sync`, `codebase-onboarding`, `change-impact`, `production-audit`, `git-workflow`,
  `search-first`, `coding-standards`
- Agents (`agents/`): architect, planner, code-explorer, code-reviewer, typescript-reviewer,
  react-reviewer, security-reviewer, database-reviewer, performance-optimizer, e2e-runner,
  build-error-resolver, react-build-resolver, silent-failure-hunter, refactor-cleaner,
  a11y-architect, doc-updater, tdd-guide
- Rules (`rules/ecc/`): common, typescript, web, react, react-native.
  `hooks.md` dosyaları ECC hook'larını anlatır; hook kurulu olmadığı için bilgi amaçlıdır.

ECC'nin tamamını (hook'lar, sürekli öğrenme, AgentShield) istersen resmi yol:
`npx ecc-universal@2.2.3 setup` → scope olarak **project** seç. Bu kurulumla üst üste bindirme;
önce bu klasördeki ECC kopyalarını kaldır.

## Güncelleme
Kaynak repoları yeniden klonla, aynı klasörleri üzerine kopyala, `SOURCES.txt`'i güncelle.
