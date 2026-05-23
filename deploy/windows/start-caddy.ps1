Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $PSScriptRoot
Set-Location $AppDir

if (-not (Test-Path ".env")) {
  Write-Host "Missing .env. Run start-lingoville.ps1 once and edit .env first."
  exit 1
}

Get-Content ".env" | ForEach-Object {
  if ($_ -match "^\s*#" -or $_ -notmatch "=") { return }
  $name, $value = $_ -split "=", 2
  [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), "Process")
}

$CaddyCommand = Get-Command caddy -ErrorAction SilentlyContinue
if (-not $CaddyCommand -and (Test-Path ".\caddy.exe")) {
  $CaddyCommand = ".\caddy.exe"
}

if (-not $CaddyCommand) {
  Write-Host "Caddy is not installed. Download caddy.exe from https://caddyserver.com/download and put it in PATH or this folder."
  exit 1
}

& $CaddyCommand run --config windows/Caddyfile
