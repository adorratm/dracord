# Ev PC YouTube resolve relay (Hetzner bot duvarini asmak icin)
#   powershell -ExecutionPolicy Bypass -File scripts/start-yt-relay.ps1
param(
  [int]$Port = 8791,
  [string]$Secret = $env:YTDLP_RELAY_SECRET,
  [string]$Cookies = (Join-Path (Split-Path $PSScriptRoot -Parent) 'youtube-cookies.txt')
)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# winget sonrasi ayni shell PATH guncellenmemis olabilir
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
  [System.Environment]::GetEnvironmentVariable('Path', 'User')

function Find-YtDlp {
  $cmd = Get-Command yt-dlp -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $winget = Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Filter 'yt-dlp.exe' -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
  if ($winget) { return $winget }
  return $null
}

if (-not $Secret) {
  $Secret = -join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
  Write-Host "YTDLP_RELAY_SECRET=$Secret"
  Write-Host 'Bunu sunucu .env dosyasina yapistir'
}

$ytDlp = Find-YtDlp
if (-not $ytDlp) {
  Write-Host 'yt-dlp bulunamadi. Kur: winget install yt-dlp.yt-dlp'
  exit 1
}
$env:YTDLP_PATH = $ytDlp

$env:YTDLP_RELAY_PORT = "$Port"
$env:YTDLP_RELAY_SECRET = $Secret
if (Test-Path -LiteralPath $Cookies) {
  $env:YTDLP_COOKIES_FILE = $Cookies
} else {
  Remove-Item Env:YTDLP_COOKIES_FILE -ErrorAction SilentlyContinue
}
$env:YTDLP_IMPERSONATE = '1'

$namedConfig = Join-Path $root 'docker\data\cloudflared-yt-relay.yml'
Write-Host "yt-dlp: $ytDlp"
Write-Host "Relay :$Port"
Write-Host "YTDLP_RELAY_SECRET=$Secret"
if (Test-Path -LiteralPath $namedConfig) {
  Write-Host "Sabit tunnel config bulundu — diger terminal:"
  Write-Host "  cloudflared tunnel --config `"$namedConfig`" run"
  Write-Host "Sunucu .env YTDLP_RELAY_URL bir kez ayarli kalsin (setup-yt-relay-tunnel.ps1)."
} else {
  Write-Host "Gecici URL (her acilista degisir) — sabit icin: scripts\setup-yt-relay-tunnel.ps1"
  Write-Host "  cloudflared tunnel --url http://127.0.0.1:$Port"
  Write-Host "Sunucu .env:"
  Write-Host "  YTDLP_RELAY_URL=https://....trycloudflare.com"
}
node (Join-Path $PSScriptRoot 'yt-resolve-relay.mjs')
