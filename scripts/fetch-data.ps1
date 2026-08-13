param(
    [int]$Chunks = 8,
    [string]$OutDir = "data/raw",
    [int]$Aria2Connections = 4
)

$ErrorActionPreference = "Stop"

$ROOT = Split-Path $PSScriptRoot -Parent
$Aria2cPath = $null
$aria2Found = Get-ChildItem (Join-Path $ROOT "tools\aria2") -Recurse -Filter "aria2c.exe" `
    -ErrorAction SilentlyContinue | Select-Object -First 1
if ($aria2Found) { $Aria2cPath = $aria2Found.FullName }

function Get-SignedUrl {
    param([string]$ApiUrl)
    $hdr = curl.exe -sS -D - -o NUL --max-time 30 $ApiUrl 2>$null
    $loc = ($hdr | Select-String -Pattern '^Location:' | Select-Object -First 1).Line
    if (-not $loc) { throw "No redirect URL from $ApiUrl" }
    return ($loc -replace '^Location:\s*', '' -replace '[\r\n]', '').Trim()
}

function Get-TotalLength {
    param([string]$Url)
    $hdr = curl.exe -sS -D - -o NUL --range 0-0 --max-time 30 $Url 2>$null
    $cr = ($hdr | Select-String -Pattern '^Content-Range:' | Select-Object -First 1).Line
    if ($cr -match '/(\d+)\s*$') { return [long]$Matches[1] }
    $cl = ($hdr | Select-String -Pattern '^Content-Length:' | Select-Object -First 1).Line
    if ($cl -match ':\s*(\d+)') { return [long]$Matches[1] }
    throw "Cannot determine total length for $Url"
}

function Download-Zip {
    param(
        [string]$ApiUrl,
        [string]$FinalPath,
        [int]$ChunkCount
    )

    $tmpDir = Join-Path $env:TEMP ("loldl_" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
    try {
        Write-Output "Resolving download URL for $FinalPath ..."
        $url = Get-SignedUrl $ApiUrl
        $total = Get-TotalLength $url
        Write-Output ("Total size: " + $total + " bytes")

        if ($Aria2cPath) {
            Write-Output ("Using aria2c (resume + {0} connection(s)) ..." -f $Aria2Connections)
            $dir = Split-Path $FinalPath -Parent
            $name = Split-Path $FinalPath -Leaf
            & $Aria2cPath -x $Aria2Connections -s $Aria2Connections -k 2M -c `
                --file-allocation=none --max-tries=0 --retry-wait=5 `
                --timeout=15 --connect-timeout=15 `
                --auto-file-renaming=false --allow-overwrite=true `
                -d $dir -o $name $url
            if ($LASTEXITCODE -ne 0) { throw "aria2c failed with code $LASTEXITCODE" }
            if (-not (Test-Path $FinalPath)) { throw "aria2c produced no output file" }
            $aria2Ctrl = $FinalPath + ".aria2"
            if (Test-Path $aria2Ctrl) { Remove-Item -LiteralPath $aria2Ctrl -Force }
        } else {
            Write-Output "aria2c not found, falling back to curl parallel chunks ..."
            $chunkSize = [math]::Floor($total / $ChunkCount)
            $chunks = @()
            for ($i = 0; $i -lt $ChunkCount; $i++) {
                $start = $i * $chunkSize
                $end = if ($i -eq $ChunkCount - 1) { $total - 1 } else { $start + $chunkSize - 1 }
                $chunks += ,@($i, $start, $end)
            }

            $remaining = @()
            foreach ($c in $chunks) {
                $idx = $c[0]; $start = $c[1]; $end = $c[2]
                $chunkFile = Join-Path $tmpDir ("chunk_{0:D2}.bin" -f $idx)
                $remaining += ,@{ Index = $idx; Start = $start; End = $end; File = $chunkFile }
            }

            for ($attempt = 1; $attempt -le 3; $attempt++) {
                if ($remaining.Count -eq 0) { break }
                Write-Output ("Attempt {0}: downloading {1} chunks in parallel ..." -f $attempt, $remaining.Count)
                $jobs = @()
                foreach ($d in $remaining) {
                    $jobs += Start-Job -ArgumentList $url, $d.File, $d.Start, $d.End -ScriptBlock {
                        param($u, $out, $s, $e)
                        & curl.exe -sS -o $out --range "$s-$e" --max-time 3000 `
                            --retry 5 --retry-delay 3 --retry-all-errors -L $u 2>$null
                        exit $LASTEXITCODE
                    }
                }
                Wait-Job $jobs -Timeout 2400 | Out-Null
                foreach ($job in $jobs) {
                    Receive-Job $job | Out-Null
                    Remove-Job $job -Force
                }
                $bad = @()
                foreach ($d in $remaining) {
                    $expected = $d.End - $d.Start + 1
                    $len = if (Test-Path $d.File) { (Get-Item $d.File).Length } else { -1 }
                    if ($len -ne $expected) { $bad += $d }
                }
                if ($bad.Count -eq 0) { $remaining = @(); break }
                Write-Output ("Attempt {0}: {1} chunks incomplete, retrying ..." -f $attempt, $bad.Count)
                $remaining = $bad
                Start-Sleep -Seconds 2
            }
            if ($remaining.Count -gt 0) {
                throw "Incomplete chunks after 3 attempts: $($remaining.Index -join ',')"
            }

            Write-Output "Merging chunks -> $FinalPath"
            $dst = [System.IO.File]::Create($FinalPath)
            try {
                foreach ($c in $chunks) {
                    $idx = $c[0]
                    $chunkFile = Join-Path $tmpDir ("chunk_{0:D2}.bin" -f $idx)
                    $fs = [System.IO.File]::OpenRead($chunkFile)
                    try { $fs.CopyTo($dst) } finally { $fs.Dispose() }
                }
            }
            finally { $dst.Dispose() }
        }

        $finalLen = (Get-Item $FinalPath).Length
        if ($finalLen -ne $total) { throw "Size mismatch: $finalLen != $total" }

        Write-Output "Verifying zip archive ..."
        $verify = & tar.exe -tf $FinalPath 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Zip verification failed: $verify" }
        Write-Output ("Archive entries: " + ($verify.Count))
        $verify | Select-Object -First 30
        Write-Output ("OK: " + $FinalPath)
    }
    finally {
        Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$datasets = @(
    @{
        ApiUrl = "https://www.kaggle.com/api/v1/datasets/download/toofxd/lol-esports-match-data-from-oracleselixir"
        Out    = Join-Path $OutDir "oracleselixir_2014_2025.zip"
    },
    @{
        ApiUrl = "https://www.kaggle.com/api/v1/datasets/download/bwifterino/1-day-gmchall-euw-soloq-league-of-legends"
        Out    = Join-Path $OutDir "oracleselixir_2026.zip"
    }
)

foreach ($d in $datasets) {
    $aria2Ctrl = $d.Out + ".aria2"
    if (Test-Path $aria2Ctrl) {
        Write-Output ("Partial download with resume data found: " + $d.Out)
    } elseif (Test-Path $d.Out) {
        $ok = & tar.exe -tf $d.Out 2>&1
        if ($LASTEXITCODE -eq 0) {
            $csvCount = @(Get-ChildItem $OutDir -Filter "*_LoL_esports_match_data_from_OraclesElixir.csv" -ErrorAction SilentlyContinue).Count
            if ($csvCount -gt 0) {
                Write-Output ("Already exists and valid, skipping: " + $d.Out)
                continue
            }
            Write-Output ("Zip valid but CSVs missing, extracting: " + $d.Out)
            & tar.exe -xf $d.Out -C $OutDir
            if ($LASTEXITCODE -ne 0) { throw "Extract failed: $d.Out" }
            continue
        }
        Write-Output ("Existing file is damaged, re-downloading: " + $d.Out)
        Remove-Item -LiteralPath $d.Out -Force
    }
    $downloaded = $false
    for ($attempt = 1; $attempt -le 12 -and -not $downloaded; $attempt++) {
        try {
            Write-Output ("Dataset attempt {0}/12: {1}" -f $attempt, $d.Out)
            Download-Zip -ApiUrl $d.ApiUrl -FinalPath $d.Out -ChunkCount $Chunks
            $downloaded = $true
        }
        catch {
            Write-Output ("Attempt {0} failed: {1}" -f $attempt, $_.Exception.Message)
            if ($_.Exception.Message -match 'Size mismatch|Zip verification failed|Damaged') {
                $aria2Ctrl = $d.Out + ".aria2"
                if (Test-Path $aria2Ctrl) { Remove-Item -LiteralPath $aria2Ctrl -Force }
                if (Test-Path $d.Out) { Remove-Item -LiteralPath $d.Out -Force }
                Write-Output "Removed damaged file; next attempt starts fresh."
            } else {
                Write-Output "Keeping partial file for resume."
            }
            Start-Sleep -Seconds 5
        }
    }
    if (-not $downloaded) { throw ("Failed to download after 12 attempts: " + $d.Out) }

    Write-Output ("Extracting: " + $d.Out)
    & tar.exe -xf $d.Out -C $OutDir
    if ($LASTEXITCODE -ne 0) { throw "Extract failed: $d.Out" }
    $csvCount = @(Get-ChildItem $OutDir -Filter "*_LoL_esports_match_data_from_OraclesElixir.csv" -ErrorAction SilentlyContinue).Count
    if ($csvCount -eq 0) { throw "No CSV found after extraction: $d.Out" }
    Write-Output ("Extracted {0} CSV file(s). Keeping zip for future refreshes." -f $csvCount)
}

Write-Output "All downloads finished."
