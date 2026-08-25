# 让本地网站常驻运行（不依赖 Codex）

## 为什么会“关掉 Codex 网站就没了”

之前网站是用 `npm run dev` 在 Codex 会话里启动的，它是 Codex 的子进程。
Codex 一退出，整个进程树会被一起清理，所以网站跟着停。这不是安全机制，
只是“谁启动的进程就跟着谁走”。

## 现在的方案

本机需要两个 Windows 计划任务（若从未注册，请先看下方「首次注册」）：

- **LOLDadSite**（常驻服务）：登录时自动启动（AtLogOn），运行
  `scripts/start-server.ps1`，内部用“无控制台窗口”方式拉起 `next start`；
  不限运行时长。
- **LOLDadSiteWatchdog**（看门狗）：每 2 分钟检查一次 127.0.0.1:3000，
  发现网站挂了就自动重新拉起 LOLDadSite。
- 访问地址：http://127.0.0.1:3000 （仅本机）

## 首次注册

如果 `schtasks /query /tn LOLDadSite` 报“找不到”，说明任务还没注册
（网站会随任何进程退出而停止，看门狗也无法拉起它）。用**管理员 PowerShell**
运行一次：

```powershell
cd 项目根目录
powershell -ExecutionPolicy Bypass -File scripts\register-tasks.ps1
```

脚本会注册两个任务并立即启动网站；之后登录自启 + 看门狗每 2 分钟兜底。

因为进程由 Windows 任务计划服务（svchost.exe）拉起，**不受 Codex 开关影响**；
关掉 Codex、甚至重启电脑后重新登录，它都会自动恢复。

> 正常情况完全不需要手动操作：登录时自动起，之后由看门狗兜底（最坏约 2 分钟内自愈）。

## 手动控制

```powershell
# 立即启动（仅在你手动停过之后才需要）
schtasks /run /tn LOLDadSite

# 停止常驻服务（看门狗会在 2 分钟内再拉起，想彻底停见下面“禁用”）
schtasks /end /tn LOLDadSite

# 暂时禁用常驻服务（下次登录不再自启）
Disable-ScheduledTask -TaskName LOLDadSite

# 重新启用
Enable-ScheduledTask -TaskName LOLDadSite

# 同时禁用看门狗
Disable-ScheduledTask -TaskName LOLDadSiteWatchdog
Enable-ScheduledTask -TaskName LOLDadSiteWatchdog

# 彻底删除两个任务
Unregister-ScheduledTask -TaskName LOLDadSite -Confirm:$false
Unregister-ScheduledTask -TaskName LOLDadSiteWatchdog -Confirm:$false
```

## 日志

常驻服务以“无控制台窗口”方式运行，输出不落盘（稳定性优先）。
如需日志，可以手动前台运行：

```powershell
node node_modules\next\dist\bin\next start -H 127.0.0.1 -p 3000
```

## 改端口 / 局域网访问

编辑 `scripts/start-server.ps1`：

- 端口：改 `$port`
- 允许手机/平板在同一 Wi-Fi 下访问：把 `$listenHost` 改成 `'0.0.0.0'`，
  然后访问 `http://<本机局域网IP>:3000`（注意：这会把网站暴露给局域网内其他设备）。

改完脚本后需要重启任务才生效：

```powershell
Stop-ScheduledTask -TaskName LOLDadSite
Start-ScheduledTask -TaskName LOLDadSite
```

## 注意

该任务使用「仅在用户登录时运行」，所以**注销 Windows 后网站会停**；
下次登录会自动再启动。这符合“本机网站”的预期，无需开机前（无登录）也能访问。
