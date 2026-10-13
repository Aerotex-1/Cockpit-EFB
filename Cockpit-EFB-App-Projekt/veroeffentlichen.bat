@echo off
rem Neue EFB-Version als GitHub-Release hochladen (braucht die GitHub-CLI "gh", einmal "gh auth login").
set /p VER=Versionsnummer (z. B. 1.1.8):
set /p ZIP=Pfad zur ZIP (z. B. Cockpit-EFB-%VER%.zip):
set /p NOTES=Kurze Beschreibung der Aenderungen:
gh release create v%VER% "%ZIP%" --title "EFB %VER%" --notes "%NOTES%"
pause
