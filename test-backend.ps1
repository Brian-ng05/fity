$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = '1'
$env:TEMP = Join-Path $PSScriptRoot '.cache\tmp'
$env:TMP = $env:TEMP
$env:MPLCONFIGDIR = Join-Path $PSScriptRoot '.cache\matplotlib'
New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null
$python = Join-Path $PSScriptRoot 'backend\.venv\Scripts\python.exe'
$backend = Join-Path $PSScriptRoot 'backend'
$process = Start-Process -FilePath $python -ArgumentList @('-m', 'pytest', 'tests', '-q') -WorkingDirectory $backend -NoNewWindow -Wait -PassThru
exit $process.ExitCode
