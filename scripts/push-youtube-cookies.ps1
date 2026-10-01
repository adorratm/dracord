# Cookie satırını sunucu .env'e yazar ve music-bot'u recreate eder.
#   $env:DRACORD_SSH = "root@SUNUCU_IP"
#   powershell -ExecutionPolicy Bypass -File scripts/push-youtube-cookies.ps1
param(
  [string]$SshTarget = $env:DRACORD_SSH,
  [string]$B64File = (Join-Path (Split-Path $PSScriptRoot -Parent) 'youtube-cookies.b64.env')
)

if (-not $SshTarget) {
  Write-Host @'
SSH hedefi gerekli:
  $env:DRACORD_SSH = "root@123.45.67.89"
  powershell -ExecutionPolicy Bypass -File scripts/push-youtube-cookies.ps1

Manuel:
  1) youtube-cookies.b64.env satırını kopyala
  2) sunucuda: nano /opt/dracord/.env  (YTDLP_COOKIES_B64=... yapıştır)
  3) music-bot recreate
'@
  exit 1
}

if (-not (Test-Path $B64File)) {
  Write-Error 'Önce: powershell -File scripts/encode-youtube-cookies.ps1'
  exit 1
}

$line = (Get-Content $B64File -Raw).Trim()
if ($line -notmatch '^YTDLP_COOKIES_B64=') { Write-Error 'Geçersiz b64'; exit 1 }

$tmpDir = Join-Path $env:TEMP 'dracord-cookie-push'
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
$lineFile = Join-Path $tmpDir 'cookies.b64.line'
$shFile = Join-Path $tmpDir 'apply-cookies.sh'
Set-Content -Path $lineFile -Value $line -Encoding ascii -NoNewline

# LF-only bash (CRLF → "no such service: music-bot")
$bash = @'
#!/usr/bin/env bash
set -euo pipefail
ENVF=/opt/dracord/.env
LINE_FILE=/tmp/dracord-cookies.b64.line
LINE=$(cat "$LINE_FILE")
# .env B64
grep -v '^YTDLP_COOKIES_B64=' "$ENVF" > "$ENVF.tmp" || true
printf '%s\n' "$LINE" >> "$ENVF.tmp"
mv "$ENVF.tmp" "$ENVF"
# Cookie varken android extractor bot duvarını tetikler — zorla tv/web_embedded
grep -v '^YTDLP_EXTRACTOR_ARGS=' "$ENVF" > "$ENVF.tmp" || true
echo 'YTDLP_EXTRACTOR_ARGS=youtube:player_client=tv,web_embedded' >> "$ENVF.tmp"
mv "$ENVF.tmp" "$ENVF"
grep -q '^YTDLP_IMPERSONATE=' "$ENVF" || echo 'YTDLP_IMPERSONATE=1' >> "$ENVF"
# Mount edilen dosyayı da güncelle (eski stub B64'ü ezmesin)
mkdir -p /opt/dracord/secrets
python3 - <<'PY'
import base64, os, re
env = open("/opt/dracord/.env", encoding="utf-8", errors="ignore").read()
m = re.search(r"^YTDLP_COOKIES_B64=(.+)$", env, re.M)
if not m:
    raise SystemExit("no B64 in .env")
raw = base64.b64decode(m.group(1).strip())
path = "/opt/dracord/secrets/youtube-cookies.txt"
open(path, "wb").write(raw)
os.chmod(path, 0o600)
print(f"wrote {path} bytes={len(raw)}")
PY
rm -f "$LINE_FILE"
cd /opt/dracord
COMPOSE=(docker compose
  -f docker/docker-compose.yml
  -f docker/docker-compose.zd.yml
  -f docker/docker-compose.prod.yml
  --env-file .env)
"${COMPOSE[@]}" up -d --build --force-recreate --no-deps music-bot
# compose logs bazen proje/service eşleşmez — container id ile al
cid=$("${COMPOSE[@]}" ps -q music-bot || true)
if [[ -z "${cid}" ]]; then
  cid=$(docker ps -qf name=music-bot | head -n1 || true)
fi
if [[ -n "${cid}" ]]; then
  docker logs --tail=50 "$cid"
else
  echo "UYARI: music-bot container bulunamadı" >&2
  docker ps --format '{{.Names}}' | grep -i music || true
fi
'@

[System.IO.File]::WriteAllText($shFile, ($bash -replace "`r`n", "`n" -replace "`r", "`n"))

Write-Host "==> scp → $SshTarget"
scp $lineFile "${SshTarget}:/tmp/dracord-cookies.b64.line"
scp $shFile "${SshTarget}:/tmp/dracord-apply-cookies.sh"
ssh $SshTarget 'bash /tmp/dracord-apply-cookies.sh; rm -f /tmp/dracord-apply-cookies.sh'
Write-Host 'OK — logda "YouTube cookies: loaded" ara.'
