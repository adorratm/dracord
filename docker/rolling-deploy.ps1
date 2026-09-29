# Zero-downtime rolling deploy for api/web/admin (Docker Compose + PowerShell).
param(
  [string[]]$Services = @('api', 'web', 'admin'),
  [int]$Replicas = $(if ($env:DRACORD_REPLICAS) { [int]$env:DRACORD_REPLICAS } else { 2 }),
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$env:DOCKER_BUILDKIT = if ($env:DOCKER_BUILDKIT) { $env:DOCKER_BUILDKIT } else { '1' }
$env:COMPOSE_DOCKER_CLI_BUILD = if ($env:COMPOSE_DOCKER_CLI_BUILD) { $env:COMPOSE_DOCKER_CLI_BUILD } else { '1' }
$DockerDir = $PSScriptRoot
$Root = Split-Path $DockerDir -Parent
$ComposeFile = Join-Path $DockerDir 'docker-compose.yml'
$ZdFile = Join-Path $DockerDir 'docker-compose.zd.yml'
$ProdFile = Join-Path $DockerDir 'docker-compose.prod.yml'
$EnvFile = Join-Path $Root '.env'

$useProd = $env:DRACORD_COMPOSE_PROD
if ([string]::IsNullOrEmpty($useProd)) {
  $useProd = if (Test-Path $ProdFile) { '1' } else { '0' }
}

$composeArgs = @('-f', $ComposeFile, '-f', $ZdFile)
if ($useProd -eq '1') { $composeArgs += @('-f', $ProdFile) }
$composeArgs += @('--env-file', $EnvFile)

function Invoke-Compose([string[]]$ComposeArgs) {
  & docker compose @composeArgs @ComposeArgs
  if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $($ComposeArgs -join ' ')" }
}

Write-Host "==> Compose: $($composeArgs -join ' ')"
if (-not $SkipBuild -and $env:DRACORD_SKIP_BUILD -ne '1') {
  Write-Host "==> Building: $($Services -join ', ')"
  Invoke-Compose (@('build') + $Services)
}

foreach ($svc in $Services) {
  Write-Host "==> Rolling $svc (replicas=$Replicas)"
  try {
    Invoke-Compose @('up', '-d', '--scale', "$svc=$Replicas", '--no-recreate', $svc)
  } catch {
    Invoke-Compose @('up', '-d', '--scale', "$svc=$Replicas", $svc)
  }

  $ids = @(& docker compose @composeArgs ps -q $svc | Where-Object { $_ })
  if ($ids.Count -lt 2) {
    Write-Host "!! $svc has fewer than 2 containers; brief interruption possible."
  }

  foreach ($id in $ids) {
    $short = $id.Substring(0, [Math]::Min(12, $id.Length))
    Write-Host "--> Recreating $svc container $short"
    & docker stop -t 25 $id | Out-Null
    & docker rm $id | Out-Null
    Invoke-Compose @('up', '-d', '--scale', "$svc=$Replicas", '--no-recreate', $svc)

    for ($i = 0; $i -lt 60; $i++) {
      $psOut = & docker compose @composeArgs ps $svc 2>&1 | Out-String
      $running = @(& docker compose @composeArgs ps -q $svc).Count
      $healthy = ([regex]::Matches($psOut, '\(healthy\)')).Count
      if ($running -ge $Replicas -and $healthy -ge 1) { break }
      Start-Sleep -Seconds 2
    }
  }

  Write-Host "==> $svc roll complete"
}

if ($env:DRACORD_ROLL_MUSIC_BOT -ne '0') {
  Write-Host '==> Recreating music-bot'
  try { Invoke-Compose @('up', '-d', '--build', '--force-recreate', '--no-deps', 'music-bot') } catch { }
}

Write-Host 'Done.'
