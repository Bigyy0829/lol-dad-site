param(
    [string]$Proxy = "",
    [string]$OutDir = "data/raw",
    [string]$Years = "2014,2015,2016,2017,2018,2019,2025,2026"
)

# Download official Oracle's Elixir yearly CSVs from Google Drive.
# Optional HTTP proxy (e.g. -Proxy "http://127.0.0.1:7890" for restricted
# networks); empty means direct connection. Resumes partial files; validates
# the CSV header.
$ErrorActionPreference = "Continue"
$ROOT = Split-Path $PSScriptRoot -Parent
$OutDirFull = Join-Path $ROOT $OutDir
New-Item -ItemType Directory -Force -Path $OutDirFull | Out-Null

$ProxyArgs = @()
if ($Proxy) { $ProxyArgs = @("-x", $Proxy) }

$FileIds = @{
    "2014" = "12syQsRH2QnKrQZTQQ6G5zyVeTG2pAYvu"
    "2015" = "1qyckLuw0-hJM8XqFhlV9l1xAbr3H78T_"
    "2016" = "1muyfpaIqk8_0BFkgLCWXDGNgWSXoPBwG"
    "2017" = "11fx3nNjSYB0X8vKxLAbYOrS2Bu6avm9A"
    "2018" = "1GsNetJQOMx0QJ6_FN8M1kwGvU_GPPcPZ"
    "2019" = "11eKtScnZcpfZcD3w3UrD7nnpfLHvj9_t"
    "2020" = "1dlSIczXShnv1vIfGNvBjgk-thMKA5j7d"
    "2021" = "1fzwTTz77hcnYjOnO9ONeoPrkWCoOSecA"
    "2022" = "1EHmptHyzY8owv0BAcNKtkQpMwfkURwRy"
    "2023" = "1XXk2LO0CsNADBB1LRGOV5rUpyZdEZ8s2"
    "2024" = "1IjIEhLc9n8eLKeY-yh_YigKVWbhgGBsN"
    "2025" = "1v6LRphp2kYciU4SXp0PCjEMuev1bDejc"
    "2026" = "1hnpbrUpBMS1TZI7IovfpKeZfWJH1Aptm"
}

$yearList = $Years -split '[,\s]+' |
    Where-Object { $_ -and $FileIds.ContainsKey($_) }

function Test-CsvOk {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    $len = (Get-Item $Path).Length
    if ($len -lt 1000000) { return $false }
    $head = Get-Content $Path -TotalCount 1 -ErrorAction SilentlyContinue
    return ($head -like 'gameid,*')
}

function Get-TotalSize {
    param([string]$FileId)
    $uc = "https://drive.google.com/uc?export=download&id=$FileId&confirm=t"
    $hdr = curl.exe -sS -D - -o NUL @ProxyArgs --max-time 30 $uc 2>$null
    $loc = ($hdr | Select-String -Pattern '^Location:' | Select-Object -First 1).Line
    if (-not $loc) { throw "No redirect from Drive for $FileId" }
    $url = ($loc -replace '^Location:\s*', '' -replace '[\r\n]', '').Trim()
    $r = curl.exe -sS -D - -o NUL @ProxyArgs --range 0-0 --max-time 30 $url 2>$null
    $cr = ($r | Select-String -Pattern '^Content-Range:' | Select-Object -First 1).Line
    if ($cr -match '/(\d+)\s*$') { return [long]$Matches[1] }
    $cl = ($r | Select-String -Pattern '^Content-Length:' | Select-Object -First 1).Line
    if ($cl -match ':\s*(\d+)') { return [long]$Matches[1] }
    throw "Cannot determine total size for $FileId"
}

foreach ($year in $yearList) {
    $id = $FileIds[$year]
    $name = "${year}_LoL_esports_match_data_from_OraclesElixir.csv"
    $out = Join-Path $OutDirFull $name

    $total = Get-TotalSize $id
    Write-Output "[$year] server size: $total bytes"

    if ((Test-CsvOk $out) -and ((Get-Item $out).Length -eq $total)) {
        Write-Output "[$year] already complete ($total bytes), skipping"
        continue
    }
    if (Test-Path $out) {
        Write-Output ("[$year] existing partial ({0} bytes), resuming..." -f (Get-Item $out).Length)
    }

    $ok = $false
    for ($attempt = 1; $attempt -le 6 -and -not $ok; $attempt++) {
        $url = "https://drive.google.com/uc?export=download&id=$id&confirm=t"
        Write-Output "[$year] attempt $attempt/6 downloading ..."
        & curl.exe -sS -L -C - @ProxyArgs --connect-timeout 15 --max-time 600 `
            --speed-limit 2048 --speed-time 30 `
            --retry 5 --retry-delay 5 --retry-all-errors -o $out $url 2>$null
        $code = $LASTEXITCODE
        if ((Test-CsvOk $out) -and ((Get-Item $out).Length -eq $total)) {
            Write-Output "[$year] OK: $((Get-Item $out).Length) bytes (matches server)"
            $ok = $true
            continue
        }
        if ($code -ne 0) {
            Write-Output "[$year] curl exit code $code"
            Start-Sleep -Seconds 4
            continue
        }
        if ((Test-CsvOk $out) -and ((Get-Item $out).Length -eq $total)) {
            $len = (Get-Item $out).Length
            Write-Output "[$year] OK: $len bytes (matches server)"
            $ok = $true
        } else {
            $len = if (Test-Path $out) { (Get-Item $out).Length } else { 0 }
            Write-Output "[$year] incomplete ($len/$total bytes), retrying"
            Start-Sleep -Seconds 4
        }
    }
    if (-not $ok) {
        Write-Output "[$year] FAILED after 6 attempts"
        exit 1
    }
}

Write-Output "ALL_DONE"
