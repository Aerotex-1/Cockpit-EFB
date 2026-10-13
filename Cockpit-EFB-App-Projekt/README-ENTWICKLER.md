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

## Neue App-Version (selten)

Nur nötig, wenn sich die App selbst ändert (Fenster, Einstellungen). Neuen Tag `app-v1.0.1` als Release veröffentlichen; GitHub baut den Installer. Die App meldet das als „App-Update“ und startet den Installer. Soll der Installer auch eine neuere EFB mitbringen, ersetze vorher den Ordner `efb/` im Repository durch die neue EFB (ZIP entpacken).

## Selbst bauen (optional)

```
cd app
npm install
npm start        # Entwicklungsstart
npm run dist     # Installer in app/dist
```
(Node.js 20 oder neuer nötig.)

## Wo liegen die Daten?

`%APPDATA%\cockpit-efb-app\efb` (Knopf „Ordner öffnen“ in der App). Beim Deinstallieren bleibt dieser Ordner erhalten.

## Grenzen

- Spracherkennung (Mikrofon) geht nicht im App-Fenster, nur im Browser (Edge/Chrome, `localhost`). Die Sprachausgabe geht überall. Deshalb öffnet „EFB öffnen“ standardmäßig den Browser.
- Windows zeigt beim ersten Installer-Start „Unbekannter Herausgeber“ (SmartScreen), weil der Installer nicht kostenpflichtig signiert ist: „Weitere Informationen → Trotzdem ausführen“.
- `node-simconnect` wird als reine JavaScript-Bibliothek mitgeliefert. Falls die Sim-Verbindung in der App nicht klappt, im Protokoll nachsehen und mir die Meldung schicken.
