# Register the two scheduled tasks that keep the site alive:
#   LOLDadSite           - starts `next start` at logon (no console window)
#   LOLDadSiteWatchdog   - checks 127.0.0.1:3000 every 2 minutes and restarts
#
# Run this once from an ADMIN PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\register-tasks.ps1
#
# Keep this file ASCII-only where possible so Windows PowerShell 5.1 parses it.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$action1 = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$root\scripts\start-server.ps1`""
$trigger1 = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName "LOLDadSite" -Action $action1 -Trigger $trigger1 -Description "LOL dad site - persistent next start" -Force
Write-Host "Registered LOLDadSite"

$action2 = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$root\scripts\watchdog.ps1`""
$trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 2)
Register-ScheduledTask -TaskName "LOLDadSiteWatchdog" -Action $action2 -Trigger $trigger2 -Description "LOL dad site - watchdog every 2 min" -Force
Write-Host "Registered LOLDadSiteWatchdog"

Start-ScheduledTask -TaskName "LOLDadSite"
Write-Host "Started LOLDadSite (watchdog will take over from here)"
