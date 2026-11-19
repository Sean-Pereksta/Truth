[CmdletBinding()]
param([Parameter(Mandatory)][string]$GameDirectory)

$ErrorActionPreference = 'Stop'
$game = (Resolve-Path -LiteralPath $GameDirectory).Path
if (-not (Test-Path -LiteralPath (Join-Path $game 'Last Signal.exe') -PathType Leaf)) {
    throw 'Choose the directory containing the compiled Last Signal.exe.'
}

$archiveUrl = 'https://download.qt.io/development_releases/prebuilt/llvmpipe/windows/opengl32sw-64-mesa_11_2_2-signed_sha256.7z'
$archiveDigest = 'C61F801C1760AA24B02C7A8354323CDDF368B86F8F5C34B50B3B224F7D728AFD'
$driverDigest = 'B04DE4541863BC7D8879040A78889C4849C1B1DA2784C4630F734C146C2998CE'
$graphics = Join-Path $game 'Hosting/Graphics'
$driver = Join-Path $graphics 'opengl32sw.dll'

if (-not (Test-Path -LiteralPath $driver -PathType Leaf) -or
    (Get-FileHash -LiteralPath $driver -Algorithm SHA256).Hash -ne $driverDigest) {
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ('last-signal-render-' + [guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($temporary) | Out-Null
    $archive = Join-Path $temporary 'graphics.7z'
    $extracted = Join-Path $temporary 'opengl32sw.dll'
    try {
        & curl.exe --fail --silent --show-error --location --retry 3 -o $archive $archiveUrl
        if ($LASTEXITCODE -ne 0 -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $archiveDigest) {
            throw 'The Qt software graphics download failed its SHA-256 check.'
        }
        & 7z.exe e $archive 'opengl32sw.dll' -r "-o$temporary" -y | Out-Null
        if ($LASTEXITCODE -ne 0 -or (Get-FileHash -LiteralPath $extracted -Algorithm SHA256).Hash -ne $driverDigest) {
            throw 'The Qt software graphics driver failed its SHA-256 check.'
        }
        [IO.Directory]::CreateDirectory($graphics) | Out-Null
        Copy-Item -LiteralPath $extracted -Destination $driver -Force
    } finally {
        foreach ($file in @($archive, $extracted)) {
            if (Test-Path -LiteralPath $file -PathType Leaf) {
                Remove-Item -LiteralPath $file -Force
            }
        }
        Remove-Item -LiteralPath $temporary
    }
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'SoftwareGraphics-Notices.txt') -Destination $graphics -Force
