# Cockpit EFB Link (Sim-Modul für Lido-Charts und FBW-Störungen)

Die Lido-Charts gibt es nur innerhalb des MSFS 2024. Dieses Modul läuft als App im EFB des Sims, holt die Charts über die Chart-Schnittstelle des Sims und schickt sie an die PC-Brücke (`http://localhost:8090`). Außerdem leitet es die Systemstörungen für FBW/Headwind an den Flieger weiter.

## Installieren

Das fertige Paket liegt im Projekt unter `community\cockpit-efb-link`.

- **Automatisch:** Doppelklick auf `install-sim-modul.bat` im Hauptordner. Es sucht deinen Community-Ordner und kopiert das Modul hinein.
- **Von Hand:** Den Ordner `community\cockpit-efb-link` in deinen Community-Ordner kopieren.

## Benutzen

1. `start.bat` starten (PC-Brücke).
2. MSFS starten, Flieger laden.
3. Das EFB des Sims einmal öffnen (Tablet im Cockpit oder über die Werkzeugleiste). In der App-Liste steht „Cockpit EFB Link“. Dort muss „Verbunden mit der PC-Brücke“ stehen.
4. Auf dem iPad: CHARTS → „Lido (Sim)“.

## Fehlersuche

Das Modul meldet sich im Fenster von `start.bat` mit Zeilen, die mit `[SIM-MODUL]` beginnen:

- `Sim-Modul geladen` – der Sim hat die Datei geladen
- `App beim EFB angemeldet` / `App im EFB installiert` – die App sollte im EFB erscheinen
- `verbunden` – die Verbindung zur Brücke steht, Lido-Charts funktionieren

Erscheint gar keine Zeile, lädt der Sim die Datei nicht. Dann bitte prüfen, ob der Ordner `cockpit-efb-link` direkt im Community-Ordner liegt (nicht in einem weiteren Unterordner).

## Aufbau

- `src/link.ts` – Verbindung zur Brücke, Abruf der Charts, Weitergabe der Störungen
- `src/CockpitLink.tsx` – die EFB-App selbst (Statusanzeige)
- `build/` – Hilfsdateien zum Bauen (das MSFS-SDK stellt der Sim als globales Objekt bereit)

Gebaut mit der EFB-API aus dem MSFS-2024-SDK (Asobo Studio, MIT-Lizenz).

## Hinweis zum Bauen
Der Sim versteht nur älteres JavaScript. Nach dem Bündeln muss die Datei mit Ziel `es2017` umgewandelt werden (wie in der offiziellen Vorlage), sonst lädt der Sim sie stillschweigend nicht.

## Wichtig beim Bauen

Der Sim-Browser kennt nur ältere JavaScript-Syntax. Die fertige Datei muss auf ES2017 heruntergebaut sein (wie `target: "es2017"` in der offiziellen Vorlage). Sonst wird die ganze Datei beim Laden verworfen, und die App erscheint nicht im EFB.
