// Ausgaben der EFB (Lite, Medium, Voll, Copilot & Ground, eigene Auswahl): die Definitionen kommen aus der EFB selbst
// (editions.js), die Auswahl wird als edition.json im EFB-Ordner gespeichert und vom EFB-Server gelesen.
'use strict';
const fs = require('fs');
const path = require('path');

function mod(efbDir, bundleDir) {
  for (const d of [efbDir, bundleDir]) {
    if (!d) continue;
    const f = path.join(d, 'editions.js');
    if (fs.existsSync(f)) { try { delete require.cache[require.resolve(f)]; return { m: require(f), installed: d === efbDir }; } catch { /* nächster */ } }
  }
  return null;
}
function make(efbDir, bundleDir) {
  const r = mod(efbDir, bundleDir); if (!r) return null;
  return { ed: r.m.make(efbDir, { hasLights: fs.existsSync(path.join(efbDir, 'lights.js')) }), installed: r.installed };
}
// Stand für die Oberfläche; supported = false, wenn die installierte EFB noch keine Ausgaben kennt
function status(efbDir, bundleDir) {
  const x = make(efbDir, bundleDir); if (!x) return { supported: false, current: { id: 'full', name: 'Voll', tabs: [] }, editions: [], tabs: [] };
  return { supported: x.installed, ...x.ed.info() };
}
// sel: { id: 'lite' } oder { id: 'custom', tabs: ['flight', …] }
function set(efbDir, bundleDir, sel) {
  const x = make(efbDir, bundleDir); if (!x || !x.installed) throw new Error('Die installierte EFB kennt noch keine Ausgaben. Bitte unter „Updates“ zuerst die EFB aktualisieren.');
  const info = x.ed.info(); let out;
  if (sel && sel.id === 'custom') {
    const tabs = x.ed.clean(Array.isArray(sel.tabs) ? sel.tabs : []);
    if (tabs.length < 2) throw new Error('Wähle mindestens einen Tab (zusätzlich zu Setup).');
    out = { id: 'custom', tabs };
  } else if (sel && info.editions.some((e) => e.id === sel.id && !e.soon)) out = { id: sel.id };
  else if (sel && info.editions.some((e) => e.id === sel.id && e.soon)) throw new Error('Diese Version ist noch in Entwicklung und vorerst nur in der privaten Version verfügbar.');
  else throw new Error('Unbekannte Version.');
  fs.writeFileSync(path.join(efbDir, 'edition.json'), JSON.stringify(out, null, 2));
  return status(efbDir, bundleDir);
}
module.exports = { status, set };
