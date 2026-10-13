# Cockpit EFB

Ein iPad-Cockpit-Begleiter für den Microsoft Flight Simulator 2024. Eine kleine PC-Brücke verbindet den Sim mit einer Webseite, die du auf dem iPad (oder jedem Browser im Heimnetz) öffnest.

**Nur für die Flugsimulation.** Leistungsrechner, Flughafen- und Wetterdaten sind Näherungen. Nicht für echte Navigation verwenden. Keine Gewähr.

## Was es kann
- Live-Flugdaten, Karte mit Route, Bodenkarte mit Stands, Rollweg-Anzeige, Höhenwind und Wolken, VATSIM-Verkehr
- SimBrief-Flugplan (OFP), eigener Leistungsrechner für 44 Flugzeugtypen, Flight Finder
- Remote-EFB für FlyByWire A32NX/A380X und Headwind A339X (Kraftstoff, Passagiere, Störungen), GSX-Steuerung
- Boeing 737/747/777/787: Standard-EFB (Türen, Bodendienste, Tanken, Sim-Störungen), Checklisten und Performance-Typ (ungetestet mit echten Boeing-Add-ons)
- ATC-Seite für VATSIM: IFR-Freigabe, Lotsen-Frequenzen entlang der Route, aktive Frequenz
- Checklisten, Charts (ChartFox-Verknüpfung, eigene Dateien), Spotify-Steuerung
- Automatisches Logbuch mit Filter nach Airline und Sortierung nach Flugzeugtyp
- Airlines mit eigener Farbe und eigenem Hintergrundbild, fünf Designs (u. a. Glas), wählbare Tabs, Presets, Oberfläche auf Deutsch und Englisch

## Installation (Windows)
1. **Node.js** (LTS) von https://nodejs.org installieren.
2. ZIP entpacken, `start.bat` doppelklicken. Beim ersten Start werden Bibliotheken geladen. Im Fenster stehen die Adresse und der Hinweis, die PIN beim ersten Öffnen am iPad festzulegen.
3. Auf dem iPad in Safari die Adresse öffnen (z. B. `http://192.168.1.20:8090`), dort eine eigene PIN (4–8 Ziffern) festlegen. Das iPad merkt sich die Kopplung. Tipp: „Zum Home-Bildschirm" für Vollbild.
4. Sim-Modul (freiwillig): `install-sim-modul.bat` ausführen (kopiert `cockpit-efb-link` in den Community-Ordner). Das Modul ist freiwillig: Es leitet nur die Systemstörungen an FBW und Headwind weiter.
5. Im EFB unter **Setup** den SimBrief-Namen eintragen und speichern.

## Sicherheit
- Die Brücke antwortet nur Geräten im eigenen Netzwerk und lehnt Anfragen fremder Webseiten ab.
- Neue Geräte brauchen die PIN. Am PC unter Setup → Zugang siehst du die PIN, kannst eine neue festlegen und alle Geräte abmelden.
- Nicht ins Internet weiterleiten (kein Port-Forwarding). Für unterwegs ein VPN verwenden.
- `requirePin: false` in `config.json` schaltet die PIN aus (nicht empfohlen).

## Spotify einrichten (freiwillig, Premium nötig)
Jeder Nutzer braucht seine eigene Spotify-App:
1. https://developer.spotify.com/dashboard → App erstellen, Redirect-URI `http://127.0.0.1:8090/api/spotify/callback` eintragen. Dein Konto unter „User Management" hinzufügen.
2. Die Client-ID im EFB unter Setup → Spotify eintragen und speichern.
3. Am PC im Browser `http://127.0.0.1:8090/api/spotify/login` öffnen und zustimmen.

## Weitere Einstellungen (`config.json`)
| Schlüssel | Bedeutung |
|---|---|
| `port` | Port der Brücke (Standard 8090) |
| `requirePin` | PIN-Abfrage an/aus (Standard an) |
| `tileUrl`, `tileKey` | Eigener Kartendienst, z. B. `https://api.example.com/{z}/{x}/{y}.png?key={key}`. Standard: OpenStreetMap (nur für leichte Nutzung) |
| `overpassUrl` | Eigener Overpass-Server für die Bodenkarte |

## Flughafendaten aktualisieren
Die mitgelieferte Liste ist klein und ungefähr. `import-airports.bat` lädt die freien OurAirports-Daten (rund 4000 Flughäfen mit Linienverkehr) und ersetzt `public/data/airports.json`.

## Bekannte Grenzen
- Oberfläche nur auf Deutsch.
- Der Leistungsrechner ist ein vereinfachtes Modell und passt nicht exakt zu den Rechnern der Flugzeuge. Typ und Klappenstellung prüfen.
- SIDs kennt die App nicht von sich aus (eigene Liste in `public/data/sids.json`).
- Getestet mit MSFS 2024. MSFS 2020 ist nicht geprüft.

## Mitgelieferte und genutzte Dienste
Siehe `THIRD-PARTY-NOTICES.md`, `PRIVACY.md` und `LICENSE`.
