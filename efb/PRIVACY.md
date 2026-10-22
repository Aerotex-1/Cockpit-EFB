# Datenschutz

Cockpit EFB läuft vollständig auf deinem eigenen PC und im eigenen Heimnetz. Es gibt keinen Server des Entwicklers, keine Konten, keine Telemetrie und keine Werbung.

**Was gespeichert wird (nur auf deinem PC):** Einstellungen (`config.json`, darin SimBrief-Name, Spotify-Client-ID, Kopplungs-PIN), Anmeldung bei Spotify (`spotify-token.json`), gekoppelte Geräte (`auth.json`), zwischengespeicherte Karten und Daten (`cache\`), eigene Charts (`charts\`). Auf dem iPad speichert der Browser Einstellungen wie Checklistenfortschritt.

**Was ins Internet gesendet wird (vom PC aus):** Abfragen an den gewählten Kartenanbieter (Standard CARTO, wählbar: OpenStreetMap, OpenTopoMap, eigene Adresse) für Kartenkacheln, an OpenStreetMap/Overpass für die Bodenkarte, bei der Windows-App an GitHub für die Update-Suche (ohne Anmeldung), Open-Meteo (Koordinaten des Kartenausschnitts), RainViewer, VATSIM-Datenfeed, VATSpy-Daten, SimBrief (dein Benutzername), Spotify (nur wenn du den Musik-Tab nutzt). Diese Anbieter sehen dabei die IP-Adresse deines PCs und ihre eigenen Datenschutzbestimmungen gelten.

**Weitergabe:** Die Software gibt nichts an den Entwickler oder Dritte weiter. Wer die PC-Brücke ins Internet weiterleitet, tut das auf eigene Gefahr. Die Brücke ist nur für das lokale Netzwerk gedacht und lehnt andere Zugriffe ab.

## Sprach-Copilot

Die Sprachausgabe nutzt die Stimmen deines Systems. Die Spracherkennung der Windows-App (Whisper) läuft komplett offline auf dem PC; die Aufnahme verlässt den Rechner nicht und wird nicht gespeichert. Ohne die App nutzt der Copilot die Spracherkennung des Browsers (Web Speech API): Chrome sendet die Aufnahme zur Erkennung an Google, Edge an Microsoft. Cockpit EFB selbst speichert oder versendet keine Audiodaten. Schalte den Copilot aus oder das Häkchen „Mikrofon“ ab, um nichts aufzunehmen; die Texteingabe funktioniert ohne Mikrofon.
