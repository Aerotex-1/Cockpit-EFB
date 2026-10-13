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

Der Installer enthält Piper und zwei Stimmen (Thorsten deutsch, Lessac englisch). Beim Bauen lädt `npm run dist` (bzw. der GitHub-Workflow) sie automatisch von GitHub und Hugging Face; der Installer wird dadurch etwa 230 MB groß. Weitere Stimmen lädt der Nutzer in der App unter **Copilot → Eingebaute Stimmen** nach (sie liegen in `%APPDATA%\cockpit-efb-app\voices` und bleiben bei Updates erhalten). Lizenzen der Stimmen: siehe `efb/THIRD-PARTY-NOTICES.md`.

## Wo liegen die Daten?

`%APPDATA%\cockpit-efb-app\efb` (Knopf „Ordner öffnen“ in der App). Beim Deinstallieren bleibt dieser Ordner erhalten.

## Stand dieser Version (App 1.3.8, enthält EFB 1.2.10)
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
