// Lädt die freien OurAirports-Daten (Public Domain) und erzeugt public/data/airports.json
// Aufruf: node tools/import-ourairports.js [--all]   (ohne --all: nur Flughäfen mit Linienverkehr)
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = process.env.OURAIRPORTS_BASE || 'https://davidmegginson.github.io/ourairports-data';
const OUT = path.join(__dirname, '..', 'public', 'data', 'airports.json');

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift() || [];
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function build(airportsCsv, runwaysCsv, all) {
  const longest = new Map();
  for (const r of parseCsv(runwaysCsv)) {
    if (r.closed === '1') continue;
    const ft = Number(r.length_ft); if (!ft) continue;
    const k = r.airport_ident; longest.set(k, Math.max(longest.get(k) || 0, ft));
  }
  const out = [];
  for (const a of parseCsv(airportsCsv)) {
    if (!/^(large|medium)_airport$/.test(a.type) && !(all && a.type === 'small_airport')) continue;
    if (!all && a.scheduled_service !== 'yes') continue;
    const icao = (a.gps_code || a.ident || '').toUpperCase();
    if (!/^[A-Z]{4}$/.test(icao)) continue;
    const ft = longest.get(a.ident) || longest.get(icao); if (!ft) continue;
    const lat = Number(a.latitude_deg), lon = Number(a.longitude_deg); if (!isFinite(lat) || !isFinite(lon)) continue;
    out.push({ icao, iata: a.iata_code || '', name: a.municipality || a.name, cc: a.iso_country, lat: Math.round(lat * 1e4) / 1e4, lon: Math.round(lon * 1e4) / 1e4, elev: Math.round(Number(a.elevation_ft) || 0), rwy: Math.round(ft * 0.3048), eu: a.continent === 'EU' });
  }
  out.sort((x, y) => x.icao.localeCompare(y.icao));
  return out;
}

async function main() {
  const all = process.argv.includes('--all');
  const get = async (f) => { const r = await fetch(`${BASE}/${f}`); if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.text(); };
  console.log('Lade Flughafendaten von OurAirports …');
  const [a, r] = await Promise.all([get('airports.csv'), get('runways.csv')]);
  const list = build(a, r, all);
  if (list.length < 100) throw new Error(`Nur ${list.length} Flughäfen gefunden, Datei bleibt unverändert.`);
  fs.copyFileSync(OUT, OUT + '.bak');
  fs.writeFileSync(OUT, JSON.stringify(list));
  console.log(`Fertig: ${list.length} Flughäfen in public/data/airports.json (Sicherung: airports.json.bak).`);
}
if (require.main === module) main().catch((e) => { console.error('Fehler:', e.message); process.exit(1); });
module.exports = { parseCsv, build };
