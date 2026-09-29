# Zero-downtime rolling deploy for api/web/admin (Docker Compose + PowerShell).
# Caddy health checks drain unhealthy upstreams while replicas stay up.
param(
  [string[]]$Services = @('api', 'web', 'admin'),
  [int]$Replicas = $(if ($env:DRACORD_REPLICAS) { [int]$env:DRACORD_REPLICAS } else { 2 })
)

$ErrorActionPreference = 'Stop'
$DockerDir = $PSScriptRoot
$Root = Split-Path $DockerDir -Parent
$ComposeFile = Join-Path $DockerDir 'docker-compose.yml'
$ZdFile = Join-Path $DockerDir 'docker-compose.zd.yml'
$EnvFile = Join-Path $Root '.env'

function Invoke-Compose([string[]]$ComposeArgs) {
  & docker compose -f $ComposeFile -f $ZdFile --env-file $EnvFile @ComposeArgs
  if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $($ComposeArgs -join ' ')" }
}

Write-Host "==> Building: $($Services -join ', ')"
Invoke-Compose (@('build') + $Services)

foreach ($svc in $Services) {
  Write-Host "==> Rolling $svc (replicas=$Replicas)"
  try {
    Invoke-Compose @('up', '-d', '--scale', "$svc=$Replicas", '--no-recreate', $svc)
  } catch {
    Invoke-Compose @('up', '-d', '--scale', "$svc=$Replicas", $svc)
  }

  $ids = @(& docker compose -f $ComposeFile -f $ZdFile --env-file $EnvFile ps -q $svc | Where-Object { $_ })
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
      $psOut = & docker compose -f $ComposeFile -f $ZdFile --env-file $EnvFile ps $svc 2>&1 | Out-String
      $running = @(& docker compose -f $ComposeFile -f $ZdFile --env-file $EnvFile ps -q $svc).Count
      $healthy = ([regex]::Matches($psOut, '\(healthy\)')).Count
      if ($running -ge $Replicas -and $healthy -ge 1) { break }
      Start-Sleep -Seconds 2
    }
  }

  Write-Host "==> $svc roll complete"
}

Write-Host 'Done.'
