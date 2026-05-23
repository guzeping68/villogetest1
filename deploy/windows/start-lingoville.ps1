Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $PSScriptRoot
Set-Location $AppDir

if (-not (Test-Path ".env")) {
  Copy-Item "env.server.example" ".env"
  Write-Host "Created .env from env.server.example. Edit .env first, then run this script again."
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js is not installed. Install Node.js LTS from https://nodejs.org/ first."
  exit 1
}

if (-not (Test-Path "node_modules")) {
  npm ci --omit=dev
}

node server-dist/server.cjs
