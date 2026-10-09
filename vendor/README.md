# Vendored security backports

Upstream has not published fixed npm releases yet. These folders pin patched sources so Dependabot/GHSA clear and runtime is safe.

| Package | Advisory | Upstream PR | Local version |
|---------|----------|-------------|---------------|
| `braces` | CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm | micromatch/braces#72 | 3.0.4 |
| `http-cache-semantics` | CVE-2026-93748 / GHSA-ch52-4w7c-c8xp | kornelski/http-cache-semantics#60 | 4.2.1 |
| `sprintf-js` | CVE-2026-97058 | alexei/sprintf.js#237 (no release) | 1.1.4 |

Root `package.json` resolutions point here via Yarn `portal:`. Also pinned via resolutions (npm): `source-map-js@1.2.2`, `postcss@8.5.29`, `postcss-selector-parser@7.1.6`. When official fixed releases ship, delete the vendor folder / drop the pins.
