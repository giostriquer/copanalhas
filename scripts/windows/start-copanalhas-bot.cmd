@echo off
setlocal

set "REPO_ROOT=%~dp0..\.."
pushd "%REPO_ROOT%" >nul

title Copanalhas Bot
echo Starting Copanalhas Discord bot...
echo Repository: %CD%
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found in PATH. Install Node.js or open this launcher from a shell where npm works.
  echo.
  pause
  popd >nul
  exit /b 1
)

if not exist ".env" (
  echo .env was not found in %CD%.
  echo Create it from .env.example before starting the bot.
  echo.
  pause
  popd >nul
  exit /b 1
)

if not exist "node_modules" (
  echo node_modules was not found. Run npm install in this repository first.
  echo.
  pause
  popd >nul
  exit /b 1
)

npm run dev -- bot
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo Copanalhas bot exited with code %EXIT_CODE%.
) else (
  echo Copanalhas bot stopped.
)
echo Press any key to close this window.
pause >nul

popd >nul
exit /b %EXIT_CODE%
