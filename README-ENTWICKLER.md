# Cockpit EFB – Windows-App und Update-Seite

Dieses Projekt enthält die **Windows-App** (`app/`, Electron) und die **EFB** selbst (`efb/`, öffentliche Version).
Die „Webseite zum Herunterladen und Hochladen“ ist die **Releases-Seite deines GitHub-Repositorys**: Dort lädst du als Entwickler neue Versionen hoch, die Nutzer laden den Installer herunter, und die App holt Updates von dort. Kostenlos, auch mit privatem Repository.

> Ich konnte Electron hier nicht installieren und die App nicht auf Windows starten. Geprüft ist die Logik ohne Fenster (`npm test`: GitHub-Abfrage, Download, Überschreiben ohne Datenverlust, Server starten und neu starten) und die Oberfläche im Browser. Das Zusammenspiel in Electron selbst ist ungetestet – erwarte beim ersten Start kleine Fehler und schicke mir die Meldung.

## Einmalig einrichten

1. Auf github.com ein neues Repository anlegen (privat oder öffentlich, z. B. `cockpit-efb`).
2. Den Inhalt dieses Ordners hochladen (Ordner `app`, `efb`, `.github`, `.gitignore`, …). Am einfachsten mit GitHub Desktop.
3. Auf der Repository-Seite: **Actions** erlauben. Danach unter **Releases → Draft a new release** einen Tag `app-v1.0.0` anlegen und veröffentlichen. GitHub baut den Installer (ca. 5 Minuten) und hängt `Cockpit-EFB-Setup-1.0.0.exe` an dieses Release an.
4. Den Installer herunterladen und auf dem Spiel-PC installieren.
5. In der App: **Updates → Repository** `deinname/cockpit-efb` eintragen. Bei privatem Repository zusätzlich einen Token (GitHub → Settings → Developer settings → Fine-grained tokens → nur dieses Repository, Berechtigung „Contents: Read-only“).

## Neue EFB-Version hochladen (der häufige Fall)

1. Du bekommst von mir `Cockpit-EFB-1.1.8.zip`.
2. GitHub → **Releases → Draft a new release** → Tag `v1.1.8` → die ZIP in das Feld „Attach binaries“ ziehen (Name unverändert lassen!) → Beschreibung eintragen → **Publish release**.
   Oder per Skript: `veroeffentlichen.bat` (braucht die GitHub-CLI `gh`).
3. Die App der Nutzer zeigt beim Start einen Punkt bei „Updates“; ein Klick auf **EFB-Update installieren** lädt die ZIP, stoppt den Server, überschreibt nur Programmdateien und startet neu. Logbuch, Charts, Einstellungen, PIN, Hintergründe und `config.json` bleiben unberührt; ersetzte Dateien werden in `_backup` gesichert.

Namensregeln für die Dateien am Release: `Cockpit-EFB-1.2.3.zip` (öffentlich), `Cockpit-EFB-1.2.3-privat.zip` (privat), `Cockpit-EFB-Setup-1.2.3.exe` (App).

## Neue App-Version (ohne Installer)

Die Oberfläche der App (alles im Ordner `app/code`) wird wie die EFB per Update eingespielt. Der Installer ist nur der feste Kern und wird nur einmal gebraucht. Ablauf:
1. Dateien in `app/code` im Repository ändern, Commit und Push.
2. Release mit Tag `app-v1.2.1` veröffentlichen. GitHub baut daraus den Installer **und** `Cockpit-EFB-App-Code-1.2.1.zip` und hängt beide an. (Du kannst die Code-ZIP auch selbst als Asset an ein Release hängen.)
3. In der App unter Updates erscheint „App 1.2.1 verfügbar“. Ein Klick lädt die ZIP nach `%APPDATA%\cockpit-efb-app\app-code` und startet die App neu. Ist der Code defekt, fällt der Kern automatisch auf die mitgelieferte Version zurück.

Nur wenn sich die Grundlage ändert (neue Electron-Version, neue Pakete, `boot.js`), brauchen Nutzer einen neuen Installer; die App bietet ihn dann als „Installer-Update still installieren“ an (lädt und installiert ohne Klickerei). Dann `shellApi` in `app/code/package.json` und `SHELL_API` in `boot.js` erhöhen.

## (alt) Neue App-Version (selten)

Nur nötig, wenn sich die App selbst ändert (Fenster, Einstellungen). Neuen Tag `app-v1.0.1` als Release veröffentlichen; GitHub baut den Installer. Die App meldet das als „App-Update“ und startet den Installer. Soll der Installer auch eine neuere EFB mitbringen, ersetze vorher den Ordner `efb/` im Repository durch die neue EFB (ZIP entpacken).

## Selbst bauen (optional)

```
cd app
npm install
npm start        # Entwicklungsstart
npm run dist     # Installer in app/dist
```
(Node.js 20 oder neuer nötig.)

## Eingebaute Stimmen (Piper)

Der Installer enthält Piper, aber keine Stimmen mehr (etwa 90 MB statt 230 MB). Beim Bauen lädt `npm run dist` (bzw. der GitHub-Workflow) nur Piper von GitHub. Die empfohlenen Stimmen (Thorsten, Lessac; `bundled: true` im Katalog `lib/voices.js`) lädt die App auf der Copilot-Seite mit einem Klick von Hugging Face nach; weitere Stimmen ebenso. Wer sie wieder einbauen will: `BUNDLE_VOICES=1` beim Bauen und den Eintrag `voices-bundle` in `extraResources` ergänzen.

## Wo liegen die Daten?

`%APPDATA%\cockpit-efb-app\efb` (Knopf „Ordner öffnen“ in der App). Beim Deinstallieren bleibt dieser Ordner erhalten.

## Stand dieser Version (App 1.5.5, enthält EFB 1.3.9)

- **Firewall-Regel fürs iPad (1.5.5):** Einstellungen → „iPad-Verbindung (Windows-Firewall)“. `app/code/lib/firewall.js` liest den Status mit `netsh advfirewall firewall show rule` (ohne Rechte) und legt die Regel „Cockpit EFB (iPad)“ (eingehend, TCP, nur der EFB-Port, nur privates Netzwerk) über eine PowerShell mit Administrator-Abfrage (`Start-Process -Verb RunAs`, Skript als Base64) an oder entfernt sie. Es gibt bewusst keinen Knopf, der die ganze Firewall ausschaltet. Test mit nachgestellten Befehlen: `node app/tools/test-firewall.js`. **Auf echtem Windows ungetestet** (UAC, deutsche/englische netsh-Ausgabe, Wirkung auf das iPad).

- **Community & Support (1.5.4 / EFB 1.3.9):** Discord-Knopf in der App-Startseite (`link:open` öffnet nur die Adressen aus `app/code/lib/links.js`) und im EFB-Setup (Update und Info). Kein Spenden-Knopf. Die Karten-Voreinstellung ist wieder OpenStreetMap (Rückfall auf CARTO). Lizenzhinweise ergänzt (eSpeak NG GPL-3.0 im Piper-Paket, Leaflet-Lizenzdatei, RainViewer-Bedingungen).
- **Englisch als Standard (1.5.2):** App und EFB starten auf Englisch (vorher nach Windows-/Browsersprache). Deutsch wählbar. In der App ist `settings.lang === 'de'` der einzige Weg zu Deutsch; leer oder `en` ergibt Englisch.
- **PIN bei jedem Öffnen (EFB 1.3.7, App 1.5.2):** `config.json` der EFB enthält `pinEvery` (Standard `true`). Die App schreibt den Schalter („Einstellungen → Allgemein“) in diese Datei und startet den Server neu, wenn er läuft. Logik in `efb/auth.js` (`gate`): jede Kopplung gilt für genau ein Laden von `/`, dazu 5 Minuten Leerlauf; `efb/public/authguard.js` leitet bei 401 auf `/pair.html`. Mit älteren EFB-Versionen hat der Schalter keine Wirkung.
- **ATC: „Aus VATSIM übernehmen“ (EFB 1.3.7):** nutzt `data.me` aus `/api/atc` (öffentlicher VATSIM-Datenfeed, Suche über das Rufzeichen), kein VATSIM-Login nötig.

- **Kleinerer Installer (1.5.1):** keine mitgelieferten Stimmen mehr, Download per Knopf auf der Copilot-Seite (siehe unten bei „Der Installer enthält“).

- **Release-bereit (1.5.0):** Standard-Repository `Aerotex-1/Cockpit-EFB` ist fest voreingestellt (`lib/store.js`), die Update-Suche läuft ohne Token über die öffentliche GitHub-API (Limit 60 Abfragen/Stunde je IP, die App fragt alle 6 h). Token und andere Quelle stehen unter „Updates → Erweitert“. Copilot ist in der App als Beta gekennzeichnet. Root-`README.md` für das Repository.
- **App-Sprache (1.5.0):** Die App ist auf Deutsch und Englisch nutzbar (Einstellungen → Sprache der App; seit 1.5.2 ist Englisch der Standard). Quelltext bleibt deutsch; `renderer/i18n.js` übersetzt beim Anzeigen anhand von `renderer/i18n-en.js` (Wörterbuch + Muster für Texte mit Zahlen). Neue deutsche Texte brauchen dort einen englischen Eintrag, sonst bleiben sie deutsch. Fenstertitel der Dateidialoge folgen derselben Wahl (`en()` in app-main.js). README.md ist englisch, README.de.md deutsch.
- **EFB 1.3.6:** Kartenanbieter wählbar (CARTO Standard) mit Rückfall, Setup in vier Gruppen sortiert.

- **EFB 1.3.5:** Türzuordnung bei Fliegern ohne eigene Schnittstelle wird aus der Sim-Reaktion gelernt (Knopf zum Zurücksetzen); obere Leiste lässt die Uhr nie mehr abschneiden. Beides nur mit Attrappe/Chromium getestet.

- **Versionen der EFB (1.4.0):** Neue App-Seite „Version“ (beim ersten Start automatisch). Lite, Medium, Voll, Copilot & Ground und eigene Auswahl; alle stecken in derselben EFB, die App schreibt nur `edition.json` in den EFB-Ordner, die EFB blendet die übrigen Tabs aus (`editions.js` in der EFB definiert die Tabs je Version – dort ändern, wenn sich die Aufteilung ändern soll). Ohne `edition.json` gilt „Voll“. Die Copilot-Seite der App und das Copilot-Fenster entfallen in Versionen ohne Copilot. Test: `node app/tools/test-editions.js`.
- **Aufgeräumt (1.4.1):** Die Seite „Einstellungen“ enthält jetzt alles Grundsätzliche: Allgemein (inkl. Copilot-Fenster beim Start), Sprachpakete (Spracherkennung, Kokoro, eingebaute Stimmen) und das Sim-Modul. Die Seite „Copilot“ zeigt nur noch Fenster, Stimme/Tempo und Sounds. Die Element-IDs sind gleich geblieben, nur die Karten sind verschoben (`renderer/index.html`).
- **Mute-Tastenkürzel (1.4.2):** `app/code/lib/hotkeys.js` registriert globale Tasten (Electron `globalShortcut`) für „Nur Mikrofon stumm“ und „Alles stumm“. Sie schalten um, indem sie den Zustand vom Server (`/api/cp/host`) lesen und den Gegenbefehl an `/api/cp/event` senden; das Copilot-Fenster und alle Geräte folgen. Gedrückt halten (Push-to-Mute) geht damit nicht, weil Electron das Loslassen globaler Tasten nicht meldet. Test: `node app/tools/test-hotkeys.js`.
- **Copilot & Ground im Sim-EFB:** Das Sim-Modul `cockpit-efb-link` 0.8.0 (Ordner `efb/community`) zeigt im EFB des Simulators eine Einstellungsseite für den Copiloten. Quelle: `efb/tools/cp-sim-ui.js`, eingebaut mit `python3 efb/tools/build-sim-app.py 0.8.0`. Im echten MSFS ungetestet.

- **Kokoro (1.3.10):** Karte „Natürliche Stimmen (Kokoro, Englisch)“ in der App; lib/kokoro.js lädt sherpa-onnx (win-x64-shared, v1.12.20, 26 MB) und das Modell kokoro-int8-en-v0_19 (103 MB) von GitHub nach `userData/kokoro` und entpackt mit dem in Windows 10/11 vorhandenen `tar`. Der EFB bekommt `EFB_KOKORO` und `EFB_KOKORO_DIR`; tts.js ruft `sherpa-onnx-offline-tts.exe` pro Satz auf (Zwischenspeicher in cache/tts). Test: `node app/tools/test-kokoro.js`. Auf einem Linux-Rechner mit dem Linux-Paket wurde die Sprachausgabe geprüft, unter Windows noch nicht. Benötigt die Visual-C++-Laufzeit (auf MSFS-PCs vorhanden).
- **Stimmen (1.3.9):** Katalog um hochwertigere Piper-Stimmen erweitert (Ryan high, Lessac high, Cori high, HFC Male, Joe, John, Norman). Die Bodencrew nimmt automatisch die beste installierte (Ryan high zuerst). Nach dem Installieren in der App unter Stimmen auswählbar.

- **Sim-Modul:** Die App findet den Community-Ordner von MSFS 2024 selbst (aus der UserCfg.opt, Store und Steam) oder du wählst ihn unter „Sim-Modul“. Das Modul `cockpit-efb-link` wird beim App-Start und nach EFB-Updates automatisch installiert bzw. erneuert (abschaltbar). Test: `node tools/test-community.js`.
- **Copilot-Tab:** Einstellungen und Verlauf liegen im Tab „Copilot“ (nicht mehr bei den Checklisten). Das iPad steuert nur: „Starten“ dort startet den Copilot am PC, und die App öffnet bei Bedarf das Copilot-Fenster (App 1.3.8).
- **Audio-Geräte:** Mikrofon und Ausgabe wählst du im Copilot-Fenster unter „Audio-Geräte“. Das ist reine EFB-Funktion (EFB 1.2.7), die App braucht dafür kein Update.
- **Spracherkennung:** whisper-server bleibt mit geladenem Modell im Speicher (EFB 1.2.5). Das Basis-Modell ist für Befehle meist genau genug und schneller.
- **Funk und Geräusche:** Funk-Effekt und Hintergrundgeräusche stellst du im Copilot-Fenster unter „Funk & Geräusche“ ein (EFB 1.2.6).
- **Update-Reihenfolge:** EFB als Release `vX.Y.Z` veröffentlichen (Asset `Cockpit-EFB-X.Y.Z.zip`). App-Änderungen über den Tag `app-vX.Y.Z`. Der Installer wird nicht mehr gebraucht.

## Grenzen

- Spracherkennung (Mikrofon) geht nicht im App-Fenster, nur im Browser (Edge/Chrome, `localhost`). Die Sprachausgabe geht überall. Deshalb öffnet „EFB öffnen“ standardmäßig den Browser.
- Windows zeigt beim ersten Installer-Start „Unbekannter Herausgeber“ (SmartScreen), weil der Installer nicht kostenpflichtig signiert ist: „Weitere Informationen → Trotzdem ausführen“.
- `node-simconnect` wird als reine JavaScript-Bibliothek mitgeliefert. Falls die Sim-Verbindung in der App nicht klappt, im Protokoll nachsehen und mir die Meldung schicken.
