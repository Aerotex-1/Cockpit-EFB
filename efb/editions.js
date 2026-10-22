// Ausgaben (Editionen) der EFB: welche Tabs sind sichtbar. Die Auswahl trifft die Windows-App und schreibt edition.json
// in den EFB-Ordner; der Server liest sie nur. Ohne Datei gilt „Voll“ (alles wie bisher).
'use strict';
const fs = require('fs');
const path = require('path');

// Alle Tabs mit Namen (Reihenfolge wie in der Seitenleiste)
const TABS = [
  ['flight', 'Flug'], ['efb', 'EFB'], ['ofp', 'OFP'], ['perf', 'Performance'], ['finder', 'Finder'], ['atc', 'ATC'], ['map', 'Karte'], ['charts', 'Charts'],
  ['check', 'Checklisten'], ['copilot', 'Copilot'], ['wx', 'Wetter'], ['gsx', 'GSX'], ['lights', 'Lichter'], ['logbook', 'Logbuch'], ['music', 'Musik'], ['setup', 'Setup'],
];
const EDITIONS = [
  { id: 'lite', name: 'Lite', desc: 'Das Nötigste fürs Cockpit: Flugseite, EFB, OFP, Performance-Rechner und Checklisten. Schlank und übersichtlich.', tabs: ['flight', 'efb', 'ofp', 'perf', 'check', 'setup'] },
  { id: 'medium', name: 'Medium', desc: 'Lite plus Wetter, Charts, Karte, Finder und Logbuch. Für die komplette Flugvorbereitung, ohne Sprach-Copilot und Lotsen-Tools.', tabs: ['flight', 'efb', 'ofp', 'perf', 'finder', 'map', 'charts', 'check', 'wx', 'logbook', 'setup'] },
  { id: 'full', name: 'Voll', desc: 'Alles: zusätzlich ATC-Hilfe, GSX-Bedienung und Musik (in der privaten Version auch Sprach-Copilot und Lichter).', tabs: TABS.map((t) => t[0]) },
  { id: 'voice', name: 'Copilot & Ground', desc: 'Sprach-Copilot samt Bodencrew: Stimmen, Checklisten und GSX. Noch in Entwicklung und vorerst nur in der privaten Version.', tabs: ['copilot', 'check', 'gsx', 'setup'], voiceOnly: true },
];
const ALWAYS = ['setup']; // immer da, damit man sich nicht aussperrt

function make(dir, { hasLights = false, hasCopilot } = {}) {
  if (hasCopilot === undefined) {
    // Der Sprach-Copilot steckt nur in der privaten Version. build.json (vom Bau-Skript) sagt, welche Version das ist: Updates löschen keine alten Dateien,
    // darum zählt eine übrig gebliebene copilot.js in der öffentlichen Version nicht. Ohne build.json (Entwicklung) entscheidet die Datei.
    let kind = ''; try { kind = JSON.parse(fs.readFileSync(path.join(dir, 'build.json'), 'utf8')).kind || ''; } catch { /* keine Datei */ }
    hasCopilot = kind === 'public' ? false : fs.existsSync(path.join(dir, 'public', 'copilot.js'));
  }
  const file = path.join(dir, 'edition.json');
  const known = TABS.map((t) => t[0]).filter((t) => (t !== 'lights' || hasLights) && (t !== 'copilot' || hasCopilot));
  const clean = (tabs) => { const s = new Set([...(tabs || []), ...ALWAYS].filter((t) => known.includes(t))); return known.filter((t) => s.has(t)); };
  const list = () => EDITIONS.map((e) => ({ ...e, tabs: clean(e.tabs), soon: !!(e.voiceOnly && !hasCopilot) })); // soon = „in Entwicklung“, nicht wählbar
  function current() {
    let o = {}; try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* Standard */ }
    if (o.id === 'custom' && Array.isArray(o.tabs)) return { id: 'custom', name: 'Eigene Auswahl', tabs: clean(o.tabs) };
    const e = list().find((x) => x.id === o.id && !x.soon) || list().find((x) => x.id === 'full');
    return { id: e.id, name: e.name, tabs: e.tabs, voiceOnly: !!e.voiceOnly };
  }
  function info() { return { copilot: hasCopilot, current: current(), editions: list(), tabs: TABS.filter((t) => known.includes(t[0])).map(([id, label]) => ({ id, label })) }; }
  return { current, info, clean, file };
}
module.exports = { make, TABS, EDITIONS, ALWAYS };
