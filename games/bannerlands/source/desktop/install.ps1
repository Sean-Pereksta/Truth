param([string]$PayloadPath=(Join-Path $PSScriptRoot 'payload.zip'),[string]$Destination=(Join-Path $env:LOCALAPPDATA 'Programs\Bannerlands'),[string]$DesktopDirectory=[Environment]::GetFolderPath('Desktop'),[string]$StartMenuDirectory=(Join-Path ([Environment]::GetFolderPath('Programs')) 'Bannerlands'),[switch]$NoRegistry,[switch]$Quiet)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$installationPath=[IO.Path]::GetFullPath($Destination)
if([IO.Path]::GetPathRoot($installationPath).TrimEnd('\') -eq $installationPath.TrimEnd('\')) {throw 'The installation location cannot be a drive root.'}
$stagingParent=[IO.Path]::GetDirectoryName($installationPath)
$stagingPath=Join-Path $stagingParent ('.bl-setup-'+[Guid]::NewGuid().ToString('N').Substring(0,12))
New-Item -ItemType Directory -Force -Path $stagingPath | Out-Null
try {
  [IO.Compression.ZipFile]::ExtractToDirectory($PayloadPath,$stagingPath)
  $packagePath=Join-Path $stagingPath 'Bannerlands'
  $manifest=Get-Content -LiteralPath (Join-Path $packagePath 'build-manifest.json') -Raw | ConvertFrom-Json
  foreach($file in $manifest.files) {
    $verifiedPath=[IO.Path]::GetFullPath((Join-Path $packagePath $file.path))
    if(-not $verifiedPath.StartsWith($packagePath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) {throw 'Invalid file in installation manifest.'}
    $hashAlgorithm=[Security.Cryptography.SHA256]::Create()
    $fileStream=[IO.File]::OpenRead($verifiedPath)
    try {$actualHash=([BitConverter]::ToString($hashAlgorithm.ComputeHash($fileStream))).Replace('-','').ToLowerInvariant()} finally {$fileStream.Dispose();$hashAlgorithm.Dispose()}
    if($actualHash -ne $file.sha256) {throw ('Package verification failed: '+$file.path)}
  }
  if(Test-Path -LiteralPath (Join-Path $installationPath 'build-manifest.json')) {
    & (Join-Path $packagePath 'Uninstall Bannerlands.ps1') -InstallationRoot $installationPath -ShutdownOnly -Quiet
  }
  New-Item -ItemType Directory -Force -Path $installationPath | Out-Null
  Copy-Item -LiteralPath (Join-Path $packagePath 'runtime'),(Join-Path $packagePath 'game'),(Join-Path $packagePath 'notices') -Destination $installationPath -Recurse -Force
  Get-ChildItem -LiteralPath $packagePath -File | Copy-Item -Destination $installationPath -Force
  New-Item -ItemType Directory -Force -Path $DesktopDirectory,$StartMenuDirectory | Out-Null
  $shortcutShell=New-Object -ComObject WScript.Shell
  foreach($shortcutPath in @((Join-Path $DesktopDirectory 'Bannerlands.lnk'),(Join-Path $StartMenuDirectory 'Bannerlands.lnk'))) {
    $shortcut=$shortcutShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath=Join-Path $env:SystemRoot 'System32\wscript.exe'
    $shortcut.Arguments='//B //Nologo "'+(Join-Path $installationPath 'Launch Bannerlands.vbs')+'"'
    $shortcut.WorkingDirectory=$installationPath
    $shortcut.IconLocation=(Join-Path $installationPath 'Bannerlands.ico')+',0'
    $shortcut.Description='Play Bannerlands and host online multiplayer lobbies.'
    $shortcut.Save()
  }
  $uninstallShortcut=$shortcutShell.CreateShortcut((Join-Path $StartMenuDirectory 'Uninstall Bannerlands.lnk'))
  $uninstallShortcut.TargetPath=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $uninstallShortcut.Arguments='-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $installationPath 'Uninstall Bannerlands.ps1')+'"'
  $uninstallShortcut.Save()
  $settings=@{installRoot=$installationPath;desktopShortcut=(Join-Path $DesktopDirectory 'Bannerlands.lnk');startMenu=$StartMenuDirectory;registry=(-not $NoRegistry)}
  $settings | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installationPath 'installation.json') -Encoding UTF8
  if(-not $NoRegistry) {
    $registryPath='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Bannerlands'
    New-Item -Path $registryPath -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name DisplayName -Value 'Bannerlands Multiplayer Preview' -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name DisplayVersion -Value $manifest.version -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name DisplayIcon -Value (Join-Path $installationPath 'Bannerlands.ico') -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name InstallLocation -Value $installationPath -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name UninstallString -Value ('powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $installationPath 'Uninstall Bannerlands.ps1')+'"') -PropertyType String -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null
  }
  if(-not $Quiet) {(New-Object -ComObject WScript.Shell).Popup('Bannerlands is installed. Open it using the new desktop icon or Start menu shortcut.',0,'Bannerlands',64) | Out-Null}
} catch {
  if(-not $Quiet) {(New-Object -ComObject WScript.Shell).Popup('Bannerlands could not install. Close any running Bannerlands game and try again.'+[Environment]::NewLine+$_.Exception.Message,0,'Bannerlands installation',16) | Out-Null}
  throw
} finally {
  $verifiedStaging=[IO.Path]::GetFullPath($stagingPath)
  if([IO.Path]::GetDirectoryName($verifiedStaging) -eq $stagingParent -and [IO.Path]::GetFileName($verifiedStaging).StartsWith('.bl-setup-')) {Remove-Item -LiteralPath $verifiedStaging -Recurse -Force}
}
