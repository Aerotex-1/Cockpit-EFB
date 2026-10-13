@echo off
title Cockpit EFB
set EFB_LAUNCHER=bat
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js ist nicht installiert. Bitte von https://nodejs.org die LTS-Version installieren.
  pause
  exit /b
)
if not exist node_modules\node-simconnect (
  echo Installiere SimConnect-Bibliothek ...
  call npm install
)

:run
node server.js
if %errorlevel%==42 (
  echo Update wird angewendet, starte neu ...
  call npm install --no-audit --no-fund --loglevel=error
  goto run
)
pause
