[CmdletBinding()]
param(
    [ValidateSet('socket','public')] [string]$Mode='socket',
    [string]$GameDirectory=(Join-Path $PSScriptRoot '../build/windows')
)
$ErrorActionPreference='Stop'
$game=Join-Path (Resolve-Path -LiteralPath $GameDirectory) 'Last Signal.exe'
$compiler=Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$driver=Join-Path (Split-Path $game) 'RoomJourney.exe'
& $compiler /nologo /optimize+ /platform:x64 /r:System.Drawing.dll /r:System.Windows.Forms.dll "/r:$game" "/out:$driver" (Join-Path $PSScriptRoot 'RoomJourney.cs')
if($LASTEXITCODE){throw 'Could not compile the network test'}
$scratch=Join-Path ([IO.Path]::GetTempPath()) ('last-signal-room-'+[guid]::NewGuid().ToString('N'))
& $driver $Mode $scratch
if($LASTEXITCODE){
    Get-ChildItem -LiteralPath $scratch -Filter 'failure-*.txt' -ErrorAction SilentlyContinue | ForEach-Object {Get-Content -LiteralPath $_.FullName -Tail 8}
    throw "Room journey failed in $Mode mode"
}
$mobile = Join-Path (Split-Path $game) 'Test-Mobile.exe'
& $compiler /nologo /optimize+ /platform:x64 /main:TestMobile /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll "/r:$game" "/out:$mobile" (Join-Path $PSScriptRoot 'Test-Mobile.cs') (Join-Path $PSScriptRoot 'OnlinePipe.cs')
if($LASTEXITCODE){throw 'Could not compile the mobile room test'}
& $mobile $Mode
if($LASTEXITCODE){throw "Mobile room journey failed in $Mode mode"}
if($Mode -eq 'socket'){
    $harvest=Join-Path (Split-Path $game) 'NetworkHarvest.exe'
    & $compiler /nologo /optimize+ /platform:x64 /main:NetworkHarvest /r:System.Drawing.dll /r:System.Windows.Forms.dll "/r:$game" "/out:$harvest" (Join-Path $PSScriptRoot 'NetworkHarvest.cs') (Join-Path $PSScriptRoot 'OnlinePipe.cs')
    if($LASTEXITCODE){throw 'Could not compile the shared harvest test'}
    foreach($map in 0,1,2){
        & $harvest tcp $map
        if($LASTEXITCODE){throw "Shared tree and stone checks failed for arena $map"}
    }
}
