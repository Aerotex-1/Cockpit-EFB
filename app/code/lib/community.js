// Sim-Modul „cockpit-efb-link“ im Community-Ordner von MSFS 2024 finden, installieren und aktuell halten.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MOD = 'cockpit-efb-link';

// Mögliche UserCfg.opt-Dateien (Microsoft Store und Steam); aus ihnen wird der Pfad der installierten Pakete gelesen
function cfgFiles(env = process.env) {
  const la = env.LOCALAPPDATA || '', ra = env.APPDATA || '';
  return [
    path.join(la, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalCache', 'UserCfg.opt'),
    path.join(ra, 'Microsoft Flight Simulator 2024', 'UserCfg.opt'),
  ];
}
function detect(env = process.env) {
  const out = [];
  for (const cfg of cfgFiles(env)) {
    try {
      const m = fs.readFileSync(cfg, 'utf8').match(/InstalledPackagesPath\s+"([^"]+)"/);
      if (m) { const dir = path.join(m[1], 'Community'); if (fs.existsSync(dir)) out.push({ dir, source: cfg }); }
    } catch { /* nicht vorhanden */ }
  }
  return out;
}
// Ein selbst gewählter Ordner darf der Community-Ordner selbst oder der Ordner darüber sein
function normalizeManual(p) {
  p = String(p || '').trim().replace(/[\\/]+$/, ''); if (!p) return '';
  try {
    if (path.basename(p).toLowerCase() === 'community' && fs.statSync(p).isDirectory()) return p;
    const sub = path.join(p, 'Community'); if (fs.statSync(sub).isDirectory()) return sub;
  } catch { /* gibt es nicht */ }
  return '';
}
function resolve(manual, env = process.env) {
  if (manual) { const d = normalizeManual(manual); return d ? { dir: d, mode: 'manual' } : { dir: '', mode: 'manual', error: 'Der gewählte Ordner ist kein Community-Ordner (er heißt „Community“ oder enthält einen).' }; }
  const f = detect(env)[0];
  return f ? { dir: f.dir, mode: 'auto' } : { dir: '', mode: 'auto', error: 'Community-Ordner nicht gefunden. Bitte unter „Sim-Modul“ den Ordner selbst wählen.' };
}
function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else out.push(p);
  }
  return out;
}
function hash(dir) {
  const h = crypto.createHash('sha1');
  try { for (const f of walk(dir)) { h.update(path.relative(dir, f).replace(/\\/g, '/')); h.update(fs.readFileSync(f)); } } catch { return ''; }
  return h.digest('hex');
}
// efbDir: Ordner der EFB (enthält community/cockpit-efb-link)
function status(efbDir, manual, env) {
  const src = path.join(efbDir, 'community', MOD);
  const r = resolve(manual, env);
  const res = { ...r, hasSource: fs.existsSync(src), installed: false, upToDate: false, target: r.dir ? path.join(r.dir, MOD) : '' };
  if (r.dir) { res.installed = fs.existsSync(res.target); res.upToDate = res.installed && hash(src) === hash(res.target); }
  return res;
}
// installiert bzw. überschreibt das Modul; ändert nichts, wenn es schon aktuell ist
function install(efbDir, manual, env) {
  const st = status(efbDir, manual, env);
  if (!st.hasSource) throw new Error('Das Sim-Modul fehlt in der EFB (Ordner community). Bitte die EFB aktualisieren.');
  if (!st.dir) throw new Error(st.error);
  if (st.upToDate) return { ...st, changed: false };
  fs.rmSync(st.target, { recursive: true, force: true });
  fs.cpSync(path.join(efbDir, 'community', MOD), st.target, { recursive: true });
  return { ...status(efbDir, manual, env), changed: true };
}
module.exports = { MOD, detect, resolve, normalizeManual, status, install, hash };
