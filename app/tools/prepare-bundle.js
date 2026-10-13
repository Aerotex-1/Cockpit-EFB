// Kopiert die EFB aus ../efb nach efb-bundle (ohne persönliche Dateien) – wird beim Bauen mitgeliefert.
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..', 'efb'), dst = path.join(__dirname, '..', 'efb-bundle');
const SKIP = /^(node_modules|backgrounds|cache|_backup|_update|auth\.json|settings\.json|logbook.*\.json|last-ofp\.json|copilot\.json|\.git)$/;
if (!fs.existsSync(path.join(src, 'server.js'))) { console.error('Ordner ../efb mit der EFB fehlt (server.js nicht gefunden).'); process.exit(1); }
fs.rmSync(dst, { recursive: true, force: true });
const cp = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const e of fs.readdirSync(a, { withFileTypes: true })) { if (SKIP.test(e.name)) continue; const x = path.join(a, e.name), y = path.join(b, e.name); e.isDirectory() ? cp(x, y) : fs.copyFileSync(x, y); } };
cp(src, dst);
try { const c = path.join(dst, 'config.json'); const j = JSON.parse(fs.readFileSync(c, 'utf8')); delete j.pin; fs.writeFileSync(c, JSON.stringify(j, null, 2)); } catch { /* keine config */ }
console.log('EFB-Paket vorbereitet:', JSON.parse(fs.readFileSync(path.join(dst, 'package.json'))).version);
