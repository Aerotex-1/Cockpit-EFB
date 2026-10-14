// Zusätzliche Kartenebenen: Bodenkarte (OpenStreetMap), VATSIM-Verkehr, Wetter-Radar (RainViewer), Chart
'use strict';

const MapLayers = (() => {
  let m = null;
  const on = store.get('layers', { ground: true, vatsim: false, radar: false, chart: false });
  const L_ = {};
  let groundCache = new Map();
  const twy = {}, stands = {}; // Rollwege nach Bezeichnung, Stands nach Bezeichnung (für Rollweg-Anzeige)
  let groundBusy = false;
  let vatsimTimer = null, radarTimer = null, cv = null;
  const seen = new Set();
  const lbAll = [], lbS = { addLayer(mk) { lbAll.push(mk); } }; // Beschriftungen: nur die im Bildausschnitt liegen im DOM (sonst tausende Elemente → Ruckeln)
  let drawGen = 0;

  function init(map) {
    m = map;
    // Bodenkarte unter Route und Flugzeug zeichnen
    m.createPane('groundPane').style.zIndex = 350;
    m.createPane('hlPane').style.zIndex = 355;
    m.createPane('labelPane').style.zIndex = 360;
    L_.ground = L.layerGroup().addTo(m);
    cv = L.canvas({ pane: 'groundPane', padding: 0.4 }); // Linien und Flächen auf einer Zeichenfläche statt tausender SVG-Elemente
    L_.labels = L.layerGroup(); // Beschriftungen nur bei großem Zoom
    L_.vatsim = L.layerGroup().addTo(m);
    let mvT = null;
    m.on('zoomend', syncZoomClass);
    let lbT = null; m.on('moveend', () => { clearTimeout(lbT); lbT = setTimeout(syncLabels, 80); });
    m.on('moveend', () => { clearTimeout(mvT); mvT = setTimeout(() => { if (on.ground) loadGround(); if (on.vatsim) loadVatsim(); }, 450); });
    syncButtons(); syncZoomClass();
    Object.keys(on).forEach((k) => { if (on[k]) enable(k); });
  }
  function syncButtons() { $$('[data-layer]').forEach((b) => b.classList.toggle('on', !!on[b.dataset.layer])); }
  function syncZoomClass() {
    const z = m.getZoom();
    const c = m.getContainer().classList;
    c.toggle('z15', z >= 15); c.toggle('z16', z >= 16); c.toggle('z9', z >= 9);
    syncLabels();
  }
  function syncLabels() {
    if (!m || !L_.labels) return;
    if (!(m.getZoom() >= 15 && on.ground)) { L_.labels.clearLayers(); return; }
    if (!m.hasLayer(L_.labels)) L_.labels.addTo(m);
    const b = m.getBounds().pad(0.35);
    for (const mk of lbAll) { const inb = b.contains(mk.getLatLng()), has = L_.labels.hasLayer(mk); if (inb && !has) L_.labels.addLayer(mk); else if (!inb && has) L_.labels.removeLayer(mk); }
  }

  function enable(k) {
    if (k === 'ground') loadGround();
    if (k === 'vatsim') { loadVatsim(); clearInterval(vatsimTimer); vatsimTimer = setInterval(loadVatsim, 30000); }
    if (k === 'radar') { loadRadar(); clearInterval(radarTimer); radarTimer = setInterval(loadRadar, 10 * 60000); }
    if (k === 'chart') loadChartOverlay();
  }
  function disable(k) {
    if (k === 'ground') resetGround();
    if (k === 'vatsim') { L_.vatsim.clearLayers(); clearInterval(vatsimTimer); $('#mapInfo').hidden = true; }
    if (k === 'radar') { if (L_.radar) m.removeLayer(L_.radar); L_.radar = null; clearInterval(radarTimer); }
    if (k === 'chart') { if (L_.chart) m.removeLayer(L_.chart); L_.chart = null; }
  }
  function toggle(k) {
    on[k] = !on[k]; store.set('layers', on); syncButtons();
    if (!m) return;
    if (on[k]) enable(k); else disable(k);
  }
  function info(html) { const el = $('#mapInfo'); el.hidden = !html; el.innerHTML = html || ''; }

  // ---------- Bodenkarte aus OpenStreetMap (Overpass) ----------
  function resetGround() { drawGen++; lbAll.length = 0; L_.ground.clearLayers(); L_.labels.clearLayers(); groundCache = new Map(); seen.clear(); for (const x of [twy, stands]) for (const q in x) delete x[q]; document.dispatchEvent(new Event('ground:clear')); }
  let groundFails = 0;
  async function loadGround() {
    if (!m || m.getZoom() < 13 || groundBusy) return;
    const c = m.getCenter();
    const key = `${(Math.round(c.lat * 20) / 20).toFixed(2)},${(Math.round(c.lng * 20) / 20).toFixed(2)}`;
    if (groundCache.has(key)) return;
    if (groundCache.size >= 8) resetGround(); // Speicher und Zeichenaufwand begrenzen
    groundCache.set(key, true);
    const s = Math.round(c.lat * 20) / 20 - 0.06, w = Math.round(c.lng * 20) / 20 - 0.09, n = s + 0.12, e = w + 0.18;
    const q = `[out:json][timeout:25];(way["aeroway"~"^(runway|taxiway|taxilane|apron)$"](${s},${w},${n},${e});node["aeroway"~"^(parking_position|gate|holding_position)$"](${s},${w},${n},${e});way["aeroway"~"^(parking_position|terminal)$"](${s},${w},${n},${e}););out geom;`;
    groundBusy = true;
    try {
      // zuerst über die PC-Brücke (mit Zwischenspeicher), sonst direkt von OpenStreetMap
      let d = null;
      try { const r0 = await fetch(`/api/ground?bbox=${[s, w, n, e].map((x) => x.toFixed(3)).join(',')}`); if (r0.ok) d = await r0.json(); } catch { /* weiter */ }
      if (!d) { const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }); d = await r.json(); }
      await drawGround(d.elements || []);
      groundFails = 0;
    } catch {
      groundCache.delete(key);
      // Meist nur kurz ausgelastet: still nach einigen Sekunden erneut versuchen, erst danach melden
      if (++groundFails < 4) setTimeout(() => { if (on.ground) loadGround(); }, 6000 * groundFails);
      else if (groundFails === 4) { info('Bodenkarte konnte nicht geladen werden (OpenStreetMap nicht erreichbar).'); setTimeout(() => info(''), 5000); }
    } finally { groundBusy = false; }
  }
  // Rollwege, die nach Farben benannt sind (Blue, Orange …), erscheinen in dieser Farbe
  const COLORS = [[/\b(blue|blau|bleu)\b/i, '#3a8dff', '#fff'], [/\b(orange)\b/i, '#ff8a1f', '#000'], [/\b(green|grün|gruen|vert)\b/i, '#3fe27a', '#000'], [/\b(red|rot|rouge)\b/i, '#ff4d4d', '#fff'], [/\b(yellow|gelb|jaune)\b/i, '#ffe14a', '#000'], [/\b(pink|rosa)\b/i, '#ff7ac8', '#000'], [/\b(purple|violet|lila)\b/i, '#b36bff', '#fff'], [/\b(brown|braun)\b/i, '#a0713d', '#fff'], [/\b(white|weiss|weiß|blanc)\b/i, '#f2f2f2', '#000'], [/\b(grey|gray|grau)\b/i, '#9aa3ad', '#000'], [/\b(black|schwarz)\b/i, '#6b7480', '#fff'], [/\b(gold)\b/i, '#e8b923', '#000']];
  const colorOf = (txt) => { const h = COLORS.find(([re]) => re.test(txt)); return h ? { c: h[1], fg: h[2] } : null; };
  async function drawGround(els) {
    const gen = ++drawGen, g = L_.ground, lb = lbS, R = { pane: 'groundPane', renderer: cv, interactive: false };
    const order = { apron: 0, terminal: 1, taxilane: 2, taxiway: 3, runway: 4, parking_position: 5, gate: 6, holding_position: 7 };
    els = els.filter((el) => { const k = el.type + el.id; if (seen.has(k)) return false; seen.add(k); return true; }); // jedes OSM-Objekt nur einmal zeichnen
    els.sort((a, b) => (order[a.tags && a.tags.aeroway] || 0) - (order[b.tags && b.tags.aeroway] || 0));
    const tag = (cls, text, at) => L.marker(at, { pane: 'labelPane', icon: L.divIcon({ className: cls, html: esc(text) }), interactive: false, keyboard: false });
    let tStart = performance.now();
    for (const el of els) {
      if (performance.now() - tStart > 10) { await new Promise((r) => setTimeout(r, 0)); if (gen !== drawGen) return; tStart = performance.now(); } // in Häppchen zeichnen, damit die Karte bedienbar bleibt
      const t = el.tags || {}, type = t.aeroway, ref = t.ref || t.name || '';
      if (el.type === 'way' && el.geometry) {
        const pts = el.geometry.map((p) => [p.lat, p.lon]);
        if (type === 'apron') L.polygon(pts, { ...R, color: '#2a3540', weight: 1, fillColor: '#1b242d', fillOpacity: 0.9 }).addTo(g);
        else if (type === 'terminal') L.polygon(pts, { ...R, color: '#3b4752', weight: 1, fillColor: '#2b3540', fillOpacity: 1 }).addTo(g);
        else if (type === 'runway') {
          L.polyline(pts, { ...R, color: '#5b6773', weight: 12, opacity: 1 }).addTo(g);
          L.polyline(pts, { ...R, color: '#e8ecef', weight: 1, dashArray: '8 10' }).addTo(g);
          if (ref) {
            const [a, b] = [pts[0], pts[pts.length - 1]], parts = ref.split('/');
            tag('rwy-label', parts[0], a).addTo(g);
            if (parts[1]) tag('rwy-label', parts[1], b).addTo(g);
          }
        } else if (type === 'taxiway' || type === 'taxilane') {
          const cw = colorOf(`${t.ref || ''} ${t.name || ''}`);
          const line = L.polyline(pts, { ...R, color: cw ? cw.c : type === 'taxiway' ? '#c9a227' : '#7d6a2a', weight: type === 'taxiway' ? (cw ? 3 : 2.5) : 1.5 }).addTo(g);
          (twy[ref] = twy[ref] || []).push(line);
          if (ref && type === 'taxiway') {
            if (cw) L.marker(pts[Math.floor(pts.length / 2)], { pane: 'labelPane', icon: L.divIcon({ className: 'twy-tag2', html: `<span style="background:${cw.c};color:${cw.fg}">${esc(ref)}</span>` }), interactive: false, keyboard: false }).addTo(lbS);
            else tag('twy-tag', ref, pts[Math.floor(pts.length / 2)]).addTo(lbS);
          }
        } else if (type === 'parking_position' && ref) {
          L.polyline(pts, { ...R, color: '#34c6f4', weight: 1, opacity: 0.6 }).addTo(g);
          stands[ref] = pts[0];
          tag('gate-label', ref, pts[0]).addTo(lbS);
        }
      } else if (el.type === 'node') {
        if ((type === 'parking_position' || type === 'gate') && ref) {
          stands[ref] = [el.lat, el.lon];
          tag('gate-label', ref, [el.lat, el.lon]).addTo(lbS);
        } else if (type === 'holding_position') {
          L.circleMarker([el.lat, el.lon], { ...R, radius: 2.5, color: '#ff4d4d', weight: 1, fillOpacity: 1 }).addTo(g);
        }
      }
    }
    syncZoomClass();
    document.dispatchEvent(new Event('ground:drawn'));
  }

  // ---------- VATSIM ----------
  const vIcon = (hdg) => L.divIcon({ className: 'vatsim-icon', iconSize: [22, 22], iconAnchor: [11, 11],
    html: `<svg width="22" height="22" viewBox="0 0 36 36" style="transform:rotate(${hdg}deg)"><path d="M18 2l2.4 11 12 6.5v3l-12-3.2-.9 8 3.8 2.8v2.4L18 31l-5.3 1.5v-2.4l3.8-2.8-.9-8-12 3.2v-3l12-6.5z" fill="#34c6f4" stroke="#000" stroke-width="1"/></svg>` });
  async function loadVatsim() {
    if (!m) return;
    const b = m.getBounds();
    const apts = app.ofp ? [app.ofp.origin, app.ofp.destination, app.ofp.alternate].filter(Boolean).map((a) => a.icao_code) : [];
    const pad = 0.5;
    try {
      const r = await fetch(`/api/vatsim?bbox=${[b.getSouth() - pad, b.getWest() - pad, b.getNorth() + pad, b.getEast() + pad].map((x) => x.toFixed(3)).join(',')}&airports=${apts.join(',')}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const me = app.ofp && app.ofp.atc && app.ofp.atc.callsign;
      L_.vatsim.clearLayers();
      d.pilots.filter((p) => p.cs !== me).forEach((p) => {
        L.marker([p.lat, p.lon], { icon: vIcon(p.hdg) })
          .bindTooltip(`${esc(p.cs)}`, { permanent: true, direction: 'right', className: 'vatsim-label', offset: [8, 0] })
          .bindPopup(`<b>${esc(p.cs)}</b> ${esc(p.type || '')}<br>${esc(p.dep || '?')} → ${esc(p.arr || '?')}<br>FL${Math.round(p.alt / 100)} · ${p.gs} kt`)
          .addTo(L_.vatsim);
      });
      const rows = [...d.controllers.map((c) => `<div><b>${esc(c.cs)}</b><span>${esc(c.freq)}</span></div>`),
        ...d.atis.map((a) => `<div><b>${esc(a.cs)}${a.code ? ' ' + esc(a.code) : ''}</b><span>${esc(a.freq)}</span></div>`)];
      info(`<h4>VATSIM · ${d.pilots.length} Piloten im Bild</h4>${apts.length ? (rows.join('') || `<p>Keine Lotsen für ${apts.map(esc).join(', ')} online.</p>`) : '<p>Lade einen OFP, um Lotsen für deine Flughäfen zu sehen.</p>'}`);
    } catch (e) {
      info(`VATSIM-Daten nicht verfügbar: ${esc(e.message)}`);
    }
  }

  // ---------- Wetter-Radar (RainViewer, echtes Wetter) ----------
  async function loadRadar() {
    try {
      const d = await fetch('https://api.rainviewer.com/public/weather-maps.json').then((r) => r.json());
      const frames = (d.radar && d.radar.past) || [];
      const f = frames[frames.length - 1];
      if (!f) throw new Error('keine Daten');
      if (L_.radar) m.removeLayer(L_.radar);
      L_.radar = L.tileLayer(`${d.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.6, maxNativeZoom: 7, maxZoom: 18, attribution: 'Radar © RainViewer' }).addTo(m);
      const t = new Date(f.time * 1000);
      info(`Wetter-Radar (echtes Wetter) von ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')} UTC. Im Sim weicht das Wetter ab, wenn du kein Live-Wetter nutzt.`);
      setTimeout(() => { if (!on.vatsim) info(''); }, 6000);
    } catch {
      info('Wetter-Radar konnte nicht geladen werden.');
    }
  }

  // ---------- Geöffneter Lido-Chart als Ebene ----------
  function loadChartOverlay() {
    if (L_.chart) { m.removeLayer(L_.chart); L_.chart = null; }
    const g = typeof Charts !== 'undefined' && Charts.currentGeo();
    if (!g) { info('Öffne zuerst unter CHARTS einen Lido-Chart mit ◉ (georeferenziert).'); setTimeout(() => info(''), 5000); return; }
    const a = g.page.areas[0], w = a.worldRectangle, c = a.chartRectangle;
    // Seitenecken linear aus dem georeferenzierten Bereich hochrechnen
    const lonAt = (x) => w.upperLeft[0] + ((x - c.upperLeft[0]) / (c.lowerRight[0] - c.upperLeft[0])) * (w.lowerRight[0] - w.upperLeft[0]);
    const latAt = (y) => w.upperLeft[1] + ((y - c.upperLeft[1]) / (c.lowerRight[1] - c.upperLeft[1])) * (w.lowerRight[1] - w.upperLeft[1]);
    const bounds = [[latAt(g.page.height), lonAt(0)], [latAt(0), lonAt(g.page.width)]];
    L_.chart = L.imageOverlay(g.url, bounds, { opacity: 0.75, interactive: false }).addTo(m);
    m.fitBounds(bounds);
    info(`Chart auf der Karte: ${esc(g.name)} (Lage ungefähr).`);
    setTimeout(() => info(''), 5000);
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-layer]');
    if (t) toggle(t.dataset.layer);
  });
  hooks.tab.push((n) => { if (n === 'map:init') init(map); if (n === 'map' && m && on.chart) loadChartOverlay(); });
  return { toggle, twy, stands, map: () => m, isOn: (k) => !!on[k], ensure: (k) => { if (!on[k]) toggle(k); else if (k === 'ground') loadGround(); },
    reload: () => { if (on.ground) { groundCache = new Map(); loadGround(); } } };
})();
