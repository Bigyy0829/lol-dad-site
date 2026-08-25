# Publish a portable release: refresh data (optional), build the package,
# write the remote version.json manifest with SHA256, and (optionally) upload
# to GitHub Releases via the gh CLI.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\publish.ps1 -Repo "you/your-repo" [-Refresh] [-Version 2026.08.25.1] [-Upload]
#
# Keep this file ASCII-only so Windows PowerShell 5.1 parses it correctly.

param(
    [string]$Repo = "OWNER/REPO",
    [string]$Version = "",
    [switch]$Refresh,
    [switch]$Upload
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

if (-not $Version) {
    $today = Get-Date -Format "yyyy.MM.dd"
    $n = 1
    while (Test-Path -LiteralPath (Join-Path $root ("release\lol-dad-site-portable-" + $today + "." + $n + ".zip"))) {
        $n++
    }
    $Version = "$today.$n"
}

Write-Host ("Publishing version " + $Version)

if ($Refresh) {
    Write-Host "== Refreshing data (this can take a while) =="
    & npm.cmd run data:refresh
    if ($LASTEXITCODE -ne 0) { throw "data refresh failed" }
}

Write-Host "== Building portable package =="
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\build-portable.ps1") -Version $Version -Repo $Repo
if ($LASTEXITCODE -ne 0) { throw "portable build failed" }

$zip = Join-Path $root ("release\lol-dad-site-portable-" + $Version + ".zip")
if (-not (Test-Path -LiteralPath $zip)) { throw "zip not found: $zip" }

$sha = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $zip).Length
$manifest = @{
    version      = $Version
    asset        = "lol-dad-site-portable-" + $Version + ".zip"
    sha256       = $sha
    size         = $size
    repo         = $Repo
    published_at = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
} | ConvertTo-Json

$manifestPath = Join-Path $root "release\version.json"
[System.IO.File]::WriteAllText(
    $manifestPath,
    $manifest,
    (New-Object System.Text.UTF8Encoding($false))
)
Write-Host ("Manifest written: " + $manifestPath)
Write-Host $manifest

if ($Upload) {
    if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
        throw "gh CLI not found. Install GitHub CLI or upload manually."
    }
    Write-Host "== Removing old releases =="
    $tags = gh release list --repo $Repo --json tagName --jq ".[].tagName" 2>$null
    foreach ($t in $tags) {
        if ($t) { gh release delete $t -y --repo $Repo }
    }
    Write-Host "== Creating release v$Version =="
    gh release create ("v" + $Version) $zip $manifestPath --repo $Repo `
        --title ("v" + $Version) --notes "Auto refresh & publish"
    if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }
    Write-Host "Release v$Version created."
} else {
    Write-Host ""
    Write-Host "Upload manually (or re-run with -Upload after gh auth login):"
    Write-Host ("  gh auth login")
    Write-Host ("  gh release create v" + $Version + " `"" + $zip + "`" `"" + $manifestPath + "`" --repo " + $Repo + " --title v" + $Version + " --notes Auto")
    Write-Host "Then the portable launcher will auto-update from GitHub Releases."
}
