$ErrorActionPreference = "Stop"

$startupDirectory = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDirectory "Copanalhas Bot.lnk"

if (Test-Path $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath
  Write-Host "Removed Startup shortcut:"
  Write-Host $shortcutPath
} else {
  Write-Host "No Startup shortcut found:"
  Write-Host $shortcutPath
}
