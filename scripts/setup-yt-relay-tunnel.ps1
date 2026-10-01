# Sabit Cloudflare Tunnel — trycloudflare URL her seferinde DEGİSMEZ.
# Bir kez kur: YTDLP_RELAY_URL=.env'e yazilir, bir daha dokunmazsin.
#
# Gereksinim: cloudflared + Cloudflare hesabi + dracord.com.tr (veya baska) zone
#   winget install Cloudflare.cloudflared
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup-yt-relay-tunnel.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\setup-yt-relay-tunnel.ps1 -Hostname yt-relay.dracord.com.tr
param(
  [string]$TunnelName = 'dracord-yt-relay',
  [string]$Hostname = 'yt-relay.dracord.com.tr',
  [int]$Port = 8791
)

$ErrorActionPreference = 'Stop'
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
  [System.Environment]::GetEnvironmentVariable('Path', 'User')

$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Error 'cloudflared yok. Kur: winget install Cloudflare.cloudflared'
  exit 1
}

Write-Host @"

==> Cloudflare'e login (tarayici acilir, bir kez)
"@
cloudflared tunnel login

Write-Host "`n==> Tunnel olustur / var olani kullan: $TunnelName"
$existing = cloudflared tunnel list 2>$null | Select-String -Pattern $TunnelName
if (-not $existing) {
  cloudflared tunnel create $TunnelName
}

$tunnelId = (cloudflared tunnel list --output json | ConvertFrom-Json |
  Where-Object { $_.name -eq $TunnelName } |
  Select-Object -First 1 -ExpandProperty id)
if (-not $tunnelId) {
  Write-Error "Tunnel id bulunamadi ($TunnelName). cloudflared tunnel list kontrol et."
  exit 1
}

$cred = Join-Path $env:USERPROFILE ".cloudflared\$tunnelId.json"
if (-not (Test-Path $cred)) {
  Write-Error "Credentials yok: $cred — tunnel create basarisiz olabilir."
  exit 1
}

$configDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'docker\data'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
$configPath = Join-Path $configDir 'cloudflared-yt-relay.yml'

@"
tunnel: $tunnelId
credentials-file: $cred

ingress:
  - hostname: $Hostname
    service: http://127.0.0.1:$Port
  - service: http_status:404
"@ | Set-Content -Path $configPath -Encoding utf8

Write-Host "`n==> DNS CNAME: $Hostname → $tunnelId.cfargotunnel.com"
cloudflared tunnel route dns $TunnelName $Hostname

Write-Host @"

Hazir. Sunucu .env (BIR KEZ):
  YTDLP_RELAY_URL=https://$Hostname
  YTDLP_RELAY_SECRET=<start-yt-relay.ps1'in yazdigi secret>

Sonra music-bot bir kez recreate — bir daha URL/build yok.

Her gun PC acilinca sadece:
  1) scripts\start-yt-relay.ps1
  2) cloudflared tunnel --config `"$configPath`" run

Kalici (Windows servis, reboot sonrasi otomatik):
  cloudflared service install
  (config'i once %USERPROFILE%\.cloudflared\config.yml olarak kopyala)

Config: $configPath
"@
