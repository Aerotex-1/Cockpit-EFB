# Drittanbieter und Quellen

Cockpit EFB steht in keiner Verbindung zu den hier genannten Firmen und Projekten. Alle Namen und Marken gehören ihren Inhabern. Sie werden nur genannt, um zu beschreiben, womit die Software zusammenarbeitet.

## Im Paket enthalten

| Bestandteil | Lizenz | Hinweis |
|---|---|---|
| Leaflet 1.9.4 (`public/lib/leaflet`) | BSD-2-Clause | © 2010-2023 Vladimir Agafonkin, © 2010-2011 CloudMade |
| EFB-API aus dem MSFS-SDK (`community/`, `efb-app/`) | MIT | © Asobo Studio. Der Lizenztext liegt dem SDK bei und muss bei einer Weitergabe mitgeliefert werden |
| node-simconnect (wird per `npm install` geladen) | MIT | Siehe das Paket selbst |

## Wird zur Laufzeit vom PC des Nutzers geladen (nicht mitgeliefert)

| Quelle | Bedingungen |
|---|---|
| OpenStreetMap-Kacheln und Daten (Bodenkarte über Overpass) | © OpenStreetMap-Mitwirkende, ODbL. Die öffentlichen Kartenserver erlauben nur maßvolle Nutzung (Tile Usage Policy). Für starke Nutzung eigenen Kartendienst eintragen (`tileUrl`, `tileKey` in `config.json`) |
| Kartenkacheln von CARTO (Voyager, Positron) | © OpenStreetMap-Mitwirkende © CARTO. Kostenlos für nicht-kommerzielle Nutzung mit Namensnennung; es gelten die Nutzungsbedingungen von CARTO. |
| OpenTopoMap (wählbar) | © OpenStreetMap-Mitwirkende, SRTM | © OpenTopoMap (CC-BY-SA 3.0). Nur maßvolle Nutzung. |
| Open-Meteo (Wind, Wolken) | CC BY 4.0, kostenlos für nicht-kommerzielle Nutzung, Namensnennung nötig |
| RainViewer (Wetter-Radar) | Nutzungsbedingungen von RainViewer, Namensnennung |
| VATSIM-Datenfeed, VATSpy-Datenprojekt (FIR-Grenzen) | Nutzungsbedingungen von VATSIM bzw. des Projekts. Der Feed wird höchstens alle 15 Sekunden abgefragt |
| SimBrief | Nur mit dem eigenen Konto des Nutzers |
| OurAirports (optional, `import-airports.bat`) | Public Domain |
| Spotify Web API | Entwicklerbedingungen von Spotify. Jeder Nutzer legt seine eigene Spotify-App an |

## Variablen anderer Add-ons

Die Namen der Sim-Variablen für FlyByWire (A32NX, A380X), Headwind (A339X), Fenix und GSX stammen aus deren öffentlich einsehbarem Quellcode bzw. aus beobachtetem Verhalten. Es wird kein Code dieser Projekte mitgeliefert.

## Piper (Sprachausgabe der Windows-App)

Piper (https://github.com/rhasspy/piper, MIT-Lizenz) erzeugt die eingebauten Copilot-Stimmen. Die Stimmmodelle stammen aus https://huggingface.co/rhasspy/piper-voices; jede Stimme hat ihre eigene Lizenz (siehe Modellkarte der Stimme dort). Prüfe die Lizenz, bevor du die App mit Stimmen weitergibst.

## Kokoro und sherpa-onnx (natürliche englische Stimmen der Windows-App, optional)

Kokoro-82M (https://huggingface.co/hexgrad/Kokoro-82M, Apache-2.0) ist das Stimmmodell, sherpa-onnx (https://github.com/k2-fsa/sherpa-onnx, Apache-2.0) führt es aus; sie nutzen ONNX Runtime (MIT) und die Aussprachedaten von eSpeak NG (GPL-3.0, wie bei Piper). Die App lädt Programm und das int8-Modell (https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models) erst auf Wunsch von GitHub; sie liegen nicht in diesem Paket.

## whisper.cpp und Whisper-Modelle (Spracherkennung der Windows-App)

whisper.cpp (https://github.com/ggml-org/whisper.cpp, MIT-Lizenz) erkennt Sprache offline auf dem PC. Die Modelle (ggml-Umsetzung der OpenAI-Whisper-Modelle, MIT-Lizenz) lädt die App bei Bedarf von https://huggingface.co/ggerganov/whisper.cpp. Sie werden nicht mit der EFB ausgeliefert.
