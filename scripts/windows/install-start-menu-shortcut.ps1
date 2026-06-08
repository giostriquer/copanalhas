$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$launcher = Join-Path $repoRoot "scripts\windows\start-copanalhas-bot.cmd"
$shortcutDirectory = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$shortcutPath = Join-Path $shortcutDirectory "Copanalhas Bot.lnk"

if (-not (Test-Path $launcher)) {
  throw "Launcher not found: $launcher"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = "Start the Copanalhas Discord bot"
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,25"
$shortcut.Save()

Write-Host "Created Start Menu shortcut:"
Write-Host $shortcutPath
Write-Host ""
Write-Host "Open Start and search for 'Copanalhas Bot'. You can right-click it and pin it to Start."
