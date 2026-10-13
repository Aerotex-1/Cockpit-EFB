# Cockpit EFB – Anleitung

Eine EFB-Hülle für dein iPad. Sie läuft als Webseite, die ein kleines Programm auf deinem Sim-PC bereitstellt („PC-Brücke“). Das iPad braucht keine App, nur Safari.

**Nur für die Flugsimulation.** Leistungsrechner, Flughafen- und Wetterdaten sind Näherungen und nicht für echte Navigation gedacht.

**Was drin ist**

| Seite  | Inhalt |
|--------|--------|
| FLUG   | Route, Gewichte, Fuel, METARs aus SimBrief und Live-Daten aus dem Sim |
| EFB    | **Remote-EFB** für FBW A32NX, A380X und Headwind A339X: Türen, Fahrzeuge, GPU, Klötze/Kegel, Fuel, Payload/Boarding, Presets, Störungen. Beim Fenix dessen eigene EFB |
| OFP    | Kompletter SimBrief-OFP |
| Perf   | Eigener Takeoff- und Landerechner (V-Speeds, FLEX, Landestrecke), Daten aus dem OFP übernehmbar |
| Finder | Flight Finder: Flugzeug und Flugzeit wählen, Start/Ziel optional, Strecken werden ausgewürfelt |
| ATC    | VATSIM: IFR-Freigabe notieren (SID, Anfangshöhe, Squawk), Lotsen am Abflug, entlang der Route und am Ziel, aktive Frequenz merken |
| Karte  | Moving Map mit Route, Bodenkarte (Pisten, Taxiways, Stands), Rollweg-Anzeige, VATSIM-Verkehr, Wetter-Radar, Höhenwind und Wolken |
| Charts | Schnellzugriff auf ChartFox für Abflug, Ziel und Ausweich, Screenshots und PDFs ablegen |
| Checklisten | Interaktive Airbus-Checklisten zum Abhaken |
| GSX    | Alle Bodendienste als Kacheln, dazu De-Icing, Follow-me, Parkposition und Zusatzdienste; das aktuelle GSX-Menü erscheint live als Kacheln |
| Musik  | Spotify steuern: Titel, Suche, Playlists, Gerät wählen (freiwillig, Premium nötig) |
| Setup  | SimBrief-Name, Spotify, Zugang (PIN), Helligkeit, Flieger-Profile |

Der Flieger wird automatisch am Sim-Titel erkannt. Oben links kannst du ihn auch von Hand wählen.

---

## Schritt 1: Node.js installieren (einmalig)

1. Öffne https://nodejs.org und lade die **LTS**-Version für Windows.
2. Installiere sie mit den Standardeinstellungen.
3. Prüfen: Windows-Taste, `cmd` eingeben, Enter, dann `node -v` eingeben. Es sollte eine Versionsnummer wie `v22.x.x` erscheinen.

## Schritt 2: Projekt entpacken

Entpacke die ZIP-Datei z. B. nach `C:\Cockpit-EFB`. Visual Studio Code ist **freiwillig**: Du brauchst es nur, wenn du später selbst etwas am Programm ändern willst (Datei → Ordner öffnen).

## Schritt 3: Starten und das iPad koppeln

1. Starte MSFS und lade den Flieger. Für FBW und Headwind sollte **SimBridge** (aus dem FlyByWire-Installer) laufen.
2. Doppelklick auf **`start.bat`**. Beim ersten Mal wird automatisch die SimConnect-Bibliothek installiert (`npm install`).
3. Windows fragt beim ersten Start nach der Firewall: **„Private Netzwerke“ erlauben**.
4. Im Fenster stehen die Adresse (z. B. `http://192.168.178.25:8090`) und der Hinweis, dass noch keine PIN festgelegt ist.
5. Öffne die Adresse auf dem iPad in Safari. iPad und PC müssen im selben WLAN sein. Beim ersten Öffnen legst du dort **deine eigene PIN** (4 bis 8 Ziffern) fest. Das iPad ist damit gekoppelt und merkt sich das. Weitere Geräte geben später dieselbe PIN ein.
6. Der Punkt oben links wird **grün**, sobald der Sim verbunden ist.

Hast du die PIN vergessen, steht sie am PC im EFB unter Setup → Zugang. Dort kannst du auch eine neue PIN festlegen (gekoppelte Geräte bleiben gekoppelt) oder alle Geräte abmelden. Wichtig: Bis die PIN festgelegt ist, kann das erste Gerät im WLAN sie setzen. Mach das deshalb gleich nach dem ersten Start, am besten in einem vertrauten Netz. Die Brücke antwortet nur Geräten im eigenen Netzwerk. Leite den Port nicht ins Internet weiter.

## Schritt 4: Als App auf den Home-Bildschirm

In Safari auf Teilen (Quadrat mit Pfeil) → **Zum Home-Bildschirm**. Danach startet das EFB im Vollbild ohne Safari-Leiste. Nach einem Update das alte Symbol löschen und neu hinzufügen, iOS merkt sich sonst manchmal die alte Version.

## Schritt 5: SimBrief eintragen

Auf dem iPad: **SETUP** → SimBrief-Benutzername (oder Pilot-ID) eintragen → **Einstellungen speichern**. Dann auf **FLUG** → **OFP von SimBrief laden**.

Perf-Tab: „Aus OFP übernehmen“ füllt Flughafen, Piste, Gewicht und Wetter aus dem Flugplan. Aktivierst du in SimBrief die Takeoff- und Landing-Performance, siehst du darunter zusätzlich die Werte aus dem OFP zum Vergleichen.

Flight Finder: Die Strecken kommen aus der Flughafenliste `public/data/airports.json`. Die mitgelieferte Liste ist klein und ungefähr. Mit **`import-airports.bat`** lädst du die freien OurAirports-Daten (rund 4000 Flughäfen mit Linienverkehr) und ersetzt die Liste. Es sind keine echten Airline-Routen, nur passende Entfernungen; die Route selbst legt SimBrief fest.

## Schritt 6: Sim-Modul (freiwillig)

`install-sim-modul.bat` kopiert das Modul „Cockpit EFB Link“ in den MSFS-Community-Ordner. Es leitet die Systemstörungen an FBW und Headwind weiter. Ohne das Modul funktioniert alles andere.

## Schritt 7: Charts

**ChartFox:** CHARTS → „ChartFox“ zeigt Buttons für Abflug, Ziel und Ausweichflughäfen aus dem OFP. Sie öffnen chartfox.org in Safari direkt für den Platz. ChartFox lässt sich nicht einbetten; am iPad legst du Safari per Split View oder Slide Over neben das EFB (Tab-Symbol antippen und halten).

**Screenshot ablegen:** Am iPad Lauter + Ein/Aus drücken, in der Vorschau zuschneiden und „Fertig → In Fotos sichern“, dann im EFB „Bild ablegen“ tippen (oder „Kopieren und Löschen“ wählen und „Aus Zwischenablage“ tippen). Du gibst einen Namen ein, das Bild wird auf dem PC in `charts\ICAO\` gespeichert und steht unter „Gespeichert“ für jeden Flughafen bereit.

**Eigene PDFs:** PDFs oder Bilder in `charts\ICAO\` legen, z. B. `charts\EDDP\SID 26R.pdf`. Sie erscheinen unter „Gespeichert“.

## Schritt 8: Remote-EFB

Bei FBW A32NX, A380X und Headwind A339X zeigt die EFB-Seite ein eigenes EFB mit fünf Bereichen:

- **Boden:** Türen, Fluggastbrücke, Treppe, Catering, Gepäck, Tankwagen, GPU, Klimawagen, Bremsklötze, Kegel
- **Fuel:** Zielmenge eingeben oder den Block aus dem OFP übernehmen, Tempo wählen, Betanken starten (auf Wunsch per GSX)
- **Payload:** Passagiere und Fracht aus dem OFP oder von Hand, Boarding starten (auf Wunsch per GSX), ZFW/GW und Schwerpunkt live
- **Presets:** Cold & Dark bis Bereit zum Start
- **Störungen:** Sim-Störungen und die Systemstörungen des Fliegers (letztere brauchen das Sim-Modul)

## Schritt 9: Karte, Wind und Rollweg

- **Wind & Wolken:** Pfeile zeigen, wohin der Wind weht, mit Richtung/Stärke und Wolkenbedeckung. Oben rechts wählst du die Höhe (Boden bis FL390). Pfeil antippen zeigt alle Höhen. Im Fenster stehen die Wolkenuntergrenzen aus den METARs deines OFP. Die Daten stammen von Open-Meteo und sind eine Vorhersage.
- **Rollweg:** Abflug oder Ankunft wählen, Stand, Piste und Rollwege eintragen (z. B. `B A N5`). Der Weg erscheint als Leiste oben und wird auf der Bodenkarte hervorgehoben. „Zum Flughafen“ springt dorthin und lädt die Bodenkarte, „Stand zeigen“ springt zum Stand.
- **Stands:** Die Standnummern erscheinen ab Zoom 15. Die Bodenkarte kommt aus OpenStreetMap und wird in `cache\` gespeichert.

Alles hier ist reine Anzeige und wirkt nicht auf den Sim.

## Schritt 10: Spotify (freiwillig, Premium nötig)

Jeder Nutzer braucht seine eigene Spotify-App:

1. Auf https://developer.spotify.com/dashboard eine App erstellen, als Redirect-URI `http://127.0.0.1:8090/api/spotify/callback` eintragen und dein Konto unter „User Management“ hinzufügen.
2. Die Client-ID im EFB unter Setup → Spotify eintragen und speichern.
3. Am PC im Browser `http://127.0.0.1:8090/api/spotify/login` öffnen und zustimmen (geht nur am PC).
4. Spotify am PC (oder einem anderen Gerät) einmal starten, damit es als Gerät erscheint. Dann im Tab Musik suchen, Playlists starten und steuern.

---

## Schritt 11: Airline, Design und Logbuch (freiwillig)

Alles dazu findest du unter **Setup**. Links wählst du den Bereich.

- **Airlines:** Lege eine Airline an (Vorlagen für Lufthansa, Condor, DHL und mehr, oder eine eigene). Jede hat eine Farbe, optional ein eigenes Hintergrundbild und ein eigenes Design. Oben in der Leiste wechselst du mit einem Tipp auf das Airline-Feld. Ist die Automatik an, wählt das EFB die Airline passend zum SimBrief-Flugplan.
- **Design:** Cockpit, Glas, Tageslicht, Nachtrot und Hoher Kontrast. Deckkraft und Glas-Unschärfe stellst du dort ein.
- **Sprache:** Deutsch oder Englisch. Die Wahl gilt für das jeweilige Gerät, iPad und PC können also unterschiedliche Sprachen haben.
- **Tabs:** Blende Tabs aus, die du nicht brauchst, und sortiere sie neu.
- **Presets:** Speichere Design, Airline und Tab-Auswahl als Preset und lade sie mit einem Tipp. Beispiel-Presets lassen sich mit einem Knopf anlegen.
- **Logbuch:** Der PC zeichnet jeden Flug automatisch auf (Boarding, Off-Block, Start, Landung, On-Block, Strecke, Sprit, Landerate, Gewichte). Im Tab Logbuch filterst du nach der gewählten Airline oder zeigst alle Flüge, sortierst nach Datum, Flugzeugtyp, Blockzeit oder Airline, bewertest Flüge, schreibst Notizen und löschst Einträge. Unter Setup → Logbuch räumst du alte Einträge auf und exportierst alles als CSV.

---

## Schritt 12: Sprach-Copilot für Checklisten (freiwillig)

Öffne die EFB **am PC** im Browser (Edge oder Chrome) unter `http://localhost:8090` – nur dort erlaubt der Browser das Mikrofon. Im Tab „Checklists“ den Schalter „Copilot“ antippen, einmal das Mikrofon erlauben. Ton und Mikrofon sind die Standardgeräte von Windows (also dein Headset, wenn es dort eingestellt ist).

- Checkliste antippen: Der Copilot sagt, ob sie jetzt dran ist, und fragt, ob ihr sie machen wollt („ja“ / „nein“).
- Während der Liste liest er den Punkt vor, du antwortest. Bei „T.O Speeds“ sagst du V1, VR und V2 (z. B. „140 145 150“), bei „Baro Ref“ das QNH, bei „Fuel“ die Menge in kg. Stimmt es mit Rechner bzw. Sim überein, sagt er „Checked“; sonst nennt er den Unterschied. Alle anderen Punkte bestätigst du mit einem beliebigen Wort („checked“, „on“ …).
- Befehle: „weiter“ (Punkt überspringen), „wiederholen“, „stopp“.
- Die Sprache ist die Spracherkennung deines Browsers; Chrome und Edge senden die Aufnahme dafür an Google bzw. Microsoft (siehe PRIVACY.md). Das Feld „Antwort eintippen“ funktioniert auch ohne Mikrofon.

## Updates installieren

Neue ZIP herunterladen, EFB am PC öffnen, Setup → Info → „Update installieren“, ZIP wählen, „Installieren“, dann „Jetzt neu starten“. Starte die EFB dafür immer über `start.bat`, nur dann startet sie selbst neu. Einstellungen, Logbuch, PIN, Hintergründe und `config.json` bleiben unberührt.

## Gut zu wissen

- **Remote-EFB und Original-flyPad:** Beide steuern dieselben Variablen. Was du am iPad einstellst, siehst du auch im flyPad im Cockpit. Nutzt du GSX mit Fuel- oder Payload-Sync, übernimmt GSX das Betanken bzw. Boarding.
- **Rechner:** Der Perf-Tab ist ein eigenes Näherungsmodell, kein FCOM. Wähle den richtigen Typ und die richtige Klappenstellung und vergleiche die Werte mit dem Rechner deines Fliegers.
- **Systemstörungen (FBW/Headwind):** Das flyPad im Sim verwaltet die Störungen ebenfalls. Schaltest du dort eine Störung, überschreibt es die Auswahl vom iPad.
- **Fenix:** Die eingetragene EFB-Adresse (`Port 8083`) ist eine Annahme. Wenn sie nicht stimmt, ändere sie unter SETUP.
- **GSX:** Eine Kachel antippen löst den Dienst aus. Das EFB sucht dafür den passenden Eintrag im GSX-Menü, egal an welcher Stelle er steht. Fragt GSX nach (z. B. Pushback-Richtung), erscheinen die Antworten als Kacheln darunter.
  - Das EFB liest das GSX-Menü aus der Datei `menu` im GSX-Paketordner (`…\fsdreamteam-gsx-pro\html_ui\InGamePanels\FSDT_GSX_Panel\menu`). Sie wird automatisch gesucht; klappt das nicht, trag den Pfad unter SETUP → GSX ein.
  - GSX blendet sein Menüfenster im Sim kurz ein, wenn es von außen bedient wird. Das lässt sich von außen nicht sicher unterdrücken.
  - Wird regelmäßig der Eintrag direkt neben dem richtigen gewählt, stell in `config.json` den Wert `gsxChoiceOffset` auf `1` oder `-1`.
- **Karte:** Die Kacheln kommen von OpenStreetMap. Die PC-Brücke lädt sie und speichert sie im Ordner `cache\tiles` zwischen; einmal angesehene Gegenden laden danach sofort. Bei starker Nutzung trägst du in `config.json` einen eigenen Kartendienst ein (`tileUrl`, `tileKey`). Oben rechts auf der Karte schaltest du zwischen dunkler und heller Darstellung um. Die Knöpfe unten schalten Bodenkarte, VATSIM, Wetter-Radar, Wind & Wolken und die Rollweg-Eingabe.
- **Internet:** Radar (RainViewer) und die Schrift lädt das iPad. Kartenkacheln, Bodenkarte, Wind (Open-Meteo), VATSIM- und SimBrief-Daten holt die PC-Brücke.
- **Adresse merken:** Gib deinem PC im Router eine feste IP, dann bleibt die Adresse auf dem iPad immer gleich.

## Projektaufbau (zum Anpassen in VS Code)

```
server.js            PC-Brücke: Webserver und alle Schnittstellen
auth.js              Zugangsschutz: PIN, lokales Netz
sim.js               SimConnect: Live-Daten, Variablen, Ereignisse
efb.js               Remote-EFB: Fuel, Payload, Türen, GPU, Presets, Störungen
gsx.js               GSX-Steuerung über die Menüdatei
vatsim.js, atc.js    VATSIM-Datenfeed, Lotsen und FIR-Zuordnung
wx.js                Höhenwind (Open-Meteo), Bodenkarte (Overpass)
spotify.js           Spotify-Steuerung
settings.js          Airlines, Design, Tabs, Presets (Datei settings.json)
logbook.js           Logbuch-Aufzeichnung (Datei logbook.json)
config.json          Flieger-Profile und Einstellungen
public/              iPad-Oberfläche (i18n-en.js enthält die englischen Texte)
public/data/         Checklisten, Flieger-Definitionen, Flughafenliste
public/lib/          Leaflet (Karte)
tools/               Import der Flughafendaten
efb-app/             Sim-Modul (Quellcode)
community/           Fertiges Sim-Modul zum Kopieren in den Community-Ordner
charts/              Deine eigenen Charts
```

## Herkunft und Lizenzen

Siehe `THIRD-PARTY-NOTICES.md`, `PRIVACY.md` und `LICENSE`.
