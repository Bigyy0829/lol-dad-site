# ensure-proxy.ps1 - 按需启动快车VPN并等待本地代理 7890 可用（v2）
#
# 设计：正常对话不自动连接 VPN；只有访问境外资源前调用本脚本才连接。
#  - 代理已就绪：直接复用（不重复启动，也不写“按需启动”标记）。
#  - 本脚本真正启动 VPN 并等到 7890 就绪：写入标记文件
#    C:\Users\ASUS\.codex\vpn-agent-started.flag，供 codex-vpn-sync.ps1
#    在 Codex 退出且超过宽限后自动关闭本次连接；用户手动开的 VPN 不受影响。
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\ASUS\.codex\tools\ensure-proxy.ps1
# 成功时输出 PROXY=http://127.0.0.1:7890 并退出码 0；失败退出码 1。

param(
    [int]$WaitSeconds = 120,
    [string]$StateFile = 'C:\Users\ASUS\.codex\vpn-agent-started.flag'
)

$proxyUrl = 'http://127.0.0.1:7890'
$vpnExe = 'C:\Program Files\快车VPN\kuaicheVPN.exe'

function Test-ProxyPort {
    $c = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $c.BeginConnect('127.0.0.1', 7890, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(1500)) {
            $c.EndConnect($iar)
            return $true
        }
    } catch { }
    finally { $c.Dispose() }
    return $false
}

if (Test-ProxyPort) {
    Write-Output "PROXY=$proxyUrl (already running)"
    exit 0
}

Write-Output 'Proxy 7890 not listening; starting 快车VPN...'
if (-not (Test-Path -LiteralPath $vpnExe)) {
    Write-Error "VPN client not found: $vpnExe"
    exit 1
}

Start-Process -FilePath $vpnExe -WorkingDirectory (Split-Path -Parent $vpnExe)

$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    if (Test-ProxyPort) {
        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' `
            -Name ProxyEnable -Value 1 -ErrorAction SilentlyContinue
        Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' `
            -Name ProxyServer -Value '127.0.0.1:7890' -ErrorAction SilentlyContinue
        # 记录“本次连接由代理流程按需启动”，Codex 退出后由监视进程关闭
        $flagDir = Split-Path -Parent $StateFile
        if (-not (Test-Path -LiteralPath $flagDir)) {
            New-Item -ItemType Directory -Path $flagDir -Force | Out-Null
        }
        Set-Content -LiteralPath $StateFile -Value (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') `
            -Encoding UTF8 -ErrorAction SilentlyContinue
        Write-Output "PROXY=$proxyUrl (started)"
        exit 0
    }
    Write-Output ("waiting for proxy... {0:N0}s left" -f ($deadline - (Get-Date)).TotalSeconds)
}

Write-Error 'Timeout: proxy 7890 did not come up. Open 快车VPN and check login/node state.'
exit 1
