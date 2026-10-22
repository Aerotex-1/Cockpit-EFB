# Cockpit EFB

🇬🇧 [English version](README.md)

## Ein persönliches Projekt, geteilt für alle, die so etwas suchen

**Cockpit EFB ist für mein eigenes Heimcockpit gebaut** (1:1-Nachbau eines Airbus A320 mit Microsoft Flight Simulator 2024 und VATSIM) und darauf zugeschnitten. Ich teile es für Leute, die etwas Ähnliches suchen.

Das heißt auch: Es ist ein privates Hobbyprojekt und kein fertiges Produkt. Funktionen richten sich nach meinem eigenen Bedarf, und **kleinere Fehler werden nicht immer sofort behoben** (manche gar nicht). Größere Probleme versuche ich zu beheben. Fragen, Fehlermeldungen und Ideen sind im [Discord-Support-Forum](https://discord.gg/fdKxAVQvm) willkommen.

Ein Tablet-Cockpit-Begleiter für den Microsoft Flight Simulator 2024: Checklisten, SimBrief-Flugplan, Leistungsrechner, Karte mit Rollweg-Anzeige, GSX-Steuerung, VATSIM-Hilfen, Logbuch (ein Sprach-Copilot ist in Entwicklung und noch nicht Teil der öffentlichen Version). Eine kleine Brücke auf dem PC verbindet den Simulator mit einer Webseite, die du am Tablet (oder jedem Browser im Heimnetz) öffnest.

> **Nur für die Flugsimulation.** Alle Daten und Rechner sind Näherungen und nicht für echte Navigation gedacht. Keine Gewähr. Cockpit EFB steht in keiner Verbindung zu Microsoft, Asobo, FSDreamTeam, VATSIM oder den Herstellern der Flugzeug-Add-ons.

## Download

Alles gibt es kostenlos unter **[Releases](../../releases/latest)**, ohne Konto und ohne Token:

| Datei | Wofür |
|---|---|
| `Cockpit-EFB-Setup-x.y.z.exe` | **Windows-App (empfohlen):** Installer mit Oberfläche, Updates und Versionen (Lite, Medium, Voll). |
| `Cockpit-EFB-x.y.z.zip` | Nur die EFB (Node.js nötig), `start.bat` doppelklicken. Für Selbstbauer. |

Der Installer ist nicht signiert; Windows SmartScreen kann warnen („Weitere Informationen“ → „Trotzdem ausführen“).

Die App sucht beim Start selbst nach neuen Versionen und installiert sie auf Knopfdruck.

## Schnellstart

1. Installer ausführen, App öffnen, „Server starten“.
2. Am Tablet im Browser die in der App angezeigte Adresse öffnen (z. B. `http://192.168.1.20:8090`) und eine eigene PIN festlegen.
3. Im EFB unter **Setup → Dienste und Karte** den SimBrief-Namen eintragen.
4. Sim-Modul (freiwillig): installiert die App in den Community-Ordner, wenn du es in den Einstellungen erlaubst.

Die EFB funktioniert nur im eigenen Netzwerk. Nicht ins Internet weiterleiten.

## Status

- Der **Sprach-Copilot ist in Entwicklung** und vorerst nur in einer privaten Version enthalten. Die App zeigt ihn als „in Entwicklung“.
- Getestet wurde vor allem mit Airbus-A320-Familie (FlyByWire, Fenix) in MSFS 2024. Boeing-Add-ons und andere Flugzeuge sind nicht mit den echten Add-ons geprüft.
- Fragen und Support: [Discord](https://discord.gg/fdKxAVQvm) (Community und Support-Forum). Fehler und Wünsche gern auch als [Issue](../../issues) melden. Bitte die Versionsnummer aus der App und das Protokoll (App → Protokoll) beilegen.

## Datenschutz

Es gibt keinen Server des Entwicklers, keine Konten, keine Telemetrie. Alles läuft auf deinem PC. Details: [PRIVACY.md](efb/PRIVACY.md). Drittanbieter und Lizenzen: [THIRD-PARTY-NOTICES.md](efb/THIRD-PARTY-NOTICES.md).

## Lizenz

[MIT](efb/LICENSE). Mitgelieferte Drittsoftware hat eigene Lizenzen (siehe Hinweise oben).

## Für Entwickler

Siehe [README-ENTWICKLER.md](README-ENTWICKLER.md).
