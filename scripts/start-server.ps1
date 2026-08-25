# Keep this file ASCII-only so Windows PowerShell 5.1 parses it correctly
# regardless of system locale.
#
# Run the site in production mode with NO console window (CreateNoWindow),
# so the process cannot be killed by a console-close / Ctrl+C event.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot   # parent of scripts\ = project root
Set-Location -LiteralPath $root

$listenHost = "127.0.0.1"
$port = "3000"

# If the port is already served, do nothing (watchdog safety).
$probe = New-Object System.Net.Sockets.TcpClient
$alreadyUp = $false
try {
    $ar = $probe.BeginConnect($listenHost, [int]$port, $null, $null)
    if ($ar.AsyncWaitHandle.WaitOne(1200)) {
        $probe.EndConnect($ar)
        $alreadyUp = $true
    }
} catch {
    $alreadyUp = $false
} finally {
    $probe.Close()
}
if ($alreadyUp) { exit 0 }

$nodeCandidates = @(
    "D:\node.js\node.exe",
    (Get-Command node -ErrorAction SilentlyContinue).Source
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

$node = $nodeCandidates | Select-Object -First 1
if (-not $node) { throw "node.exe not found." }

$nextBin = Join-Path $root "node_modules\next\dist\bin\next"
if (-not (Test-Path -LiteralPath $nextBin)) { throw "Next.js not found." }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $node
$psi.Arguments = '"' + $nextBin + '" start -H ' + $listenHost + ' -p ' + $port
$psi.WorkingDirectory = $root
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true

$p = [System.Diagnostics.Process]::Start($psi)
$p.WaitForExit()
exit $p.ExitCode
