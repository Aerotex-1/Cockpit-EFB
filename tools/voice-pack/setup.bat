@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Stimmen-Werkzeug einrichten
echo Einmalige Einrichtung (ca. 3 GB Download, dauert einige Minuten).
set PY=
py -3.11 --version >nul 2>&1 && set PY=py -3.11
if "%PY%"=="" py -3.12 --version >nul 2>&1 && set PY=py -3.12
if "%PY%"=="" py -3.10 --version >nul 2>&1 && set PY=py -3.10
if "%PY%"=="" (
  echo Python 3.11 wurde nicht gefunden. Bitte von https://www.python.org/downloads/ installieren ^(Haken "Add python.exe to PATH" setzen^) und diese Datei nochmal starten.
  pause
  exit /b 1
)
if not exist venv %PY% -m venv venv
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install "torch==2.8.*" "torchaudio==2.8.*" coqui-tts soundfile
if errorlevel 1 (
  echo Die Installation ist fehlgeschlagen. Bitte den Text oben kopieren und an den Entwickler schicken.
  pause
  exit /b 1
)
echo.
echo Fertig. Als Nächstes Aufnahmen in den Ordner "aufnahmen" legen und "stimme-erzeugen.bat" starten.
pause
