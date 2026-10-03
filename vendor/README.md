# Vendored security backports

Upstream has not published fixed npm releases yet. These folders pin patched sources so Dependabot/GHSA clear and runtime is safe.

| Package | Advisory | Upstream PR | Local version |
|---------|----------|-------------|---------------|
| `braces` | CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm | micromatch/braces#72 | 3.0.4 |
| `http-cache-semantics` | CVE-2026-93748 / GHSA-ch52-4w7c-c8xp | kornelski/http-cache-semantics#60 | 4.2.1 |

Root `package.json` resolutions point here via Yarn `portal:`. When official `braces@>=3.0.4` and `http-cache-semantics@>4.2.0` ship on npm, delete this folder and drop the resolutions.
