// Karten-Zusätze: Höhenwind/Wolken und Rollweg-Anzeige (reine Anzeige, nichts geht an den Sim)
'use strict';

const MapExtras = (() => {
  let m = null, windOn = store.get('windOn', false), level = store.get('windLevel', 'sfc'), grid = null, timer = null, busy = 0;
  let windLayer = null, hlLayer = null, taxiOpen = false;
  const q = (id) => document.getElementById(id);
  const side = () => { let s = q('mapSide'); if (!s) { s = document.createElement('div'); s.id = 'mapSide'; s.className = 'map-side'; q('tab-map').appendChild(s); } return s; };
  const pad2 = (n) => String(Math.round(n)).padStart(3, '0');
  const col = (kt) => (kt >= 60 ? '#ff5a5a' : kt >= 40 ? '#ffa31a' : kt >= 25 ? '#ffd84a' : kt >= 12 ? '#3fe27a' : '#8fb4c9');

  // ===================== Wind & Wolken =====================
  const arrow = (p, lv) => {
    const d = p.levels[lv]; if (!d || d.kt == null || d.dir == null) return null;
    const rot = (d.dir + 180) % 360; // Pfeil zeigt dorthin, wohin der Wind weht
    const c = d.cloud == null ? '' : `<i class="wx-cl" style="--c:${d.cloud}">${Math.round(d.cloud)}%</i>`;
    return L.divIcon({ className: 'wx-arrow', iconSize: [64, 56], iconAnchor: [32, 28],
      html: `<svg width="30" height="30" viewBox="0 0 30 30" style="transform:rotate(${rot}deg)"><path d="M15 2l7 12h-5v14h-4V14H8z" fill="${col(d.kt)}" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg><b>${pad2(d.dir)}/${Math.round(d.kt)}</b>${c}` });
  };
  function popup(p) {
    const rows = grid.levels.map((l) => { const d = p.levels[l.id] || {}; return `<tr><td>${l.label}</td><td>${d.dir == null ? '–' : pad2(d.dir) + '° / ' + Math.round(d.kt) + ' kt'}</td><td>${d.cloud == null ? '–' : Math.round(d.cloud) + ' %'}</td><td>${d.temp == null ? '–' : Math.round(d.temp) + ' °C'}</td></tr>`; }).join('');
    const sf = p.levels.sfc || {}; const lmh = sf.low != null ? `<p class="wx-lmh">Bodennah ${Math.round(sf.low)} % · mittel ${Math.round(sf.mid)} % · hoch ${Math.round(sf.high)} %</p>` : '';
    return `<table class="wx-tab"><tr><th>Höhe</th><th>Wind</th><th>Wolken</th><th>Temp.</th></tr>${rows}</table>${lmh}`;
  }
  function draw() {
    if (!m || !windOn) return;
    if (windLayer) windLayer.clearLayers(); else windLayer = L.layerGroup().addTo(m);
    if (!grid) return;
    for (const p of grid.points) {
      const ic = arrow(p, level); if (!ic) continue;
      L.marker([p.lat, p.lon], { icon: ic }).bindPopup(popup(p), { maxWidth: 340 }).addTo(windLayer);
    }
  }
  async function load() {
    if (!m || !windOn) return;
    const b = m.getBounds(), id = ++busy;
    const bb = [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
    if (b.getNorth() - b.getSouth() > 40) { note('Zoome näher heran, um den Wind zu sehen.'); return; }
    try {
      const r = await fetch(`/api/wx/grid?bbox=${bb.map((x) => x.toFixed(3)).join(',')}`);
      const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Fehler');
      if (id !== busy) return;
      grid = d; draw(); note('');
      const t = d.time ? ` · Modell ${String(d.time).slice(11, 16)} UTC` : '';
      q('wxTime').textContent = `Wetterdaten: Open-Meteo.com (CC BY 4.0)${t}`;
    } catch (e) { note(`Wind konnte nicht geladen werden: ${e.message}`); }
  }
  function note(t) { const n = q('wxNote'); if (n) { n.textContent = t; n.hidden = !t; } }
  function metarClouds(raw) {
    if (!raw) return '';
    const l = (String(raw).match(/\b(FEW|SCT|BKN|OVC|VV)\d{3}(?:CB|TCU)?\b/g) || []).map((c) => `${c.slice(0, 3)} ${parseInt(c.slice(3, 6), 10) * 100} ft`);
    return /\b(CAVOK|NSC|SKC|NCD)\b/.test(raw) ? 'keine bedeutenden Wolken' : (l.join(', ') || '–');
  }
  function panel() {
    const w = (app.ofp && app.ofp.weather) || {}, o = app.ofp || {};
    const rows = [['origin', 'orig_metar'], ['destination', 'dest_metar'], ['alternate', 'altn_metar']].map(([k, mk]) => (o[k] && w[mk] ? `<div><b>${esc(o[k].icao_code)}</b><span>${esc(metarClouds(w[mk]))}</span></div>` : '')).join('');
    return `<h4>Wind &amp; Wolken</h4>
      <div class="chips wx-lv">${(grid ? grid.levels : [{ id: 'sfc', label: 'Boden' }, { id: '850', label: 'FL050' }, { id: '700', label: 'FL100' }, { id: '500', label: 'FL180' }, { id: '300', label: 'FL300' }, { id: '250', label: 'FL340' }]).map((l) => `<button class="chip${l.id === level ? ' on' : ''}" data-wlv="${l.id}">${esc(l.label)}</button>`).join('')}</div>
      <p class="wx-help">Pfeil = wohin der Wind weht, Zahl = Richtung/Stärke in kt. Prozent = Wolkenbedeckung auf dieser Höhe. Pfeil antippen zeigt alle Höhen.</p>
      ${rows ? `<h5>Wolkenuntergrenzen (METAR, über Grund)</h5>${rows}` : ''}
      <p id="wxTime" class="wx-help"></p><p id="wxNote" class="wx-bad" hidden></p>`;
  }
  function showPanel() {
    let p = q('windPanel');
    if (!windOn) { if (p) p.hidden = true; return; }
    if (!p) { p = document.createElement('div'); p.id = 'windPanel'; p.className = 'map-wind'; side().appendChild(p); }
    p.hidden = false; const keep = (q('wxTime') || {}).textContent; p.innerHTML = panel(); if (keep) q('wxTime').textContent = keep;
  }
  function setWind(on) {
    windOn = on; store.set('windOn', on);
    const b = q('btnWind'); if (b) b.classList.toggle('on', on);
    if (!on) { if (windLayer) { m.removeLayer(windLayer); windLayer = null; } clearTimeout(timer); showPanel(); return; }
    showPanel(); load();
  }

  // ===================== Rollweg =====================
  const RWY = /^\d{2}[LRC]?$/;
  const store_ = () => store.get('taxi', {});
  const keyOf = (icao, mode) => `${icao}:${mode}`;
  let cur = { icao: '', mode: 'dep' };
  const airports = () => {
    const o = app.ofp || {}, out = [];
    [['origin', 'Abflug'], ['destination', 'Ziel'], ['alternate', 'Ausweich']].forEach(([k, r]) => { if (o[k] && o[k].icao_code) out.push({ icao: o[k].icao_code, role: r, lat: +o[k].pos_lat, lon: +o[k].pos_long }); });
    return out;
  };
  const apt = (icao) => airports().find((a) => a.icao === icao) || (app.airports || []).find((a) => a.icao === icao);
  const tokens = (s) => String(s || '').toUpperCase().replace(/\(([^)]*)\)/g, (m, x) => ' (' + x.trim().replace(/\s+/g, '') + ') ').split(/[\s,;>→]+|\s-\s|-(?=\s|$)/).map((t) => t.trim()).filter(Boolean);
  function entry() { return store_()[keyOf(cur.icao, cur.mode)] || { stand: '', rwy: '', route: '' }; }

  function bar() {
    let b = q('taxiBar');
    const all = store_(), shown = Object.entries(all).filter(([, v]) => v && (v.route || v.stand));
    if (!shown.length) { if (b) b.hidden = true; return; }
    if (!b) { b = document.createElement('div'); b.id = 'taxiBar'; b.className = 'taxi-bar'; q('tab-map').appendChild(b); }
    b.hidden = false;
    const e = all[keyOf(cur.icao, cur.mode)] || shown[0][1], [ic, md] = (all[keyOf(cur.icao, cur.mode)] ? keyOf(cur.icao, cur.mode) : shown[0][0]).split(':');
    let t = tokens(e.route).map((c) => ({ c }));
    try { const a = apt(ic), pv = window.TaxiNav && a && TaxiNav.data[ic] && TaxiNav.preview(TaxiNav.planFrom(ic, md, e, a.lat, a.lon)); if (pv && pv.bar) t = pv.bar.map((x) => ({ c: x.hold ? '(' + x.ref + ')' : x.ref, gap: x.gap, hold: x.hold })); else if (window.TaxiNav && a && !TaxiNav.data[ic]) TaxiNav.ensure(ic, a.lat, a.lon).then((d) => { if (d) bar(); }); } catch (e2) { /* Eingabe zeigen */ }
    const chips = md === 'arr' ? [{ c: e.rwy }, ...t, { c: e.stand }] : [{ c: e.stand }, ...t, { c: e.rwy }];
    b.innerHTML = `<span class="tb-h">${esc(ic)} ${md === 'arr' ? 'Ankunft' : 'Abflug'}</span>` + chips.filter((x) => x.c).map((x, i, a) => `<span class="tb-c${RWY.test(x.c) ? ' rw' : (x.c === e.stand ? ' st' : '')}${x.gap ? ' gap' : ''}${x.hold ? ' hold' : ''}"${x.gap ? ' title="automatisch eingefügte Verbindung"' : ''}>${esc(x.c)}</span>${i < a.length - 1 ? '<i>›</i>' : ''}`).join('') + '<button class="tb-x" id="tbClear" title="Rollweg löschen" aria-label="Rollweg löschen">×</button>';
  }
  // Mit Position vom Sim zeigt die Karte nur den Abschnitt, auf dem du gerade bist, und den nächsten (nicht die ganze Route).
  function liveState() {
    const s = app.sim || {}; if (!s.connected || !s.onGround || !window.TaxiNav) return null;
    const plan = TaxiNav.activePlan(); if (!plan || !isFinite(plan.lat) || !isFinite(plan.lon)) return null;
    if (!TaxiNav.data[plan.icao]) { TaxiNav.ensure(plan.icao, plan.lat, plan.lon).then((d) => { if (d) highlight(); }); return null; }
    const st = TaxiNav.compute(plan, { lat: s.lat, lon: s.lon, hdg: s.hdg, gs: s.gs });
    return st && !st.missing ? { st, plan } : null;
  }
  // Roter Strich quer zum Rollweg: Halt vor einem Rollweg (Klammer in der Eingabe)
  function drawHolds(hs, P) {
    for (const h of hs || []) {
      if (!h.line || h.line.length < 2) continue;
      L.polyline(h.line, { ...P, color: '#ff3b3b', weight: 5, opacity: 1, lineCap: 'butt' }).addTo(hlLayer);
      L.marker(h.line[1], { ...P, icon: L.divIcon({ className: 'tx-hold', html: 'Halt ' + esc(h.ref), iconSize: null }) }).addTo(hlLayer);
    }
  }
  const previewOf = (e) => {
    if (!window.TaxiNav || !cur.icao) return null; const a = apt(cur.icao); if (!a || !isFinite(a.lat) || !isFinite(a.lon)) return null;
    if (!TaxiNav.data[cur.icao]) { TaxiNav.ensure(cur.icao, a.lat, a.lon).then((d) => { if (d) highlight(); }); return null; }
    return TaxiNav.preview(TaxiNav.planFrom(cur.icao, cur.mode, e, a.lat, a.lon));
  };
  let hlSig = '';
  function highlight() {
    if (!m) return;
    const e = entry(), ML = MapLayers; if (!ML) return;
    const live = taxiOpen ? null : liveState();
    const sig = live ? `${live.plan.key}|${live.st.cur}|${live.st.turn}|${Math.round((live.st.distToJ || 0) / 3)}|${(live.st.legCur || []).length}|${(live.st.legNext || []).length}` : '';
    if (live && sig === hlSig && hlLayer) return; // nichts hat sich geändert: nicht neu zeichnen
    hlSig = sig;
    if (hlLayer) hlLayer.clearLayers(); else hlLayer = L.layerGroup().addTo(m);
    if (live) {
      const { st } = live, P = { pane: 'hlPane', interactive: false };
      drawHolds(st.holdLines, P);
      if (st.legNext && st.legNext.length > 1) L.polyline(st.legNext, { ...P, color: '#34c6f4', weight: 5, opacity: 0.55, dashArray: '2 9', lineCap: 'round' }).addTo(hlLayer);
      if (st.legCur && st.legCur.length > 1) L.polyline(st.legCur, { ...P, color: '#34c6f4', weight: 7, opacity: 0.9 }).addTo(hlLayer);
      const lbl = st.cur < 0 ? `weiter zu ${st.toFirst}` : st.next ? `${st.turn === 'left' ? '↰ links' : st.turn === 'right' ? '↱ rechts' : '↑ geradeaus'} ${st.next}` : (st.hold ? 'Halt vor der Piste' : '');
      const at = st.J || (st.legCur && st.legCur[st.legCur.length - 1]);
      if (lbl && at) L.marker(at, { ...P, icon: L.divIcon({ className: 'tx-turn', html: esc(lbl), iconSize: null }) }).addTo(hlLayer);
      return;
    }
    if (!taxiOpen) return; // Vorschau der ganzen Route nur, solange das Rollweg-Fenster offen ist
    const pv = previewOf(e);
    if (pv && pv.legs) {
      const P = { pane: 'hlPane', interactive: false };
      for (const l of pv.legs) if (l.pts.length > 1) L.polyline(l.pts, l.gap ? { ...P, color: '#7fd8f5', weight: 4, opacity: 0.8, dashArray: '3 8', lineCap: 'round' } : { ...P, color: '#34c6f4', weight: 6, opacity: 0.85, lineCap: 'round' }).addTo(hlLayer);
      drawHolds(pv.holds, P);
    } else {
      const wanted = new Set(TaxiNav.parse(e.route).route);
      for (const ref of wanted) for (const line of ML.twy[ref] || []) L.polyline(line.getLatLngs(), { color: '#34c6f4', weight: 4, opacity: 0.6, dashArray: '10 8', interactive: false, pane: 'hlPane' }).addTo(hlLayer);
    }
    const st = e.stand && ML.stands[String(e.stand).toUpperCase()];
    if (st) L.circleMarker(st, { pane: 'hlPane', radius: 9, color: '#3fe27a', weight: 3, fillColor: '#3fe27a', fillOpacity: .25, interactive: false }).addTo(hlLayer);
  }
  let liveT = 0;
  function fly(icao) {
    const a = apt(icao); if (!a || !isFinite(a.lat) || !isFinite(a.lon)) return;
    MapLayers.ensure('ground');
    if (typeof follow !== 'undefined') { follow = false; const f = q('mapFollow'); if (f) f.classList.remove('on'); }
    m.setView([a.lat, a.lon], 15);
  }
  function listStands() { return Object.keys(MapLayers.stands).sort((a, b) => a.localeCompare(b, 'de', { numeric: true })); }

  function taxiPanel() {
    const ap = airports(), e = entry();
    if (!cur.icao) cur.icao = (ap[0] && ap[0].icao) || '';
    const opts = ap.map((a) => `<option value="${esc(a.icao)}"${a.icao === cur.icao ? ' selected' : ''}>${esc(a.icao)} (${a.role})</option>`).join('');
    return `<h4>Rollweg</h4>
      <div class="seg" id="txMode"><button data-m="dep"${cur.mode === 'dep' ? ' class="on"' : ''}>Abflug</button><button data-m="arr"${cur.mode === 'arr' ? ' class="on"' : ''}>Ankunft</button></div>
      ${ap.length ? `<label>Flughafen<select id="txApt">${opts}</select></label>` : `<label>Flughafen (ICAO)<input id="txAptT" maxlength="4" value="${esc(cur.icao)}" placeholder="EDDP"></label>`}
      <div class="tx-row"><label>Stand<input id="txStand" list="txStands" value="${esc(e.stand)}" placeholder="A12" autocapitalize="characters"></label>
      <label>Piste<input id="txRwy" value="${esc(e.rwy)}" placeholder="26R" autocapitalize="characters"></label></div>
      <datalist id="txStands">${listStands().map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
      <label>Rollweg ${cur.mode === 'arr' ? '(von der Piste zum Stand)' : '(vom Stand zur Piste)'}<input id="txRoute" value="${esc(e.route)}" placeholder="z. B. B A N5 oder B (A) für Halt vor A" autocapitalize="characters"></label>
      ${cur.mode === 'arr' ? '' : `<label class="chk"><input type="checkbox" id="txLineup"${e.lineup ? ' checked' : ''}> Line up (Halt vor der Piste entfällt)</label>`}
      <div class="tx-btns"><button class="btn-s" id="txShow">Anzeigen</button><button class="btn-s" id="txFly">Zum Flughafen</button><button class="btn-s" id="txStandGo">Stand zeigen</button><button class="btn-s" id="txClear">Löschen</button><button class="btn-s" id="txClearAll">Alle löschen</button></div>
      <p class="wx-help">Die Rollwege werden nur bis zur jeweiligen Kreuzung markiert. Fehlt eine Verbindung, wird die kürzeste eingefügt (gestrichelt). Ein Rollweg in Klammern, z. B. B (A) D, bedeutet: Halt vor A mit rotem Strich. Folgt danach noch ein Rollweg, wird A trotzdem befahren; steht die Klammer am Ende, endet der Weg am Halt. Am Pistenende hält die Route automatisch vor der Piste (roter Strich); mit „Line up“ entfällt dieser Halt. Die Eingabe bleibt gespeichert, auch für den Ankunftsflughafen.</p>`;
  }
  function openTaxi(v) {
    taxiOpen = v; const b = q('btnTaxi'); if (b) b.classList.toggle('on', v);
    let p = q('taxiPanel');
    if (!v) { if (p) p.hidden = true; return; }
    if (!p) { p = document.createElement('div'); p.id = 'taxiPanel'; p.className = 'map-taxi'; side().appendChild(p); }
    p.hidden = false; p.innerHTML = taxiPanel(); MapLayers.ensure('ground');
  }
  function save() {
    if (!cur.icao && q('txAptT')) cur.icao = (q('txAptT').value || '').toUpperCase();
    const all = store_(), k = keyOf(cur.icao, cur.mode);
    all[k] = { stand: (q('txStand').value || '').trim().toUpperCase(), rwy: (q('txRwy').value || '').trim().toUpperCase(), route: (q('txRoute').value || '').trim().toUpperCase(), lineup: !!(q('txLineup') && q('txLineup').checked) };
    store.set('taxi', all); highlight(); bar();
  }

  // Rollwege löschen: mode = 'dep' | 'arr' | null (alle)
  function clearTaxi(mode, say) {
    const all = store_(); let n = 0;
    for (const k of Object.keys(all)) if (!mode || k.endsWith(':' + mode)) { delete all[k]; n++; }
    store.set('taxi', all);
    if (taxiOpen) openTaxi(true);
    highlight(); bar();
    if (n && say !== 'quiet' && window.Settings) Settings.toast('Rollweg gelöscht');
    return n;
  }
  // Automatisch: nach dem Abheben fällt der Abflug-Rollweg weg, am Gate nach der Landung der Ankunfts-Rollweg;
  // ein neuer Flugplan mit anderer Strecke leert alte Rollwege.
  let wasAir = null, parkedSince = 0;
  hooks.sim.push((s) => {
    if (m && !taxiOpen && Date.now() - liveT > 1000) { liveT = Date.now(); try { highlight(); } catch (e) { /* weiter */ } }
    if (!s.connected || s.lat == null || s.onGround === undefined) return;
    const air = s.onGround === false;
    if (air && wasAir === false) { store.set('taxiFlown', true); clearTaxi('dep'); }
    if (air) store.set('taxiFlown', true);
    wasAir = air;
    if (!air && s.gs < 1 && s.parkingBrake && store.get('taxiFlown', false)) {
      parkedSince = parkedSince || Date.now();
      if (Date.now() - parkedSince > 20000) { store.set('taxiFlown', false); clearTaxi('arr'); }
    } else if (air || s.gs >= 1) parkedSince = 0;
  });
  hooks.ofp.push((o) => {
    const key = o && o.origin && o.destination ? `${o.origin.icao_code}-${o.destination.icao_code}` : '';
    const prev = store.get('taxiFlight', '');
    if (key && prev && prev !== key) clearTaxi(null, 'quiet');
    if (key) store.set('taxiFlight', key);
  });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'tbClear') { clearTaxi(null, true); return; }
    if (t.id === 'btnWind') setWind(!windOn);
    if (t.id === 'btnTaxi') openTaxi(!taxiOpen);
    if (t.dataset.wlv) { level = t.dataset.wlv; store.set('windLevel', level); showPanel(); draw(); }
    if (!taxiOpen) return;
    if (t.closest('#txMode') && t.dataset.m) { cur.mode = t.dataset.m; openTaxi(true); highlight(); bar(); }
    if (t.id === 'txShow') { save(); }
    if (t.id === 'txFly') { const a = q('txApt') ? q('txApt').value : (q('txAptT').value || '').toUpperCase(); cur.icao = a; fly(a); }
    if (t.id === 'txStandGo') { const s = MapLayers.stands[(q('txStand').value || '').trim().toUpperCase()]; if (s) m.setView(s, 18); else { const n = q('txStand'); n.classList.add('bad'); setTimeout(() => n.classList.remove('bad'), 1200); } }
    if (t.id === 'txClearAll') clearTaxi(null, true);
    if (t.id === 'txClear') { const all = store_(); delete all[keyOf(cur.icao, cur.mode)]; store.set('taxi', all); openTaxi(true); highlight(); bar(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'txApt') { cur.icao = e.target.value; openTaxi(true); highlight(); bar(); fly(cur.icao); }
    if (e.target.id === 'txAptT') { cur.icao = e.target.value.toUpperCase(); openTaxi(true); fly(cur.icao); }
    if (['txStand', 'txRwy', 'txRoute', 'txLineup'].includes(e.target.id)) save();
  });
  document.addEventListener('ground:drawn', () => { hlSig = ''; highlight(); const dl = q('txStands'); if (dl) dl.innerHTML = listStands().map((s) => `<option value="${esc(s)}">`).join(''); });
  document.addEventListener('ground:clear', () => { hlSig = ''; if (hlLayer) hlLayer.clearLayers(); });
  hooks.ofp.push(() => { showPanel(); if (taxiOpen) openTaxi(true); bar(); });

  hooks.tab.push((n) => {
    if (n === 'map:init') {
      m = MapLayers.map();
      m.on('moveend', () => { if (windOn) { clearTimeout(timer); timer = setTimeout(load, 700); } });
      if (windOn) setWind(true);
      highlight(); bar();
    }
  });
  const sync = () => { const b = q('btnWind'); if (b) b.classList.toggle('on', windOn); };
  sync();
  return {};
})();
