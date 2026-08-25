# Build the portable (green) edition of the site.
# Layout:
#   <portable folder>/
#     app/            - the actual app (node, node_modules, .next, data, configs)
#     core.ps1        - launcher logic (ASCII-only, actions: start|stop|check)
#     *.bat           - double-click wrappers around core.ps1
#     version.json    - installed version manifest
#     updates.json    - update source config (repo slug + mirrors)
#     使用说明.txt      - Chinese readme (written as UTF-8 via base64)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\build-portable.ps1 [-Version x.y.z.n] [-Build]
#
# Keep this file ASCII-only so Windows PowerShell 5.1 parses it correctly.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$nodeVer = "v24.19.0"
$cacheDir = Join-Path $root "tmp\node-cache"
$nodeZip = Join-Path $cacheDir "node-$nodeVer-win-x64.zip"
$nodeExtract = Join-Path $cacheDir "node-$nodeVer-win-x64"
$releaseDir = Join-Path $root "release"

# ASCII folder name: Chinese names break tar.exe on non-Chinese CI runners.
$folderName = "lol-dad-site-portable"
$startBat = -join @([char]0x542F, [char]0x52A8, [char]0x7F51, [char]0x7AD9, ".bat")  # start-site.bat
$stopBat = -join @([char]0x505C, [char]0x6B62, [char]0x7F51, [char]0x7AD9, ".bat")    # stop-site.bat
$checkBat = -join @([char]0x68C0, [char]0x67E5, [char]0x66F4, [char]0x65B0, ".bat")   # check-update.bat
$readmeTxt = -join @([char]0x4F7F, [char]0x7528, [char]0x8BF4, [char]0x660E, ".txt") # readme.txt

if ([string]::IsNullOrEmpty($folderName) -or [string]::IsNullOrEmpty($startBat)) {
    throw "Display-name construction failed."
}

$version = (Get-Date -Format "yyyy.MM.dd") + ".1"
if ($args -contains "-Version") {
    $idx = [Array]::IndexOf($args, "-Version")
    if ($idx -ge 0 -and $idx + 1 -lt $args.Count) { $version = $args[$idx + 1] }
}
$repoParam = "OWNER/REPO"
if ($args -contains "-Repo") {
    $idx = [Array]::IndexOf($args, "-Repo")
    if ($idx -ge 0 -and $idx + 1 -lt $args.Count) { $repoParam = $args[$idx + 1] }
}

# ---------- 1. Build ----------
if ($args -contains "-Build" -or -not (Test-Path -LiteralPath ".next\BUILD_ID")) {
    Write-Host "== Building .next =="
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}

# ---------- 2. Portable Node ----------
if (-not (Test-Path -LiteralPath $nodeZip)) {
    Write-Host "== Downloading portable Node $nodeVer =="
    New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
    & curl.exe -L --fail --retry 3 --connect-timeout 10 --max-time 600 -o $nodeZip `
        "https://npmmirror.com/mirrors/node/$nodeVer/node-$nodeVer-win-x64.zip"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npmmirror failed, trying nodejs.org ..."
        & curl.exe -L --fail --retry 2 --connect-timeout 10 --max-time 600 -o $nodeZip `
            "https://nodejs.org/dist/$nodeVer/node-$nodeVer-win-x64.zip"
    }
    if (-not (Test-Path -LiteralPath $nodeZip)) {
        throw "Failed to download portable Node to: $nodeZip"
    }
}
if (-not (Test-Path -LiteralPath (Join-Path $nodeExtract "node.exe"))) {
    Write-Host "== Extracting portable Node =="
    Expand-Archive -LiteralPath $nodeZip -DestinationPath $cacheDir -Force
}

# ---------- 3. Assemble output ----------
$out = Join-Path $releaseDir $folderName
if (Test-Path -LiteralPath $out) {
    Write-Host "== Clearing old output: $out =="
    Remove-Item -LiteralPath $out -Recurse -Force
}
New-Item -ItemType Directory -Path $out | Out-Null
$appDir = Join-Path $out "app"
New-Item -ItemType Directory -Path $appDir | Out-Null
Write-Host "== Assembling into $out =="

New-Item -ItemType Directory -Path (Join-Path $appDir "node") | Out-Null
Copy-Item -LiteralPath (Join-Path $nodeExtract "node.exe") -Destination (Join-Path $appDir "node\node.exe") -Force

Copy-Item -LiteralPath (Join-Path $root ".next") -Destination (Join-Path $appDir ".next") -Recurse -Force
Remove-Item -LiteralPath (Join-Path $appDir ".next\cache") -Recurse -Force -ErrorAction SilentlyContinue

Copy-Item -LiteralPath (Join-Path $root "package.json") -Destination $appDir -Force
Copy-Item -LiteralPath (Join-Path $root "next.config.ts") -Destination $appDir -Force

New-Item -ItemType Directory -Path (Join-Path $appDir "data") | Out-Null
Copy-Item -LiteralPath (Join-Path $root "data\lol.db") -Destination (Join-Path $appDir "data\lol.db") -Force

Write-Host "== Copying node_modules (this takes a moment) =="
Copy-Item -LiteralPath (Join-Path $root "node_modules") -Destination (Join-Path $appDir "node_modules") -Recurse -Force

$prune = @(
    "typescript", "vitest", "@vitest", "playwright", "playwright-core",
    "@playwright", "vite", "rollup", "@rollup", "@esbuild", "@types"
)
foreach ($p in $prune) {
    $target = Join-Path $appDir "node_modules\$p"
    if (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
    }
}

# ---------- 4. core.ps1 (launcher logic, ASCII only) ----------
$coreScript = @'
# core.ps1 - portable launcher (ASCII only). Actions: start | stop | check
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$app = Join-Path $root "app"
$pidFile = Join-Path $root "app.pid"
$updatesDir = Join-Path $root "updates"
$port = 3000
$hostAddr = "127.0.0.1"

function Test-PortUp {
    $c = New-Object Net.Sockets.TcpClient
    try {
        $ar = $c.BeginConnect($hostAddr, $port, $null, $null)
        if ($ar.AsyncWaitHandle.WaitOne(500)) { $c.EndConnect($ar); return $true }
    } catch {} finally { $c.Close() }
    return $false
}

function Open-Browser {
    try {
        Start-Process ("http://" + $hostAddr + ":" + $port)
    } catch {
        Write-Host ("Open this URL in your browser: http://" + $hostAddr + ":" + $port)
    }
}

function Get-InstalledVersion {
    $v = Join-Path $root "version.json"
    if (Test-Path -LiteralPath $v) {
        try { return (Get-Content -LiteralPath $v -Raw | ConvertFrom-Json).version } catch {}
    }
    return ""
}

function Get-UpdateConfig {
    $u = Join-Path $root "updates.json"
    if (Test-Path -LiteralPath $u) {
        try { return (Get-Content -LiteralPath $u -Raw | ConvertFrom-Json) } catch {}
    }
    return $null
}

function Get-RemoteManifest {
    $bases = @()
    if ($env:UPDATE_BASE) {
        $bases += $env:UPDATE_BASE.TrimEnd("/")
    } else {
        $cfg = Get-UpdateConfig
        if ($cfg -and $cfg.repo -and $cfg.repo -match "/" -and $cfg.repo -notmatch "OWNER|placeholder") {
            $direct = "https://github.com/" + $cfg.repo + "/releases/latest/download"
            $bases += $direct
            foreach ($m in @($cfg.mirrors)) {
                if ($m) { $bases += ($m.TrimEnd("/") + "/" + $direct) }
            }
        }
    }
    foreach ($b in $bases) {
        try {
            $r = Invoke-WebRequest -Uri ($b + "/version.json") -UseBasicParsing -TimeoutSec 8
            $m = $r.Content | ConvertFrom-Json
            if ($m.version -and $m.sha256 -and $m.asset) {
                return @{ Base = $b; Manifest = $m }
            }
        } catch {}
    }
    return $null
}

function Get-DownloadedUpdate($manifest, $base) {
    New-Item -ItemType Directory -Force -Path $updatesDir | Out-Null
    $ver = [string]$manifest.version
    $zip = Join-Path $updatesDir ("update-" + $ver + ".zip")
    $url = $base + "/" + $manifest.asset
    Write-Host ("Downloading update " + $ver + " ...")
    & curl.exe -L --fail --retry 3 --connect-timeout 10 --max-time 1200 -o $zip $url
    if ($LASTEXITCODE -ne 0) { throw "download failed" }
    $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne ([string]$manifest.sha256).ToLowerInvariant()) {
        throw ("SHA256 mismatch - expected " + $manifest.sha256)
    }
    $extract = Join-Path $updatesDir ("extract-" + $ver)
    if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $extract
    if (-not (Test-Path -LiteralPath (Join-Path $extract "app"))) {
        throw "invalid update package (no app folder)"
    }
    return $extract
}

function Set-VersionFile($ver) {
    $json = @{ version = [string]$ver; installed_at = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") } | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText(
        (Join-Path $root "version.json"),
        $json,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

function Apply-Update($extract, $ver) {
    $old = Join-Path $root "app-old"
    $oldVer = Get-InstalledVersion
    if (Test-Path -LiteralPath $old) { Remove-Item -LiteralPath $old -Recurse -Force }
    Rename-Item -LiteralPath $app -NewName "app-old"
    Copy-Item -LiteralPath (Join-Path $extract "app") -Destination $app -Recurse
    foreach ($f in @("updates.json")) {
        $src = Join-Path $extract $f
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $root $f) -Force
        }
    }
    Set-VersionFile $ver
    Write-Host ("Applied update " + $ver)
    return $oldVer
}

function Start-Server {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = Join-Path $app "node\node.exe"
    $psi.Arguments = "node_modules\next\dist\bin\next start -H $hostAddr -p $port"
    $psi.WorkingDirectory = $app
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    [System.IO.File]::WriteAllText($pidFile, [string]$p.Id)
    for ($i = 0; $i -lt 40; $i++) {
        if (Test-PortUp) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Stop-Server {
    $killed = $false
    if (Test-Path -LiteralPath $pidFile) {
        $t = [System.IO.File]::ReadAllText($pidFile).Trim()
        if ($t) {
            $proc = Get-Process -Id ([int]$t) -ErrorAction SilentlyContinue
            if ($proc) { $proc | Stop-Process -Force; $killed = $true }
        }
        Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    }
    if (-not $killed) {
        $line = netstat -ano | Select-String (":" + $port + ".*LISTENING") | Select-Object -First 1
        if ($line) {
            $parts = ($line.ToString() -split "\s+") | Where-Object { $_ }
            $pid2 = $parts[$parts.Count - 1]
            Stop-Process -Id ([int]$pid2) -Force -ErrorAction SilentlyContinue
            $killed = $true
        }
    }
    if ($killed) { Write-Host "Site stopped." } else { Write-Host "Site was not running." }
}

$action = $args[0]
switch ($action) {
    "start" {
        $up = Get-RemoteManifest
        $applied = $false
        $oldVer = ""
        if ($up) {
            $inst = Get-InstalledVersion
            $iver = try { [version]$inst } catch { [version]"0.0.0" }
            $mver = try { [version]$up.Manifest.version } catch { [version]"0.0.0" }
            if ($mver -gt $iver) {
                Write-Host ("Update available: " + $mver + " (installed " + $iver + ")")
                try {
                    $extract = Get-DownloadedUpdate $up.Manifest $up.Base
                    $oldVer = Apply-Update $extract $up.Manifest.version
                    $applied = $true
                } catch {
                    Write-Host ("Update failed (" + $_.Exception.Message + ") - continuing with current version")
                    if (Test-Path -LiteralPath (Join-Path $root "app-old")) {
                        Remove-Item -LiteralPath $app -Recurse -Force -ErrorAction SilentlyContinue
                        Rename-Item -LiteralPath (Join-Path $root "app-old") -NewName "app"
                    }
                }
            }
        }
        if (Test-PortUp) {
            Open-Browser
        } else {
            $ok = Start-Server
            if (-not $ok -and $applied) {
                Write-Host "New version failed to start; rolling back."
                Stop-Process -Id ([int]([System.IO.File]::ReadAllText($pidFile))) -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath $app -Recurse -Force
                Rename-Item -LiteralPath (Join-Path $root "app-old") -NewName "app"
                if ($oldVer) { Set-VersionFile $oldVer }
                $ok = Start-Server
            }
            if ($ok) {
                Remove-Item -LiteralPath (Join-Path $root "app-old") -Recurse -Force -ErrorAction SilentlyContinue
                if (Test-Path -LiteralPath $updatesDir) {
                    Remove-Item -LiteralPath (Join-Path $updatesDir "*") -Recurse -Force -ErrorAction SilentlyContinue
                }
                Open-Browser
            } else {
                Write-Host "Server failed to start. Check port " + $port + "."
            }
        }
    }
    "stop" { Stop-Server }
    "check" {
        $up = Get-RemoteManifest
        if (-not $up) {
            Write-Host "No update source configured or unreachable. Edit updates.json and set your repo, or set UPDATE_BASE."
            break
        }
        $inst = Get-InstalledVersion
        $iver = try { [version]$inst } catch { [version]"0.0.0" }
        $mver = try { [version]$up.Manifest.version } catch { [version]"0.0.0" }
        if ($mver -le $iver) {
            Write-Host ("Up to date. Version " + $inst)
            break
        }
        Write-Host ("New version available: " + $mver + " (installed " + $inst + ")")
        try {
            $extract = Get-DownloadedUpdate $up.Manifest $up.Base
            Apply-Update $extract $up.Manifest.version
            Write-Host "Update applied. Next launch of start-site.bat will use it."
        } catch {
            Write-Host ("Update failed: " + $_.Exception.Message)
        }
    }
    default {
        Write-Host "Usage: powershell -ExecutionPolicy Bypass -File core.ps1 start|stop|check"
    }
}
'@
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $out "core.ps1"), $coreScript, $utf8NoBom)

# ---------- 5. Bat wrappers ----------
$ascii = New-Object System.Text.ASCIIEncoding

$startBatContent = @'
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\core.ps1" start
exit /b
'@
$startBatContent = $startBatContent -replace "`r?`n", "`r`n"
[System.IO.File]::WriteAllText((Join-Path $out $startBat), $startBatContent, $ascii)

$stopBatContent = @'
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\core.ps1" stop
exit /b
'@
$stopBatContent = $stopBatContent -replace "`r?`n", "`r`n"
[System.IO.File]::WriteAllText((Join-Path $out $stopBat), $stopBatContent, $ascii)

$checkBatContent = @'
@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\core.ps1" check
echo.
pause
exit /b
'@
$checkBatContent = $checkBatContent -replace "`r?`n", "`r`n"
[System.IO.File]::WriteAllText((Join-Path $out $checkBat), $checkBatContent, $ascii)

# ---------- 6. version.json + updates.json ----------
$installed = @{ version = $version; installed_at = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") } | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText((Join-Path $out "version.json"), $installed, $utf8NoBom)

$updatesCfg = @{ repo = $repoParam; mirrors = @("https://ghfast.top/", "https://gh-proxy.com/") } | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $out "updates.json"), $updatesCfg, $utf8NoBom)

# ---------- 7. Chinese readme (base64 -> UTF-8) ----------
$readmeB64 = "5L2/55So5pa55rOVCjEuIOWPjOWHu+OAjOWQr+WKqOe9keermS5iYXTjgI0KMi4g562J5b6FIDEtMiDnp5LvvIzmtY/op4jlmajkvJroh6rliqjmiZPlvIAgaHR0cDovLzEyNy4wLjAuMTozMDAwCjMuIOeci+WujOWQjuWPjOWHu+OAjOWBnOatoue9keermS5iYXTjgI3lgZzmraLvvIjmiJbnm7TmjqXlhbPmnLrvvIkKCuivtOaYjgotIOe9keermeWPquWcqOeCueWHu+WQr+WKqOWQjui/kOihjO+8jOWBnOatouWNs+mAgOWHuu+8jOS4jeaui+eVmeWQjuWPsOi/m+eoiwotIOS4jemcgOimgeWuieijhSBOb2RlLmpz44CB5LiN6ZyA6KaB566h55CG5ZGY5p2D6ZmQ44CB5LiN5raJ5Y+K5Lu75L2V6K6h5YiS5Lu75YqhCi0g5pWw5o2u5Li65omT5YyF5pe25Yi755qE5b+r54Wn77yb6ZyA6KaB5pu05paw5pWw5o2u6K+355So5rqQ56CB54mI6L+Q6KGMIG5wbSBydW4gZGF0YTpyZWZyZXNo"
$readmeBody = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($readmeB64))
$readme = $folderName + "`r`n`r`n" + $readmeBody + "`r`n`r`n" + @"
自动更新
- 启动或双击「$checkBat」时会检查更新源（updates.json 里的 GitHub 仓库）
- 发现新版自动下载、校验 SHA256、下次启动生效；失败自动回滚旧版
- 首次使用：把 updates.json 中的 OWNER/REPO 改成你的 GitHub 仓库名
- 离线/未配置时不联网，正常启动本地版本
"@
[System.IO.File]::WriteAllText((Join-Path $out $readmeTxt), $readme, (New-Object System.Text.UTF8Encoding($true)))

# ---------- 8. Zip (contents, ASCII name) ----------
Write-Host "== Zipping =="
$zipPath = Join-Path $releaseDir ("lol-dad-site-portable-" + $version + ".zip")
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if ($tar) {
    & tar.exe -a -c -f $zipPath -C $out .
    if ($LASTEXITCODE -ne 0) { throw "tar zip failed" }
} else {
    Compress-Archive -Path (Join-Path $out "*") -DestinationPath $zipPath -CompressionLevel Optimal
}

# ---------- 9. Summary ----------
$outSize = (Get-ChildItem -LiteralPath $out -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
$zipSize = (Get-Item -LiteralPath $zipPath).Length / 1MB
Write-Host ""
Write-Host ("Done. Folder:  {0}  ({1:N0} MB)" -f $out, $outSize)
Write-Host ("Zip:          {0}  ({1:N0} MB)" -f $zipPath, $zipSize)
Write-Host ("Version:      {0}" -f $version)
