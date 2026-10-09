$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'backend')
$python = Join-Path $PSScriptRoot 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Run setup.ps1 first.' }
$tempPath = Join-Path $PSScriptRoot '.cache\tmp'
New-Item -ItemType Directory -Force -Path $tempPath | Out-Null
$env:TEMP = $tempPath
$env:TMP = $tempPath
$env:MPLCONFIGDIR = Join-Path $PSScriptRoot '.cache\matplotlib'
& $python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
exit $LASTEXITCODE
