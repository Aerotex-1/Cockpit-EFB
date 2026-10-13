// Live-Wetter: METAR von aviationweather.gov (NOAA, frei), ATIS vom VATSIM-Datenfeed.
'use strict';
const vatsim = require('./vatsim');

const cache = new Map();   // key -> { t, v }
const TTL = 60000;

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
function norm(m) {
  if (!m || !m.rawOb) return null;
  return {
    icao: m.icaoId, raw: m.rawOb, time: m.obsTime ? m.obsTime * 1000 : null, name: m.name || '',
    lat: num(m.lat), lon: num(m.lon), temp: num(m.temp), dew: num(m.dewp),
    wdir: m.wdir === 'VRB' ? 'VRB' : num(m.wdir), wspd: num(m.wspd), wgst: num(m.wgst),
    vis: m.visib == null ? null : String(m.visib), qnh: num(m.altim),
    clouds: (Array.isArray(m.clouds) ? m.clouds : []).map((c) => ({ cover: c.cover, base: num(c.base) })),
    cat: m.fltCat || '',
  };
}
async function get(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'CockpitEFB' }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const txt = await r.text();
    const v = txt.trim() ? JSON.parse(txt) : [];
    cache.set(url, { t: Date.now(), v });
    return v;
  } catch (e) {
    if (hit) return hit.v;   // lieber alte Daten als keine
    throw e;
  }
}
const dist = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 6371 / 1.852 * 2 * Math.asin(Math.sqrt(x)); };

async function query({ icaos, lat, lon }) {
  const list = [...new Set((icaos || []).map((x) => String(x).toUpperCase()).filter((x) => /^[A-Z0-9]{4}$/.test(x)))].slice(0, 6);
  const out = { updated: Date.now(), stations: {}, here: null, error: null };
  let at = [];
  try { at = (await vatsim.load()).atis; } catch { /* VATSIM nicht erreichbar */ }
  if (list.length) {
    try {
      const arr = await get(`https://aviationweather.gov/api/data/metar?ids=${list.join(',')}&format=json`);
      list.forEach((i) => { out.stations[i] = { metar: norm(arr.find((m) => m.icaoId === i)) }; });
    } catch (e) { out.error = e.message; list.forEach((i) => { out.stations[i] = { metar: null }; }); }
  }
  list.forEach((i) => {
    const a = at.filter((x) => x.cs.startsWith(i + '_') || x.cs.startsWith(i.slice(1) + '_'));
    out.stations[i].atis = a.map((x) => ({ cs: x.cs, freq: x.freq, code: x.code, text: x.text }));
  });
  if (isFinite(lat) && isFinite(lon)) {
    try {
      const arr = await get(`https://aviationweather.gov/api/data/metar?bbox=${(lat - 1.5).toFixed(1)},${(lon - 2.5).toFixed(1)},${(lat + 1.5).toFixed(1)},${(lon + 2.5).toFixed(1)}&format=json`);
      const best = arr.filter((m) => num(m.lat) != null && num(m.lon) != null && m.rawOb)
        .map((m) => ({ m, d: dist(lat, lon, m.lat, m.lon) })).sort((a, b) => a.d - b.d)[0];
      if (best) out.here = { ...norm(best.m), distNm: Math.round(best.d) };
    } catch (e) { out.error = out.error || e.message; }
  }
  return out;
}

function demo({ icaos, lat, lon }) {
  const list = [...new Set((icaos || []).map((x) => String(x).toUpperCase()).filter(Boolean))].slice(0, 6);
  const now = new Date(), hh = String(now.getUTCHours()).padStart(2, '0') + String(now.getUTCMinutes()).padStart(2, '0');
  const mk = (i, k) => {
    const w = 180 + k * 40, s = 8 + k * 3, q = 1010 + k * 3;
    return { icao: i, name: i + ' Demo', raw: `${i} ${String(now.getUTCDate()).padStart(2, '0')}${hh}Z ${w}${String(s).padStart(2, '0')}KT 9999 FEW040 BKN090 ${12 + k}/0${5 + k} Q${q} NOSIG`, time: Date.now(), lat: 51, lon: 12, temp: 12 + k, dew: 5 + k, wdir: w, wspd: s, wgst: k === 1 ? 22 : null, vis: '10+', qnh: q, clouds: [{ cover: 'FEW', base: 4000 }, { cover: 'BKN', base: 9000 }], cat: 'VFR' };
  };
  const out = { updated: Date.now(), demo: true, stations: {}, here: null, error: null };
  list.forEach((i, k) => { out.stations[i] = { metar: mk(i, k), atis: k === 0 ? [{ cs: i + '_ATIS', freq: '118.025', code: 'C', text: `${i} INFORMATION CHARLIE. RUNWAY IN USE 26L. WIND 180 DEGREES 8 KNOTS. QNH ${1010}.` }] : [] }; });
  if (isFinite(lat) && isFinite(lon)) out.here = { ...mk('EDDP', 2), distNm: 14 };
  return out;
}
module.exports = { query, demo };
