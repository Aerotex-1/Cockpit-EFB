@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Stimme erzeugen
if not exist venv\Scripts\python.exe (
  echo Bitte zuerst "setup.bat" ausführen.
  pause
  exit /b 1
)
venv\Scripts\python.exe make_voice_pack.py %*
echo.
pause
