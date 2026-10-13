@echo off
title Flughafendaten aktualisieren
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js ist nicht installiert. Bitte von https://nodejs.org die LTS-Version installieren.
  pause
  exit /b
)
node tools\import-ourairports.js
pause
