// Kopiert das Sim-Modul "cockpit-efb-link" in den Community-Ordner von MSFS 2024.
// Der Community-Ordner wird aus der UserCfg.opt gelesen (Store- und Steam-Version).

const fs = require('fs');
const path = require('path');

const la = process.env.LOCALAPPDATA || '', ra = process.env.APPDATA || '';
const cfgs = [
  path.join(la, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache', 'UserCfg.opt'),
  path.join(ra, 'Microsoft Flight Simulator 2024', 'UserCfg.opt'),
];

let community = null;
for (const cfg of cfgs) {
  try {
    const m = fs.readFileSync(cfg, 'utf8').match(/InstalledPackagesPath\s+"([^"]+)"/);
    if (m) { community = path.join(m[1], 'Community'); console.log('Gefunden in', cfg); break; }
  } catch { /* nicht vorhanden */ }
}
if (!community || !fs.existsSync(community)) {
  console.log('Der Community-Ordner wurde nicht gefunden.');
  console.log('Kopiere den Ordner "community\\cockpit-efb-link" bitte von Hand in deinen Community-Ordner.');
  process.exit(1);
}

const src = path.join(__dirname, 'community', 'cockpit-efb-link');
const dst = path.join(community, 'cockpit-efb-link');
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true });
console.log('Sim-Modul installiert nach:', dst);
console.log('Starte den Sim neu (falls er läuft) und öffne einmal das EFB.');
