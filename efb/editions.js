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
  { id: 'full', name: 'Voll', desc: 'Alles: zusätzlich ATC-Hilfe, Sprach-Copilot, GSX-Bedienung, Musik (und Lichter in der privaten Ausgabe).', tabs: TABS.map((t) => t[0]) },
  { id: 'voice', name: 'Copilot & Ground', desc: 'Nur Sprach-Copilot und Bodencrew: Stimmen, Checklisten und GSX. Die Einstellungen steuerst du auch direkt im EFB des Simulators (App „Cockpit EFB Link“).', tabs: ['copilot', 'check', 'gsx', 'setup'], voiceOnly: true },
];
const ALWAYS = ['setup']; // immer da, damit man sich nicht aussperrt

function make(dir, { hasLights = false } = {}) {
  const file = path.join(dir, 'edition.json');
  const known = TABS.map((t) => t[0]).filter((t) => t !== 'lights' || hasLights);
  const clean = (tabs) => { const s = new Set([...(tabs || []), ...ALWAYS].filter((t) => known.includes(t))); return known.filter((t) => s.has(t)); };
  const list = () => EDITIONS.map((e) => ({ ...e, tabs: clean(e.tabs) }));
  function current() {
    let o = {}; try { o = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* Standard */ }
    if (o.id === 'custom' && Array.isArray(o.tabs)) return { id: 'custom', name: 'Eigene Auswahl', tabs: clean(o.tabs) };
    const e = list().find((x) => x.id === o.id) || list().find((x) => x.id === 'full');
    return { id: e.id, name: e.name, tabs: e.tabs, voiceOnly: !!e.voiceOnly };
  }
  function info() { return { current: current(), editions: list(), tabs: TABS.filter((t) => known.includes(t[0])).map(([id, label]) => ({ id, label })) }; }
  return { current, info, clean, file };
}
module.exports = { make, TABS, EDITIONS, ALWAYS };
