param([ValidateSet('codex','claude')][string]$Client='codex')
$ErrorActionPreference='Stop'
$Version='0.2.0'
$Base='https://mc4need.david-widgets.com'
$Root=Join-Path $env:LOCALAPPDATA 'Mc4Need'
$Temp=Join-Path ([IO.Path]::GetTempPath()) ('mc4need-'+[guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $Temp | Out-Null
try {
  $Node=(Get-Command node -ErrorAction SilentlyContinue).Source
  if (!$Node -or (& $Node -p 'Number(process.versions.node.split(".")[0])') -lt 22) {
    $Arch=if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {'arm64'} else {'x64'}
    $NodeVersion='v24.16.0'
    $Archive="node-$NodeVersion-win-$Arch.zip"
    Invoke-WebRequest "https://nodejs.org/dist/$NodeVersion/$Archive" -OutFile "$Temp\node.zip"
    Invoke-WebRequest "https://nodejs.org/dist/$NodeVersion/SHASUMS256.txt" -OutFile "$Temp\node-sha.txt"
    $Expected=((Get-Content "$Temp\node-sha.txt" | Where-Object { $_ -match "  $([regex]::Escape($Archive))$" }) -split '\s+')[0]
    if (!$Expected -or (Get-FileHash "$Temp\node.zip" -Algorithm SHA256).Hash.ToLower() -ne $Expected) {throw 'Node checksum mismatch'}
    Expand-Archive "$Temp\node.zip" "$Temp\node"
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    $Runtime=Join-Path $Root 'runtime'
    if (Test-Path $Runtime) {Remove-Item -Recurse -Force $Runtime}
    Move-Item "$Temp\node\node-$NodeVersion-win-$Arch" $Runtime
    $Node=Join-Path $Runtime 'node.exe'
  }
  Invoke-WebRequest "$Base/releases/mc4need-$Version.zip" -OutFile "$Temp\package.zip"
  Invoke-WebRequest "$Base/releases/SHA256SUMS-$Version" -OutFile "$Temp\SHA256SUMS"
  $Expected=((Get-Content "$Temp\SHA256SUMS" | Where-Object { $_ -match "  mc4need-$([regex]::Escape($Version)).zip$" }) -split '\s+')[0]
  if (!$Expected -or (Get-FileHash "$Temp\package.zip" -Algorithm SHA256).Hash.ToLower() -ne $Expected) {throw 'Mc4Need checksum mismatch'}
  Expand-Archive "$Temp\package.zip" "$Temp\package"
  $Current=Join-Path $Root 'current'
  if (Test-Path $Current) {Remove-Item -Recurse -Force $Current}
  New-Item -ItemType Directory -Force -Path "$Root\bin" | Out-Null
  Move-Item "$Temp\package\mc4need" $Current
  & $Node "$Current\scripts\register.mjs" $Client
  if ($LASTEXITCODE -ne 0) {throw 'Skill registration failed'}
  "@echo off`r`n`"$Node`" `"$Current\cli\mc4need.mjs`" %*" | Set-Content "$Root\bin\mc4need.cmd" -Encoding ASCII
  & "$Root\bin\mc4need.cmd" --version
  Write-Host "Installed: $Root\bin\mc4need.cmd. Reload your AI client to discover the skill."
  Write-Host 'Your existing McDonald’s MCP settings were not changed.'
} finally {Remove-Item -Recurse -Force $Temp -ErrorAction SilentlyContinue}
