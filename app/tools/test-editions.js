// Test: Ausgaben (Lite, Medium, Voll, Copilot & Ground, eigene Auswahl) wählen und lesen
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const ed = require('../code/lib/editions');
const efbSrc = path.join(__dirname, '..', '..', 'efb');
const t = fs.mkdtempSync(path.join(os.tmpdir(), 'ed-')), efb = path.join(t, 'efb'); fs.mkdirSync(efb);
fs.copyFileSync(path.join(efbSrc, 'editions.js'), path.join(efb, 'editions.js'));
let s = ed.status(efb, null);
assert(s.supported); assert.equal(s.current.id, 'full'); assert(s.current.tabs.includes('copilot'));          // ohne Datei: alles wie bisher
assert.deepEqual(s.editions.map((e) => e.id), ['lite', 'medium', 'full', 'voice']);
s = ed.set(efb, null, { id: 'lite' }); assert.equal(s.current.id, 'lite'); assert(!s.current.tabs.includes('copilot')); assert(s.current.tabs.includes('perf')); assert(s.current.tabs.includes('setup'));
s = ed.set(efb, null, { id: 'voice' }); assert.deepEqual(s.current.tabs, ['check', 'copilot', 'gsx', 'setup']); assert(s.current.voiceOnly);
s = ed.set(efb, null, { id: 'custom', tabs: ['map', 'flight', 'xyz'] }); assert.equal(s.current.id, 'custom'); assert.deepEqual(s.current.tabs, ['flight', 'map', 'setup']);   // unbekannte Tabs fliegen raus, Setup ist immer da
assert.throws(() => ed.set(efb, null, { id: 'custom', tabs: [] }), /mindestens/);
assert.throws(() => ed.set(efb, null, { id: 'gibtsnicht' }), /Unbekannte/);
assert.equal(JSON.parse(fs.readFileSync(path.join(efb, 'edition.json'), 'utf8')).id, 'custom');
// Lichter nur, wenn die EFB sie hat (private Ausgabe)
assert(!ed.status(efb, null).tabs.some((x) => x.id === 'lights')); fs.writeFileSync(path.join(efb, 'lights.js'), '');
assert(ed.status(efb, null).tabs.some((x) => x.id === 'lights')); assert(ed.set(efb, null, { id: 'full' }).current.tabs.includes('lights'));
// ältere EFB ohne editions.js: nicht unterstützt, Wechsel verweigert
const old = path.join(t, 'old'); fs.mkdirSync(old);
assert.equal(ed.status(old, null).supported, false); assert.throws(() => ed.set(old, null, { id: 'lite' }), /noch keine Ausgaben/);
console.log('Ausgaben: ok');
