// Höhenwind und Wolkenbedeckung (Open-Meteo, kostenlos, kein Schlüssel) sowie Bodenkarten-Cache (OpenStreetMap/Overpass)
'use strict';
const fs = require('fs');
const path = require('path');
const CACHE = path.join(__dirname, 'cache');

// Flugfläche -> Druckfläche (ISA, gerundet)
const LEVELS = [
  { id: 'sfc', label: 'Boden', fl: 0 },
  { id: '925', label: 'FL030', fl: 30 },
  { id: '850', label: 'FL050', fl: 50 },
  { id: '700', label: 'FL100', fl: 100 },
  { id: '500', label: 'FL180', fl: 180 },
  { id: '400', label: 'FL240', fl: 240 },
  { id: '300', label: 'FL300', fl: 300 },
  { id: '250', label: 'FL340', fl: 340 },
  { id: '200', label: 'FL390', fl: 390 },
];
const PL = LEVELS.filter((l) => l.id !== 'sfc').map((l) => l.id);
const API = () => process.env.WX_API_BASE || 'https://api.open-meteo.com';
const memo = new Map();

function hourIndex(times) {
  const now = new Date().toISOString().slice(0, 13);
  const i = (times || []).findIndex((t) => String(t).slice(0, 13) === now);
  return i < 0 ? 0 : i;
}
function pick(h, name, i) { const a = h && h[name]; return a ? a[i] : null; }

// Ein Punkt (Antwortobjekt von Open-Meteo) -> { sfc:{dir,kt,cloud}, 850:{...}, ... }
function normalize(o) {
  const h = o.hourly || {}, i = hourIndex(h.time), out = { levels: {}, time: (h.time || [])[i] || null };
  out.levels.sfc = { dir: pick(h, 'wind_direction_10m', i), kt: pick(h, 'wind_speed_10m', i), cloud: pick(h, 'cloud_cover', i), low: pick(h, 'cloud_cover_low', i), mid: pick(h, 'cloud_cover_mid', i), high: pick(h, 'cloud_cover_high', i), temp: pick(h, 'temperature_2m', i) };
  for (const p of PL) out.levels[p] = { dir: pick(h, `wind_direction_${p}hPa`, i), kt: pick(h, `wind_speed_${p}hPa`, i), cloud: pick(h, `cloud_cover_${p}hPa`, i), temp: pick(h, `temperature_${p}hPa`, i) };
  return out;
}
const VARS = ['wind_speed_10m', 'wind_direction_10m', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'temperature_2m',
  ...PL.flatMap((p) => [`wind_speed_${p}hPa`, `wind_direction_${p}hPa`, `cloud_cover_${p}hPa`, `temperature_${p}hPa`])];

async function fetchPoints(pts) {
  const key = pts.map((p) => p.map((x) => x.toFixed(2)).join(',')).join(';');
  const hit = memo.get(key);
  if (hit && Date.now() - hit.t < 15 * 60000) return hit.v;
  const u = `${API()}/v1/forecast?latitude=${pts.map((p) => p[0].toFixed(3)).join(',')}&longitude=${pts.map((p) => p[1].toFixed(3)).join(',')}&hourly=${VARS.join(',')}&wind_speed_unit=kn&timezone=GMT&forecast_days=1`;
  const r = await fetch(u, { headers: { 'User-Agent': 'CockpitEFB (privat)' } });
  if (!r.ok) throw new Error(`Wetterdienst antwortet mit ${r.status}`);
  let d = await r.json();
  if (!Array.isArray(d)) d = [d];
  const v = d.map(normalize);
  memo.set(key, { t: Date.now(), v });
  if (memo.size > 40) memo.delete(memo.keys().next().value);
  return v;
}

// Raster über den sichtbaren Kartenausschnitt: bbox = [s,w,n,e]
async function grid(bbox) {
  const [s, w, n, e] = bbox.map(Number);
  if (![s, w, n, e].every(isFinite) || n <= s || e <= w) throw new Error('Ungültiger Ausschnitt');
  const cols = 7, rows = 5, pts = [];
  // auf 0,25° einrasten, damit Cache-Treffer beim Verschieben häufiger sind
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lat = s + ((r + 0.5) / rows) * (n - s), lon = w + ((c + 0.5) / cols) * (e - w);
    pts.push([Math.max(-85, Math.min(85, Math.round(lat * 4) / 4)), Math.round(lon * 4) / 4]);
  }
  const v = await fetchPoints(pts);
  return { levels: LEVELS, points: pts.map((p, i) => ({ lat: p[0], lon: p[1], ...v[i] })), time: (v[0] || {}).time };
}
async function profile(lat, lon) {
  const v = await fetchPoints([[Number(lat), Number(lon)]]);
  return { levels: LEVELS, point: { lat: Number(lat), lon: Number(lon), ...v[0] }, time: v[0].time };
}

// ---------- Bodenkarte (Overpass) mit Festplatten-Cache ----------
async function ground(bbox, overpassUrl) {
  const [s, w, n, e] = bbox.map(Number);
  if (![s, w, n, e].every(isFinite) || n - s > 0.5 || e - w > 0.8) throw new Error('Ausschnitt zu groß');
  const f = path.join(CACHE, `ground2-${s.toFixed(2)}_${w.toFixed(2)}_${n.toFixed(2)}_${e.toFixed(2)}.json`);
  try { const st = fs.statSync(f); if (Date.now() - st.mtimeMs < 30 * 86400000) return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* neu laden */ }
  const q = `[out:json][timeout:25];(way["aeroway"~"^(runway|taxiway|taxilane|apron)$"](${s},${w},${n},${e});node["aeroway"~"^(parking_position|gate|holding_position)$"](${s},${w},${n},${e});way["aeroway"~"^(parking_position|terminal)$"](${s},${w},${n},${e});way["aeroway"~"de-?ic",i](${s},${w},${n},${e});way["apron"~"de-?ic",i](${s},${w},${n},${e});way["name"~"de-?ic|enteis",i]["aeroway"](${s},${w},${n},${e});node["aeroway"~"de-?ic",i](${s},${w},${n},${e}););out geom;`;
  // Der öffentliche Overpass-Server ist oft ausgelastet: mehrere Server nacheinander versuchen, zur Not alte Daten zeigen
  const own = (process.env.OVERPASS_BASE || overpassUrl || '').replace(/\/+$/, '');
  const bases = [own, 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'].filter(Boolean);
  let last = null;
  for (const b of [...new Set(bases)]) {
    try {
      const r = await fetch(/interpreter$/.test(b) ? b : b + '/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'CockpitEFB (privat)' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { last = new Error(`OpenStreetMap antwortet mit ${r.status}`); continue; }
      const d = await r.json();
      if (!Array.isArray(d.elements)) { last = new Error('OpenStreetMap lieferte keine Daten'); continue; }
      try { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(f, JSON.stringify(d)); } catch { /* egal */ }
      return d;
    } catch (e) { last = e; }
  }
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* kein alter Stand */ }
  throw last || new Error('OpenStreetMap nicht erreichbar');
}

// ---------- Demo (feste, glatte Beispieldaten) ----------
function demoPoint(lat, lon) {
  const levels = {};
  LEVELS.forEach((l, i) => {
    const dir = (230 + i * 8 + Math.sin(lon / 3) * 25 + Math.cos(lat / 2) * 15 + 360) % 360;
    const kt = Math.round(8 + i * i * 2.2 + Math.abs(Math.sin(lat / 2 + lon / 5)) * 12);
    const cloud = Math.round(Math.max(0, Math.min(100, 50 + 45 * Math.sin(lat * 0.9 + lon * 0.5 + i * 1.3))));
    levels[l.id] = { dir: Math.round(dir), kt, cloud, temp: Math.round(15 - i * 7), ...(l.id === 'sfc' ? { low: 40, mid: 20, high: 60 } : {}) };
  });
  return { levels };
}
function demoGrid(bbox) {
  const [s, w, n, e] = bbox.map(Number), pts = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) { const lat = s + ((r + 0.5) / 5) * (n - s), lon = w + ((c + 0.5) / 7) * (e - w); pts.push({ lat, lon, ...demoPoint(lat, lon) }); }
  return { levels: LEVELS, points: pts, time: new Date().toISOString().slice(0, 13) + ':00', demo: true };
}
function demoProfile(lat, lon) { return { levels: LEVELS, point: { lat: +lat, lon: +lon, ...demoPoint(+lat, +lon) }, time: new Date().toISOString().slice(0, 13) + ':00', demo: true }; }


// Kleiner Beispielflughafen um die Mitte des Ausschnitts (nur Demo)
function demoGround(bbox) {
  const [s, w, n, e] = bbox.map(Number), la = (s + n) / 2, lo = (w + e) / 2, kx = 1 / (111320 * Math.cos(la * Math.PI / 180)), ky = 1 / 110540;
  const P = (x, y) => ({ lat: la + y * ky, lon: lo + x * kx });
  const way = (id, tags, pts) => ({ type: 'way', id, tags, geometry: pts.map(([x, y]) => P(x, y)) });
  const el = [
    way(1, { aeroway: 'runway', ref: '08L/26R' }, [[-1500, 0], [1500, 0]]),
    way(2, { aeroway: 'taxiway', ref: 'A' }, [[-1300, -170], [-300, -170], [900, -170], [1300, -170]]),
    way(3, { aeroway: 'taxiway', ref: 'B' }, [[-1100, 0], [-1100, -170]]),
    way(4, { aeroway: 'taxiway', ref: 'N' }, [[-300, -170], [-300, -450]]),
    way(5, { aeroway: 'taxiway', ref: 'N5' }, [[-300, -450], [300, -450]]),
    way(6, { aeroway: 'taxiway', ref: 'D' }, [[900, 0], [900, -170]]),
    way(7, { aeroway: 'apron' }, [[-200, -440], [900, -440], [900, -720], [-200, -720], [-200, -440]]),
    way(8, { aeroway: 'terminal' }, [[0, -780], [600, -780], [600, -840], [0, -840], [0, -780]]),
  ];
  el.push(way(9, { aeroway: 'apron', apron: 'deicing', name: 'De-icing pad 1' }, [[1000, 40], [1300, 40], [1300, 160], [1000, 160], [1000, 40]]));
  for (let i = 0; i < 10; i++) el.push({ type: 'node', id: 100 + i, tags: { aeroway: 'parking_position', ref: 'A' + (i + 1) }, lat: P(0, 0).lat - 600 * ky, lon: P(i * 60 - 100, 0).lon });
  for (let i = 0; i < 6; i++) el.push({ type: 'node', id: 200 + i, tags: { aeroway: 'gate', ref: 'B' + (i + 1) }, lat: P(0, 0).lat - 520 * ky, lon: P(i * 90 + 250, 0).lon });
  return { elements: el };
}

module.exports = { demoGround, LEVELS, grid, profile, ground, normalize, demoGrid, demoProfile };
