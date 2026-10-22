# Cockpit EFB

An iPad cockpit companion for **Microsoft Flight Simulator 2024**: checklists, SimBrief flight plan, performance calculator, moving map with taxi guidance, GSX control, VATSIM helpers, logbook and a voice copilot (beta). A small bridge on your PC connects the simulator to a web page that you open on your iPad (or any browser on your home network).

🇩🇪 [Deutsche Version](README.de.md)

> **For flight simulation only.** All data and calculators are approximations and must not be used for real-world navigation. No warranty. Cockpit EFB is not affiliated with Microsoft, Asobo, FSDreamTeam, VATSIM or any aircraft add-on developer.

## Download

Everything is free, no account and no token needed, under **[Releases](../../releases/latest)**:

| File | What it is |
|---|---|
| `Cockpit-EFB-Setup-x.y.z.exe` | **Windows app (recommended):** installer with a control window, automatic update check and the voice copilot tools. Contains the app and the speech engine. The natural voices (about 130 MB) are downloaded with one click on the app’s Copilot page. |
| `Cockpit-EFB-x.y.z.zip` | The EFB only (needs Node.js), double-click `start.bat`. For tinkerers. |

The app checks for new versions on start and installs them with one click.

> The installer is not code-signed. Windows SmartScreen may show a warning ("More info" → "Run anyway").

## Quick start

1. Run the installer, open the app, click "Start server".
2. On your iPad open the address shown in the app in Safari (for example `http://192.168.1.20:8090`) and choose your own PIN.
3. In the EFB go to **Setup → Services and map** and enter your SimBrief name.
4. Sim module (optional): the app installs it into your Community folder if you allow it in the settings.

The EFB only works inside your own network. Do not forward its port to the internet.

## Status

- The **voice copilot is beta**: voice control, ground crew and taxi callouts are new and not yet tested everywhere.
- Mostly tested with the Airbus A320 family (FlyByWire, Fenix) in MSFS 2024. Boeing and other add-ons are not verified with the real aircraft.
- The interface is available in German and English (the app and the EFB follow your system language and can be switched in the settings).
- Bugs and wishes are welcome as [issues](../../issues). Please include the version number from the app and the log (App → Log).

## Privacy

There is no developer server, no accounts and no telemetry. Everything runs on your PC. Details: [PRIVACY.md](efb/PRIVACY.md) (German). Third-party components and licenses: [THIRD-PARTY-NOTICES.md](efb/THIRD-PARTY-NOTICES.md).

## License

[MIT](efb/LICENSE). Bundled third-party software has its own licenses (see the notices above).

## For developers

See [README-ENTWICKLER.md](README-ENTWICKLER.md) (German).
