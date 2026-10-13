// ATC-Übersicht für VATSIM: Lotsen am Abflug- und Zielflughafen und entlang der Route.
// Reine Anzeige – es wird nichts an den Simulator gesendet.
//
// Die FIR-Grenzen kommen aus dem VATSpy-Datenprojekt (GitHub). Sie werden beim ersten Start
// geladen und in cache/ zwischengespeichert. Ohne diese Dateien zeigt die App nur die Flughäfen.

const fs = require('fs');
const path = require('path');
const vatsim = require('./vatsim');

const BASE = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/';
const CACHE = path.join(__dirname, 'cache');
const MAX_AGE = 14 * 86400000;

let boundaries = null; // [{ id, bbox, polys: [[ring...], ...] }]
let firInfo = null;    // id -> { icao, name, prefix }
let loading = null;
let loadError = null;

async function cached(name) {
  const file = path.join(CACHE, name);
  try { if (Date.now() - fs.statSync(file).mtimeMs < MAX_AGE) return fs.readFileSync(file, 'utf8'); } catch { /* neu laden */ }
  try {
    const r = await fetch(BASE + name, { headers: { 'User-Agent': 'CockpitEFB' } });
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    const t = await r.text();
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, t);
    return t;
  } catch (e) {
    try { return fs.readFileSync(file, 'utf8'); } catch { throw e; } // alte Kopie ist besser als keine
  }
}

// Zeilen im Abschnitt [FIRs]: ICAO|Name|Rufzeichen-Präfix|FIR-Grenze
function parseFirs(dat) {
  const out = {};
  let inFirs = false;
  for (const raw of String(dat).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.startsWith('[')) { inFirs = /^\[FIRs\]/i.test(line); continue; }
    if (!inFirs) continue;
    const [icao, name, prefix, id] = line.split('|');
    if (!icao) continue;
    out[(id || icao).trim()] = { icao: icao.trim(), name: (name || '').trim(), prefix: (prefix || icao).trim() };
  }
  return out;
}

function parseBoundaries(json) {
  const gj = typeof json === 'string' ? JSON.parse(json) : json;
  const out = [];
  for (const f of gj.features || []) {
    const g = f.geometry; if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    let w = 180, e = -180, s = 90, n = -90;
    for (const poly of polys) for (const [lon, lat] of poly[0]) { w = Math.min(w, lon); e = Math.max(e, lon); s = Math.min(s, lat); n = Math.max(n, lat); }
    const p = f.properties || {};
    out.push({ id: String(p.id || p.ICAO || ''), oceanic: String(p.oceanic) === '1', bbox: [s, w, n, e], polys });
  }
  return out;
}

async function ensure() {
  if (boundaries) return true;
  if (!loading) {
    loading = (async () => {
      try {
        boundaries = parseBoundaries(await cached('Boundaries.geojson'));
        try { firInfo = parseFirs(await cached('VATSpy.dat')); } catch { firInfo = {}; }
        loadError = null;
      } catch (e) { loadError = e.message; boundaries = null; }
      finally { loading = null; }
    })();
  }
  await loading;
  return !!boundaries;
}

function inRing(lat, lon, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function boundaryAt(lat, lon) {
  let best = null;
  for (const b of boundaries) {
    const [s, w, n, e] = b.bbox;
    if (lat < s || lat > n || lon < w || lon > e) continue;
    for (const poly of b.polys) {
      if (inRing(lat, lon, poly[0]) && !poly.slice(1).some((h) => inRing(lat, lon, h))) {
        if (!best || (best.oceanic && !b.oceanic)) best = b; // normale FIR vor ozeanischer
        break;
      }
    }
  }
  return best;
}

// Zwischenpunkte entlang der Route (alle ca. 25 NM), damit keine FIR zwischen zwei Wegpunkten übersehen wird
function densify(points) {
  const out = [];
  const rad = Math.PI / 180;
  for (let i = 0; i < points.length; i++) {
    out.push(points[i]);
    if (i === points.length - 1) break;
    const [a, b] = [points[i], points[i + 1]];
    const d = Math.hypot((b[0] - a[0]), (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * rad)) * 60; // grob in NM
    const n = Math.min(40, Math.floor(d / 25));
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / (n + 1), a[1] + ((b[1] - a[1]) * k) / (n + 1)]);
  }
  return out;
}

const ROLE = { 2: 'DEL', 3: 'GND', 4: 'TWR', 5: 'APP', 6: 'CTR', 1: 'FSS' };
const mapC = (c) => ({ cs: c.cs, freq: c.freq, name: c.name, role: ROLE[c.facility] || '', facility: c.facility });
const norm = (cs) => String(cs || '').toUpperCase();

// body: { points: [[lat, lon], ...], dep, dest, alts: [], callsign }
async function query(body) {
  const d = await vatsim.load();
  const firOk = (body.points || []).length ? await ensure() : false;
  const airportMatch = (icao) => {
    const a = norm(icao); if (!a) return [];
    return d.controllers.filter((c) => c.cs.startsWith(a + '_') || c.cs.startsWith(a.slice(1) + '_')).filter((c) => c.facility >= 2 && c.facility <= 5).map(mapC)
      .sort((x, y) => x.facility - y.facility);
  };
  const atisFor = (icao) => {
    const a = norm(icao);
    return d.atis.filter((x) => x.cs.startsWith(a + '_') || x.cs.startsWith(a.slice(1) + '_')).map((x) => ({ cs: x.cs, freq: x.freq, code: x.code, text: x.text }));
  };
  const airport = (icao) => (icao ? { icao: norm(icao), atis: atisFor(icao), controllers: airportMatch(icao) } : null);

  // FIRs entlang der Route, in Flugreihenfolge
  const firs = [];
  if (firOk) {
    for (const [lat, lon] of densify(body.points)) {
      const b = boundaryAt(lat, lon);
      if (b && !firs.some((f) => f.id === b.id)) {
        const info = (firInfo && firInfo[b.id]) || {};
        firs.push({ id: b.id, icao: info.icao || b.id.split('-')[0], name: info.name || '', prefix: info.prefix || b.id.split('-')[0], oceanic: b.oceanic });
      }
    }
  }
  const enroute = firs.map((f) => {
    const pre = norm(f.prefix) + '_';
    const own = d.controllers.filter((c) => (c.facility === 6 || c.facility === 1) && c.cs.startsWith(pre)).map(mapC);
    return { fir: f.id, name: f.name, prefix: f.prefix, controllers: own };
  }).reduce((acc, e) => { // Teilsektoren derselben FIR (z. B. EDMM-N und EDMM-S) zu einer Zeile zusammenfassen
    const same = acc.find((x) => x.prefix === e.prefix);
    if (same) { same.fir += ` / ${e.fir}`; } else acc.push(e);
    return acc;
  }, []);

  let me = null;
  if (body.callsign) {
    const p = d.pilots.find((x) => norm(x.cs) === norm(body.callsign));
    if (p) me = { cs: p.cs, squawk: p.squawk, assigned: p.assigned && p.assigned !== '0000' ? p.assigned : '', route: p.route, alt: p.fpAlt, dep: p.dep, arr: p.arr };
  }
  return {
    updated: d.updated, boundaries: firOk, boundaryError: firOk ? null : (body.points || []).length ? loadError : null,
    dep: airport(body.dep), dest: airport(body.dest), alts: (body.alts || []).filter(Boolean).slice(0, 3).map(airport), enroute, me,
  };
}

const demo = require('./atc-demo');
module.exports = { demo, query, parseFirs, parseBoundaries, boundaryAt, _setBoundaries: (b, f) => { boundaries = b; firInfo = f; } };
