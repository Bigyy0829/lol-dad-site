# codex-vpn-sync.ps1 - 快车VPN 按需连接生命周期（v2）
#
# 背景与规则：
#   1. Codex 未运行时，用户手动打开的 VPN 不受影响（本脚本绝不干预）。
#   2. 正常对话不自动连接 VPN；只有通过 ensure-proxy.ps1 按需启动时才连接。
#   3. 经 ensure-proxy 启动的 VPN（有状态标记），在 Codex 退出并超过宽限后
#      由本脚本关闭，避免闲置流量；关闭后删除标记。
#   4. 本脚本由计划任务 CodexVPNSync 常驻（登录启动、隐藏窗口、无执行时限）。
#
# 参数：
#   -ProcessName           检测的进程名（默认 codex；测试可换假名模拟退出）
#   -PollSeconds           轮询间隔秒数（默认 8）
#   -ShutdownGraceSeconds  Codex 消失后关闭“按需启动”VPN 的宽限（默认 120；测试可设 0）
#   -StateFile             ensure-proxy 写入的按需启动标记
#                          （默认 C:\Users\ASUS\.codex\vpn-agent-started.flag）
#   -LogFile               日志路径（默认 C:\Users\ASUS\.codex\logs\codex-vpn-sync.log）
#   -Once                  只执行一轮（测试/手动同步用）

param(
    [string]$ProcessName = 'codex',
    [int]$PollSeconds = 8,
    [int]$ShutdownGraceSeconds = 120,
    [string]$StateFile = 'C:\Users\ASUS\.codex\vpn-agent-started.flag',
    [string]$LogFile = 'C:\Users\ASUS\.codex\logs\codex-vpn-sync.log',
    [switch]$Once
)

$ErrorActionPreference = 'SilentlyContinue'

function Write-Log($msg) {
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
    Write-Output $line
    $logDir = Split-Path -Parent $LogFile
    if (-not (Test-Path -LiteralPath $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
    if ((Get-Item -LiteralPath $LogFile -ErrorAction SilentlyContinue).Length -gt 512KB) {
        $lines = @(Get-Content -LiteralPath $LogFile -ErrorAction SilentlyContinue)
        if ($lines.Count -gt 400) {
            $lines | Select-Object -Skip 200 | Set-Content -LiteralPath $LogFile -Encoding UTF8
        }
    }
}

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

function Stop-Vpn {
    $found = $false
    foreach ($name in @('kuaicheVPN', 'FlClashCore')) {
        if (Get-Process -Name $name -ErrorAction SilentlyContinue) {
            Stop-Process -Name $name -Force -ErrorAction SilentlyContinue
            $found = $true
            Write-Log "Stopped $name"
        }
    }
    Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' `
        -Name ProxyEnable -Value 0 -ErrorAction SilentlyContinue
    return $found
}

Write-Log "codex-vpn-sync v2 started (ProcessName=$ProcessName, Poll=$PollSeconds, Grace=$ShutdownGraceSeconds)"

$goneSince = $null
while ($true) {
    $codexRunning = [bool](Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
    $proxyUp = Test-ProxyPort
    $agentStarted = Test-Path -LiteralPath $StateFile

    if ($codexRunning) {
        $goneSince = $null
        if ($proxyUp) {
            # 代理在监听：确保系统代理开关与地址正确（客户端重连时可能短暂重置）
            Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' `
                -Name ProxyEnable -Value 1 -ErrorAction SilentlyContinue
            Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' `
                -Name ProxyServer -Value '127.0.0.1:7890' -ErrorAction SilentlyContinue
        } else {
            # 端口不可用：立即关闭系统代理，避免 Codex 等应用反复重连死端口
            Set-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' `
                -Name ProxyEnable -Value 0 -ErrorAction SilentlyContinue
        }
        # 不做自动启动：正常对话不消耗流量，外网需求由 ensure-proxy.ps1 按需触发
    } else {
        $vpnRunning = [bool](Get-Process -Name 'kuaicheVPN', 'FlClashCore' -ErrorAction SilentlyContinue)
        if (-not $vpnRunning) {
            if ($agentStarted) {
                Write-Log 'Stale agent-start flag without VPN process; removing flag.'
                Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue
            }
            $goneSince = $null
        } elseif (-not $agentStarted) {
            # 用户手动开的 VPN：不干预，保持原样
            $goneSince = $null
        } else {
            if ($null -eq $goneSince) {
                $goneSince = Get-Date
                Write-Log "$ProcessName not running; agent-started VPN still up, grace $ShutdownGraceSeconds s."
            }
            $elapsed = ((Get-Date) - $goneSince).TotalSeconds
            if ($elapsed -ge $ShutdownGraceSeconds) {
                Write-Log "$ProcessName gone for $([math]::Round($elapsed)) s -> closing agent-started VPN."
                Stop-Vpn | Out-Null
                Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue
                $goneSince = $null
            }
        }
    }

    if ($Once) { break }
    Start-Sleep -Seconds $PollSeconds
}

Write-Log 'One-shot pass finished.'
