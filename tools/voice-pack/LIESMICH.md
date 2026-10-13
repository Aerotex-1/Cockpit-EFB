# Eigene Stimme für das Bodenpersonal (Stimmen-Werkzeug)

Aus deinen Aufnahmen erzeugt dieses Werkzeug eine nachgebildete Stimme und spricht damit die Sätze des Bodenpersonals vorab ein
(„Roger“, „Pushback approved“, „Boarding complete“ …). Die Dateien landen im Ordner `sounds` der Cockpit-EFB und werden dort
wie deine eigenen MP3s abgespielt. Alles läuft auf deinem PC, es wird nichts hochgeladen (nur beim ersten Start lädt das Modell, ca. 1,8 GB, von Hugging Face).

## Wichtig vorab
- Verwende nur Stimmen, die du verwenden darfst: deine eigene, die einer Person, die zugestimmt hat, oder eine Aufnahme mit passender Lizenz.
- Das Modell (XTTS-v2, Coqui Public Model License) darf nur nicht-kommerziell genutzt werden. Die erzeugten Dateien gehören nicht in die veröffentlichte EFB-ZIP.
- Ohne NVIDIA-Grafikkarte läuft es auf dem Prozessor: einige Sekunden bis eine Minute pro Satz, für alle Sätze insgesamt etwa 10 bis 40 Minuten. Das ist einmalig.

## Einrichten (einmalig)
1. Python 3.11 von https://www.python.org/downloads/ installieren (Haken „Add python.exe to PATH“).
2. `setup.bat` doppelklicken und warten, bis „Fertig“ erscheint (ca. 3 GB Download).

## Stimme erzeugen
1. Lege deine Aufnahmen in den Ordner `aufnahmen` (zusammen 15–60 Sekunden, nur eine Sprecherin oder ein Sprecher, ohne Musik und Rauschen, am besten WAV).
2. `stimme-erzeugen.bat` doppelklicken, den Bedingungen mit „j“ zustimmen. Das Fenster zeigt den Fortschritt.
3. Fertig: Die EFB erkennt die Sounds nach spätestens einer Minute. In der App unter Copilot → „Eigene Sounds“ siehst du die Dateien nicht einzeln, sie werden aber automatisch benutzt, sofern der Name zum Ereignis passt (z. B. `boarding.done.wav`).

Zielordner ist standardmäßig `%APPDATA%\cockpit-efb-app\efb\sounds`. Anderer Ordner: `stimme-erzeugen.bat --out "C:\Pfad\zu\sounds"`.

## Eigene Sätze und Pushback-Punkte
- Zusätzliche Sätze: `stimme-erzeugen.bat --add "pushback.ack.R2=Pushback approved, Romeo Two."`
  Der Name vor dem `=` ist der Dateiname und damit das Ereignis (Regeln wie bei eigenen MP3s: `pushback.ack.<Punkt>` mit dem markanten Teil des GSX-Menünamens ohne Striche, z. B. `C328` für „LFRN_C3-28“; optional `.north/.south/.east/.west`).
- Alle Standardsätze stehen in `phrases.json` und lassen sich dort ändern. Vorhandene Dateien werden nicht überschrieben; mit `--force` werden sie neu erzeugt, mit `--only boarding` nur passende Sätze.
- Sprache der Sätze: `--lang de` (auch Deutsch kann XTTS).

## Tipps für gute Qualität
- Saubere Aufnahme, gleichmäßige Lautstärke, normale Sprechweise, kein Hall.
- Lieber 3–5 Aufnahmen à 10 s als eine sehr kurze.
- Klingt es schlecht, andere Aufnahmen verwenden und mit `--force` neu erzeugen.
- Nicht erzeugte Sätze (z. B. ungewöhnliche GSX-Menütexte) spricht weiter die eingebaute Computerstimme.
