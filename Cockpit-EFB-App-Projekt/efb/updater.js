// Update aus einer ZIP-Datei: entpackt (ohne Zusatzpakete), ersetzt Programmdateien und
// lässt persönliche Dateien unangetastet. Überschriebene Dateien landen vorher in _backup/.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = __dirname;
// Diese Pfade gehören dem Nutzer und werden nie überschrieben.
const KEEP = [/^copilot\.json$/, /^auth\.json$/, /^settings\.json$/, /^logbook[^/]*\.json$/, /^last-ofp\.json$/, /^config\.json$/, /^backgrounds\//, /^cache\//, /^node_modules\//, /^_backup\//, /^_update\//, /^charts\//];

function readZip(buf) {
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Das ist keine gültige ZIP-Datei.');
  const n = buf.readUInt16LE(e + 10);
  let off = buf.readUInt32LE(e + 16);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('ZIP beschädigt.');
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20), usize = buf.readUInt32LE(off + 24);
    const nl = buf.readUInt16LE(off + 28), el = buf.readUInt16LE(off + 30), cl = buf.readUInt16LE(off + 32);
    const lo = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nl).toString('utf8');
    off += 46 + nl + el + cl;
    if (name.endsWith('/')) continue;
    if (buf.readUInt32LE(lo) !== 0x04034b50) throw new Error('ZIP beschädigt.');
    const ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
    const raw = buf.slice(ds, ds + csize);
    const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
    if (!data) throw new Error('Nicht unterstützte ZIP-Kompression.');
    if (data.length !== usize) throw new Error('ZIP beschädigt (Größe).');
    out.push({ name, data });
  }
  return out;
}

function install(buf, root) {
  return apply(readZip(buf), root || ROOT);
}

// Ordner (z. B. mitgelieferte EFB) über die Installation legen – gleiche Schutzregeln wie beim ZIP
function installDir(src, root) {
  const out = [];
  const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel + e.name; if (e.isDirectory()) walk(path.join(d, e.name), r + '/'); else out.push({ name: 'cockpit-efb/' + r, data: fs.readFileSync(path.join(d, e.name)) }); } };
  walk(src, '');
  return apply(out, root || ROOT);
}

function apply(files, ROOT) {
  if (!files.length) throw new Error('Die ZIP-Datei ist leer.');
  // gemeinsamer Ordner (z. B. "cockpit-efb/") – das Paket muss server.js und package.json enthalten
  const pk = files.find((f) => /(^|\/)package\.json$/.test(f.name) && f.name.split('/').length <= 2);
  if (!pk) throw new Error('Keine Cockpit-EFB-Datei: package.json fehlt.');
  let meta; try { meta = JSON.parse(pk.data.toString('utf8')); } catch { throw new Error('package.json ist unlesbar.'); }
  if (meta.name !== 'cockpit-efb') throw new Error('Das ist kein Cockpit-EFB-Update.');
  const prefix = pk.name.slice(0, pk.name.length - 'package.json'.length);
  if (!files.some((f) => f.name === prefix + 'server.js')) throw new Error('server.js fehlt im Update.');
  let oldVer = '0'; try { oldVer = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version; } catch { /* Erstinstallation */ }
  const bdir = path.join(ROOT, '_backup', `${oldVer}-${Date.now()}`);
  let n = 0, kept = 0;
  for (const f of files) {
    if (!f.name.startsWith(prefix)) continue;
    const rel = f.name.slice(prefix.length);
    if (!rel || rel.includes('..') || path.isAbsolute(rel) || rel.includes('\\')) continue;
    if (KEEP.some((re) => re.test(rel))) { if (fs.existsSync(path.join(ROOT, rel))) { kept++; continue; } if (!/^(config\.json)$/.test(rel)) continue; }
    const dst = path.join(ROOT, rel);
    if (!path.resolve(dst).startsWith(ROOT + path.sep)) continue;
    let same = false;
    if (fs.existsSync(dst)) {
      const old = fs.readFileSync(dst);
      same = old.equals(f.data);
      if (!same) { const b = path.join(bdir, rel); fs.mkdirSync(path.dirname(b), { recursive: true }); fs.writeFileSync(b, old); }
    }
    if (same) continue;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, f.data);
    n++;
  }
  // nur die letzten drei Sicherungen behalten
  try {
    const bd = path.join(ROOT, '_backup');
    const all = fs.readdirSync(bd).sort();
    for (const d of all.slice(0, Math.max(0, all.length - 3))) fs.rmSync(path.join(bd, d), { recursive: true, force: true });
  } catch { /* keine Sicherungen */ }
  return { from: oldVer, to: meta.version, changed: n, kept };
}

module.exports = { install, installDir, readZip, KEEP };
