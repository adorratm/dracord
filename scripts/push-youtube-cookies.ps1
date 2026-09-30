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

@'
#!/usr/bin/env bash
set -euo pipefail
ENVF=/opt/dracord/.env
LINE_FILE=/tmp/dracord-cookies.b64.line
LINE=$(cat "$LINE_FILE")
grep -v '^YTDLP_COOKIES_B64=' "$ENVF" > "$ENVF.tmp" || true
printf '%s\n' "$LINE" >> "$ENVF.tmp"
mv "$ENVF.tmp" "$ENVF"
grep -q '^YTDLP_EXTRACTOR_ARGS=' "$ENVF" || echo 'YTDLP_EXTRACTOR_ARGS=youtube:player_client=android_vr,android' >> "$ENVF"
grep -q '^YTDLP_IMPERSONATE=' "$ENVF" || echo 'YTDLP_IMPERSONATE=1' >> "$ENVF"
rm -f "$LINE_FILE"
cd /opt/dracord
docker compose -f docker/docker-compose.yml -f docker/docker-compose.zd.yml -f docker/docker-compose.prod.yml --env-file .env \
  up -d --build --force-recreate --no-deps music-bot
docker compose -f docker/docker-compose.yml -f docker/docker-compose.zd.yml -f docker/docker-compose.prod.yml --env-file .env \
  logs --tail=40 music-bot
'@ | Set-Content -Path $shFile -Encoding ascii

Write-Host "==> scp → $SshTarget"
scp $lineFile "${SshTarget}:/tmp/dracord-cookies.b64.line"
scp $shFile "${SshTarget}:/tmp/dracord-apply-cookies.sh"
ssh $SshTarget 'bash /tmp/dracord-apply-cookies.sh; rm -f /tmp/dracord-apply-cookies.sh'
Write-Host 'OK — logda "YouTube cookies: loaded" ara.'
