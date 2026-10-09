$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$cachePath = Join-Path $PSScriptRoot '.cache'
New-Item -ItemType Directory -Force -Path $cachePath,(Join-Path $cachePath 'tmp'),'.runtime','backend\models','backend\data','frontend\public' | Out-Null
$env:TEMP = Join-Path $cachePath 'tmp'
$env:TMP = $env:TEMP
$env:PIP_CACHE_DIR = Join-Path $cachePath 'pip'
$env:npm_config_cache = Join-Path $cachePath 'npm'
$env:NEXT_TELEMETRY_DISABLED = '1'
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { throw 'Install Node.js 20.9+ before running setup.' }
$python = Join-Path $PSScriptRoot '.runtime\python\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    Write-Host 'Downloading project-local Python 3.11.17...'
    $archive = Join-Path $cachePath 'python.tar.gz'
    Invoke-WebRequest -Uri 'https://github.com/astral-sh/python-build-standalone/releases/download/20261003/cpython-3.11.17%2B20261003-x86_64-pc-windows-msvc-install_only_stripped.tar.gz' -OutFile $archive
    tar.exe -xzf $archive -C (Join-Path $PSScriptRoot '.runtime')
    if ($LASTEXITCODE -ne 0) { throw 'Python extraction failed.' }
}
$venvPython = Join-Path $PSScriptRoot 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $venvPython)) {
    & $python -m venv (Join-Path $PSScriptRoot 'backend\.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Virtual environment creation failed.' }
}
& $venvPython -m ensurepip --upgrade
if ($LASTEXITCODE -ne 0) { throw 'pip setup failed.' }
$requirements = if (Test-Path 'backend\requirements.lock.txt') { 'backend\requirements.lock.txt' } else { 'backend\requirements.txt' }
& $venvPython -m pip install -r $requirements
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
$posePath = Join-Path $PSScriptRoot 'backend\models\pose_landmarker_full.task'
if (-not (Test-Path -LiteralPath $posePath)) {
    Invoke-WebRequest -Uri 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task' -OutFile $posePath
}
$templatePath = Join-Path $PSScriptRoot 'backend\models\body-template.obj'
if (-not (Test-Path -LiteralPath $templatePath)) {
    Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj' -OutFile $templatePath
}
& $venvPython 'backend\scripts\prepare_assets.py'
if ($LASTEXITCODE -ne 0) { throw 'Asset preparation failed.' }
Push-Location frontend
try {
    if (Test-Path 'package-lock.json') { npm.cmd ci --no-fund --no-audit } else { npm.cmd install --no-fund --no-audit }
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
} finally { Pop-Location }
Write-Host 'Setup complete. Run start-backend.ps1 and start-frontend.ps1 in two terminals.' -ForegroundColor Green
