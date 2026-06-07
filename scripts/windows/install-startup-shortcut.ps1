$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$launcher = Join-Path $repoRoot "scripts\windows\start-copanalhas-bot.cmd"
$startupDirectory = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDirectory "Copanalhas Bot.lnk"

if (-not (Test-Path $launcher)) {
  throw "Launcher not found: $launcher"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $repoRoot
$shortcut.Description = "Start the Copanalhas Discord bot on Windows login"
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,25"
$shortcut.Save()

Write-Host "Created Startup shortcut:"
Write-Host $shortcutPath
Write-Host ""
Write-Host "The bot will open in a console window the next time you log into Windows."
