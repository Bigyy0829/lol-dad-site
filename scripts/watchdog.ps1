# Keep this file ASCII-only.
# If the site is not responding on 127.0.0.1:3000, start the server task.

$ErrorActionPreference = "SilentlyContinue"

$up = $false
$c = New-Object System.Net.Sockets.TcpClient
try {
    $ar = $c.BeginConnect("127.0.0.1", 3000, $null, $null)
    if ($ar.AsyncWaitHandle.WaitOne(1500)) {
        $c.EndConnect($ar)
        $up = $true
    }
} catch {
    $up = $false
} finally {
    $c.Close()
}

if (-not $up) {
    schtasks /run /tn LOLDadSite
}
