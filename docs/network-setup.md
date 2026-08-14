# 本机网络/代理配置（2026-08-14 固化 · V3 按需连接）

## 结论

本机通过 **快车VPN 2.0**（FlClash 内核，安装于 `C:\Program Files\快车VPN\`）提供翻墙能力。当前策略为 **按需连接、全局生效**：

- **正常对话不自动连接 VPN**：不开 VPN 也能正常使用 Codex（直连）；系统代理随端口状态自动开关，不会指向死端口。
- **访问境外资源时才连接**：先运行 `C:\Users\ASUS\.codex\tools\ensure-proxy.ps1`（提权），按需启动 VPN 并等待 `127.0.0.1:7890` 就绪。
- **用户手动开的 VPN 不受影响**：只要不是由 ensure-proxy 启动（无标记文件），监视进程绝不关闭它。
- **已移除用户级代理环境变量**：`HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` 已从用户环境删除（曾导致 VPN 关闭时所有流量被导向死端口、Codex 反复重连）；需要代理时显式 `-x http://127.0.0.1:7890`。
- **已移除开机自启**：注册表 `HKCU\...\Run\快车VPN` 已删除，应用内 `autoLaunch=false`（保留 `autoRun=true`，被拉起后自动连接）。
- **固定节点「香港·直连」**（`202.155.155.14:444`）：此前「自动选择」会落到 Cloudflare 中转节点，延迟低但 HTTPS 大文件卡死；切到直连节点后 Google 下载约 660KB/s，普通 HTTP 约 300KB/s。

## VPN 按需连接机制

- 常驻脚本：`C:\Users\ASUS\.codex\tools\codex-vpn-sync.ps1`（项目内 `tools/codex-vpn-sync.ps1` 为同步副本），由计划任务 `CodexVPNSync` 启动（登录自动运行、隐藏窗口、无执行时限），每 8 秒轮询：
  - **系统代理随端口状态维护**：7890 在监听 → `ProxyEnable=1`、`ProxyServer=127.0.0.1:7890`；7890 不在监听 → `ProxyEnable=0`（Codex 直连，不重连死端口）。
  - **不自动启动 VPN**：正常对话保持关闭；外网需求由 ensure-proxy 触发。
  - 仅当存在“按需启动标记”`C:\Users\ASUS\.codex\vpn-agent-started.flag`（ensure-proxy 启动 VPN 时写入）且 Codex 退出超过 120 秒时，才关闭 VPN 并删除标记；**无标记的 VPN（用户手动开的）绝不干预**。
- 触发连接：`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\ASUS\.codex\tools\ensure-proxy.ps1`（需提权）。成功输出 `PROXY=http://127.0.0.1:7890` 并退出码 0；失败退出码 1。
- 任务管理：`Start-ScheduledTask -TaskName CodexVPNSync` / `Stop-ScheduledTask -TaskName CodexVPNSync` / `Get-ScheduledTask -TaskName CodexVPNSync`。
- 日志：`C:\Users\ASUS\.codex\logs\codex-vpn-sync.log`（超过 512KB 自动截断）。

## 已知注意点

- **改完代理相关设置后，已运行的 Codex 进程不会重新读取环境变量**（进程环境只在启动时继承）：需**完全退出并重启 Codex 应用**才生效。
- 快车VPN 客户端存在自愈/守护行为（关掉后可能自动重启）：若想彻底保持关闭，请在客户端界面正常退出；若仍自动起来，可检查 `FlClashHelperService`。
- 流量剩余约 17GB（订阅制），大文件下载注意用量；项目内 `scripts/fetch-data.ps1` 已用多连接并行下载。
- 若某站点（如 github.com）偶发超时，多为节点瞬时抖动，重试或切换节点即可。
- 沙箱内命令默认网络受限，访问境外站点需 `require_escalated` 提权；提权后 curl 需显式 `-x http://127.0.0.1:7890`。

## 日常检查

```powershell
# 代理是否监听
netstat -ano | Select-String ':7890 .*LISTENING'

# 系统代理是否开启（应与端口状态一致）
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' |
  Select-Object ProxyEnable, ProxyServer

# 通过代理连通性自检（VPN 开启时）
curl.exe -s -o NUL -w "%{http_code}" -x http://127.0.0.1:7890 https://www.gstatic.com/generate_204
```

## Agent 自动使用约定

1. **访问境外资源前**先运行（提权）：`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\ASUS\.codex\tools\ensure-proxy.ps1`；若代理已就绪会直接复用，不重复启动。
2. 脚本输出 `PROXY=http://127.0.0.1:7890` 即成功，之后：
   - `curl.exe` 显式加 `-x http://127.0.0.1:7890`；
   - `Invoke-WebRequest` / 浏览器等直接可用（系统代理已开启）。
3. 若等待超时：提示用户打开快车VPN 界面检查登录态/节点，再重试。
4. 正常对话、国内镜像下载**不需要** VPN，也不需要跑 ensure-proxy。
