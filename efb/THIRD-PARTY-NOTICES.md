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
| Open-Meteo (Wind, Wolken) | CC BY 4.0, kostenlos für nicht-kommerzielle Nutzung, Namensnennung nötig |
| RainViewer (Wetter-Radar) | Nutzungsbedingungen von RainViewer, Namensnennung |
| VATSIM-Datenfeed, VATSpy-Datenprojekt (FIR-Grenzen) | Nutzungsbedingungen von VATSIM bzw. des Projekts. Der Feed wird höchstens alle 15 Sekunden abgefragt |
| SimBrief | Nur mit dem eigenen Konto des Nutzers |
| OurAirports (optional, `import-airports.bat`) | Public Domain |
| Spotify Web API | Entwicklerbedingungen von Spotify. Jeder Nutzer legt seine eigene Spotify-App an |

## Variablen anderer Add-ons

Die Namen der Sim-Variablen für FlyByWire (A32NX, A380X), Headwind (A339X), Fenix und GSX stammen aus deren öffentlich einsehbarem Quellcode bzw. aus beobachtetem Verhalten. Es wird kein Code dieser Projekte mitgeliefert.
