[CmdletBinding()]
param([string]$OutputPath = (Join-Path $PSScriptRoot 'Last-Signal-Windows-x64.zip'))
$ErrorActionPreference = 'Stop'
$folder = Join-Path $PSScriptRoot 'release-parts'
$manifest = Get-Content -LiteralPath (Join-Path $folder 'manifest.json') -Raw | ConvertFrom-Json
$target = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $target) {
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $manifest.sha256) {
        Write-Output $target
        return
    }
    throw 'A different file already occupies the output path.'
}
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
$temp = $target + '.' + [Guid]::NewGuid().ToString('N') + '.partial'
try {
    $stream = [IO.File]::Open($temp, [IO.FileMode]::CreateNew)
    try {
        foreach ($part in $manifest.parts) {
            if ($part.file -notmatch '^part-[0-9]{4}\.bin$') { throw 'Invalid part name.' }
            $path = Join-Path $folder $part.file
            if ((Get-Item -LiteralPath $path).Length -ne $part.size -or (Get-FileHash -LiteralPath $path).Hash -ne $part.sha256) {
                throw ('Missing or damaged archive part ' + $part.file)
            }
            $inputStream = [IO.File]::OpenRead($path)
            try { $inputStream.CopyTo($stream) } finally { $inputStream.Dispose() }
        }
    } finally { $stream.Dispose() }
    if ((Get-Item -LiteralPath $temp).Length -ne $manifest.size -or (Get-FileHash -LiteralPath $temp).Hash -ne $manifest.sha256) {
        throw 'The assembled archive failed its integrity check.'
    }
    [IO.File]::Move($temp, $target)
} finally {
    if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp }
}
Write-Output $target
