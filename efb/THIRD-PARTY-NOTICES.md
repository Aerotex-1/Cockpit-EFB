# Drittanbieter und Quellen

Cockpit EFB steht in keiner Verbindung zu den hier genannten Firmen und Projekten. Alle Namen und Marken gehören ihren Inhabern. Sie werden nur genannt, um zu beschreiben, womit die Software zusammenarbeitet.

## Im Paket enthalten

| Bestandteil | Lizenz | Hinweis |
|---|---|---|
| Leaflet 1.9.4 (`public/lib/leaflet`) | BSD-2-Clause | © 2010-2023 Vladimir Agafonkin, © 2010-2011 CloudMade. Lizenztext: `public/lib/leaflet/LICENSE` |
| EFB-API aus dem MSFS-SDK (`community/`, `efb-app/`) | MIT | © Asobo Studio. Der Lizenztext liegt dem SDK bei und muss bei einer Weitergabe mitgeliefert werden |
| node-simconnect (wird per `npm install` geladen) | MIT | Siehe das Paket selbst |

## Wird zur Laufzeit vom PC des Nutzers geladen (nicht mitgeliefert)

| Quelle | Bedingungen |
|---|---|
| OpenStreetMap-Kacheln und Daten (Bodenkarte über Overpass) | © OpenStreetMap-Mitwirkende, ODbL. Die öffentlichen Kartenserver erlauben nur maßvolle Nutzung (Tile Usage Policy). Für starke Nutzung eigenen Kartendienst eintragen (`tileUrl`, `tileKey` in `config.json`) |
| Kartenkacheln von CARTO (Voyager, Positron) | © OpenStreetMap-Mitwirkende © CARTO. Kostenlos für nicht-kommerzielle Nutzung mit Namensnennung; es gelten die Nutzungsbedingungen von CARTO. |
| OpenTopoMap (wählbar) | © OpenStreetMap-Mitwirkende, SRTM | © OpenTopoMap (CC-BY-SA 3.0). Nur maßvolle Nutzung. |
| Open-Meteo (Wind, Wolken) | CC BY 4.0, kostenlos für nicht-kommerzielle Nutzung, Namensnennung nötig |
| RainViewer (Wetter-Radar) | Die kostenlose Schnittstelle ist laut RainViewer nur für persönliche, Bildungs- und kleine Community-Projekte gedacht. Namensnennung „Weather data by RainViewer“ mit Link nötig |
| VATSIM-Datenfeed, VATSpy-Datenprojekt (FIR-Grenzen) | Nutzungsbedingungen von VATSIM bzw. des Projekts (VATSIM hat eine eigene Richtlinie zur kommerziellen Nutzung seiner Daten; Cockpit EFB ist kostenlos und nicht kommerziell). Der Feed wird höchstens alle 15 Sekunden abgefragt |
| SimBrief | Nur mit dem eigenen Konto des Nutzers |
| OurAirports (optional, `import-airports.bat`) | Public Domain |
| Spotify Web API | Entwicklerbedingungen von Spotify. Jeder Nutzer legt seine eigene Spotify-App an |

## Variablen anderer Add-ons

Die Namen der Sim-Variablen für FlyByWire (A32NX, A380X), Headwind (A339X), Fenix und GSX stammen aus deren öffentlich einsehbarem Quellcode bzw. aus beobachtetem Verhalten. Es wird kein Code dieser Projekte mitgeliefert.

## Piper und eSpeak NG (Sprachausgabe der Windows-App)

Der Installer enthält Piper (https://github.com/rhasspy/piper, MIT-Lizenz, Version 2023.11.14-2) als eigenständiges Programm. Das Paket bringt eSpeak NG (https://github.com/espeak-ng/espeak-ng, **GPL-3.0**) für die Aussprache mit. eSpeak NG ist ein getrenntes Programm, der Quelltext liegt unter dem genannten Link; Lizenztext: https://www.gnu.org/licenses/gpl-3.0.html. Der Quelltext von Cockpit EFB selbst bleibt unter MIT.

Die Stimmmodelle (https://huggingface.co/rhasspy/piper-voices) werden **nicht mitgeliefert**: Die App lädt sie auf Wunsch auf dem PC des Nutzers von Hugging Face. Jede Stimme hat ihre eigene Lizenz (siehe Modellkarte der Stimme dort).

## Windows-App (Electron)

Die Windows-App basiert auf Electron (MIT-Lizenz) mit Chromium und weiteren Bestandteilen. Deren Lizenztexte (`LICENSE.electron.txt`, `LICENSES.chromium.html`) liegen im Installationsordner der App.

## Kokoro und sherpa-onnx (natürliche englische Stimmen der Windows-App, optional)

Kokoro-82M (https://huggingface.co/hexgrad/Kokoro-82M, Apache-2.0) ist das Stimmmodell, sherpa-onnx (https://github.com/k2-fsa/sherpa-onnx, Apache-2.0) führt es aus; sie nutzen ONNX Runtime (MIT) und die Aussprachedaten von eSpeak NG (GPL-3.0, wie bei Piper). Die App lädt Programm und das int8-Modell (https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) erst auf Wunsch von GitHub; sie liegen nicht in diesem Paket.

## whisper.cpp und Whisper-Modelle (Spracherkennung der Windows-App)

whisper.cpp (https://github.com/ggml-org/whisper.cpp, MIT-Lizenz) erkennt Sprache offline auf dem PC. Die Modelle (ggml-Umsetzung der OpenAI-Whisper-Modelle, MIT-Lizenz) lädt die App bei Bedarf von https://huggingface.co/ggerganov/whisper.cpp. Sie werden nicht mit der EFB ausgeliefert.
