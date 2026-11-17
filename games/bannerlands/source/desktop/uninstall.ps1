param([switch]$Quiet,[switch]$ShutdownOnly,[string]$InstallationRoot=$PSScriptRoot,[string]$SessionDirectory=(Join-Path $env:LOCALAPPDATA 'Bannerlands\sessions'))
$ErrorActionPreference='Stop'
$expectedRoot=[IO.Path]::GetFullPath($InstallationRoot)
if(-not (Test-Path -LiteralPath (Join-Path $expectedRoot 'build-manifest.json'))) {throw 'The Bannerlands installation location could not be verified.'}
if(-not $ShutdownOnly) {
  if([IO.Path]::GetFullPath($PSScriptRoot) -ne $expectedRoot) {throw 'The uninstaller must run from this Bannerlands installation.'}
  $settings=Get-Content -LiteralPath (Join-Path $expectedRoot 'installation.json') -Raw | ConvertFrom-Json
  if([IO.Path]::GetFullPath($settings.installRoot) -ne $expectedRoot) {throw 'The Bannerlands installation location could not be verified.'}
}
if(-not $Quiet -and -not $ShutdownOnly) {
  $answer=(New-Object -ComObject WScript.Shell).Popup('Uninstall Bannerlands? Your personal settings and browser data will be kept.',0,'Uninstall Bannerlands',36)
  if($answer -ne 6) {exit 0}
}
# Ask only this exact installation's private local service to exit gracefully.
# Never terminate a process by name, and never expose this capability publicly.
if(Test-Path -LiteralPath $SessionDirectory) {
  foreach($recordFile in (Get-ChildItem -LiteralPath $SessionDirectory -File -Filter '*.json')) {
    try {$record=Get-Content -LiteralPath $recordFile.FullName -Raw | ConvertFrom-Json} catch {continue}
    if(-not $record.installationRoot -or [IO.Path]::GetFullPath($record.installationRoot) -ne $expectedRoot) {continue}
    if(-not $record.nodePath -or [IO.Path]::GetFullPath($record.nodePath) -ne (Join-Path $expectedRoot 'runtime\node.exe')) {continue}
    $running=Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if(-not $running -or $running.Path -ne $record.nodePath) {Remove-Item -LiteralPath $recordFile.FullName -Force;continue}
    $localAddress=$null
    if(-not [Uri]::TryCreate($record.origin,[UriKind]::Absolute,[ref]$localAddress) -or $localAddress.Scheme -ne 'http' -or $localAddress.Host -ne '127.0.0.1' -or $localAddress.AbsolutePath -ne '/' -or $localAddress.Query -or $localAddress.Fragment -or $localAddress.UserInfo -or $record.desktopCapability -notmatch '^[A-Za-z0-9_-]{40,64}$') {throw 'The running Bannerlands service could not be verified. Close it before uninstalling.'}
    try {Invoke-RestMethod -Uri ($localAddress.GetLeftPart([UriPartial]::Authority)+'/api/desktop/shutdown') -Method Post -ContentType 'application/json' -Body '{}' -Headers @{Authorization=('Bearer '+$record.desktopCapability)} -TimeoutSec 12 | Out-Null} catch {throw 'Bannerlands could not close automatically. Close its browser, wait three minutes, and try again.'}
    if(-not $running.WaitForExit(12000)) {throw 'Bannerlands is still finishing its connection cleanup. Wait a moment and try again.'}
    if(Test-Path -LiteralPath $recordFile.FullName) {Remove-Item -LiteralPath $recordFile.FullName -Force}
  }
}
if($ShutdownOnly) {return}
# Remove only the shortcuts created by this installation, after checking their
# destinations. Personal browser storage and LocalAppData\Bannerlands remain.
$shortcutShell=New-Object -ComObject WScript.Shell
if(Test-Path -LiteralPath $settings.desktopShortcut) {
  $shortcut=$shortcutShell.CreateShortcut($settings.desktopShortcut)
  if($shortcut.Arguments.Contains($expectedRoot)) {Remove-Item -LiteralPath $settings.desktopShortcut -Force}
}
$startMenuPath=[IO.Path]::GetFullPath($settings.startMenu)
if(Test-Path -LiteralPath $startMenuPath) {
  foreach($name in @('Bannerlands.lnk','Uninstall Bannerlands.lnk')) {
    $shortcutPath=Join-Path $startMenuPath $name
    if(Test-Path -LiteralPath $shortcutPath) {$shortcut=$shortcutShell.CreateShortcut($shortcutPath);if($shortcut.Arguments.Contains($expectedRoot)) {Remove-Item -LiteralPath $shortcutPath -Force}}
  }
  if(-not (Get-ChildItem -LiteralPath $startMenuPath -Force)) {Remove-Item -LiteralPath $startMenuPath -Force}
}
if($settings.registry) {
  $registryPath='HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Bannerlands'
  if((Get-ItemProperty -LiteralPath $registryPath -ErrorAction SilentlyContinue).InstallLocation -eq $expectedRoot) {Remove-Item -LiteralPath $registryPath -Recurse -Force}
}
# The manifest and installation marker bind recursive removal to this exact
# product directory. Refuse broad roots even if a settings file was edited.
if([IO.Path]::GetPathRoot($expectedRoot).TrimEnd('\') -eq $expectedRoot.TrimEnd('\') -or $expectedRoot -eq [IO.Path]::GetFullPath($env:USERPROFILE)) {throw 'Refusing an unsafe uninstall location.'}
try {Remove-Item -LiteralPath $expectedRoot -Recurse -Force} catch {if(-not $Quiet) {(New-Object -ComObject WScript.Shell).Popup('Close Bannerlands, then run the uninstaller again to remove files still in use.',0,'Bannerlands',48) | Out-Null};throw}
