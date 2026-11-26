[CmdletBinding()]
param([string]$Destination = (Join-Path $PSScriptRoot 'build/windows'))
$ErrorActionPreference = 'Stop'
$archive = Join-Path $PSScriptRoot 'Last-Signal-Windows-x64.zip'
if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
    throw 'Restore Last-Signal-Windows-x64.zip from this repository. It contains the original assets and Cloudflare runtime.'
}
$output = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $output) {
    if (Get-ChildItem -LiteralPath $output -Force | Select-Object -First 1) {
        throw 'Choose an empty output directory for this build.'
    }
}
[IO.Directory]::CreateDirectory($output) | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$package = [IO.Compression.ZipFile]::OpenRead($archive)
try {
    $prefix = $output.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    foreach ($entry in $package.Entries) {
        if (-not $entry.Name -or $entry.FullName -match '^(Source|Mobile|BrowserAssets)/') { continue }
        $path = [IO.Path]::GetFullPath((Join-Path $output $entry.FullName))
        if (-not $path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid file path in portable archive.' }
        [IO.Directory]::CreateDirectory((Split-Path -Parent $path)) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $path)
    }
} finally { $package.Dispose() }
$compiledSource = Join-Path $output 'Source'
foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'source') -Recurse -File)) {
    $relative = $file.FullName.Substring((Join-Path $PSScriptRoot 'source').Length + 1)
    $destinationPath = Join-Path $compiledSource $relative
    [IO.Directory]::CreateDirectory((Split-Path -Parent $destinationPath)) | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $destinationPath -Force
}
Copy-Item -LiteralPath (Join-Path $compiledSource 'Mobile') -Destination (Join-Path $output 'Mobile') -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'browser-assets') -Destination (Join-Path $output 'BrowserAssets') -Recurse
& (Join-Path $compiledSource 'Build.cmd')
if ($LASTEXITCODE -ne 0) { throw "C# compilation failed with exit code $LASTEXITCODE." }
Write-Output (Join-Path $output 'Last Signal.exe')
