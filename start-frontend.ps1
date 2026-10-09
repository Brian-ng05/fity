$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'frontend')
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:npm_config_cache = Join-Path $PSScriptRoot '.cache\npm'
npm.cmd run dev
exit $LASTEXITCODE
