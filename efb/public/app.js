// Cockpit EFB – iPad-Oberfläche
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { // Werte im Speicher zwischenhalten: localStorage-Zugriffe sind auf dem iPad langsam und werden pro Sekunde oft gebraucht
  _c: new Map(),
  get(k, d) { try { let v = this._c.get(k); if (v === undefined) { v = localStorage.getItem('efb.' + k); this._c.set(k, v); } return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { const j = JSON.stringify(v); this._c.set(k, j); localStorage.setItem('efb.' + k, j); } catch { /* egal */ } },
};
window.addEventListener('storage', () => store._c.clear());
// Gewichtseinheit (pro Gerät): intern rechnet alles in kg, angezeigt wird kg oder lb
const WU = (() => {
  const LB = 0.45359237, subs = [];
  const unit = () => (store.get('wunit', 'kg') === 'lbs' ? 'lbs' : 'kg');
  return {
    unit, label: () => (unit() === 'lbs' ? 'lb' : 'kg'),
    toKg: (v) => (v === null || v === undefined || isNaN(v) ? v : unit() === 'lbs' ? v * LB : v),      // Eingabe (Anzeigeeinheit) -> kg
    fromKg: (kg) => (kg === null || kg === undefined || isNaN(kg) ? kg : unit() === 'lbs' ? kg / LB : kg), // kg -> Anzeigeeinheit
    ofpKg: (v, o) => { const x = Number(v); return isNaN(x) ? null : ((o && o.params && o.params.units) === 'lbs' ? x * LB : x); }, // OFP-Wert -> kg
    show: (kg, step = 1) => (kg === null || kg === undefined || isNaN(kg) ? '–' : `${fmt(Math.round((unit() === 'lbs' ? kg / LB : kg) / step) * step)} ${unit() === 'lbs' ? 'lb' : 'kg'}`),
    set: (u) => { const old = unit(); store.set('wunit', u === 'lbs' ? 'lbs' : 'kg'); if (old !== unit()) subs.forEach((f) => { try { f(old, unit()); } catch (e) { /* weiter */ } }); },
    on: (f) => subs.push(f),
  };
})();
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
const fmt = (v, d = 0) => (v === null || v === undefined || isNaN(v) ? '–' : Number(v).toLocaleString(window.LANG === 'en' ? 'en-US' : 'de-DE', { maximumFractionDigits: d, minimumFractionDigits: d }));

const app = {
  config: null,
  sim: {},
  ofp: null,
  checklists: {},
  tab: store.get('tab', 'flight'),
  frames: { efb: '' },
};

// ---------- Fehleranzeige (hilft bei der Fehlersuche auf dem iPad) ----------
function showError(msg) {
  const box = $('#errBox');
  if (!box) return;
  box.hidden = false;
  box.querySelector('span').textContent = msg;
}
window.addEventListener('error', (e) => showError(`${e.message} (${String(e.filename || '').split('/').pop()}:${e.lineno || '?'})`));
window.addEventListener('unhandledrejection', (e) => showError(String((e.reason && e.reason.message) || e.reason)));

// ---------- Start ----------
// Erst die Bedienung aktivieren, dann Daten laden. So bleiben die Tasten auch
// dann bedienbar, wenn eine Anfrage hängt oder fehlschlägt.
// Ausgabe (Lite / Medium / Voll / Copilot & Ground): nicht gebrauchte Tabs ausblenden. Gewählt wird sie in der Windows-App; ohne Angabe gilt „Voll“.
window.EDITION = { id: 'full', name: 'Voll', tabs: null, voiceOnly: false, has: () => true };
function applyEdition(cur) {
  const set = new Set(cur.tabs || []);
  window.EDITION = { id: cur.id, name: cur.name, tabs: cur.tabs, voiceOnly: !!cur.voiceOnly, has: (t) => set.has(t) };
  $$('.pb[data-tab]').forEach((b) => { b.hidden = !set.has(b.dataset.tab); });
  $$('.tab').forEach((t) => { if (!set.has(t.id.replace(/^tab-/, ''))) t.setAttribute('data-off', '1'); });
  if (!set.has('copilot')) ['cpMute', 'cpMicMute', 'cpMsgs'].forEach((id) => { const e = document.getElementById(id); if (e) e.remove(); }); // Stumm-Knöpfe des Copilots
  if (!set.has(app.tab)) app.tab = cur.voiceOnly && set.has('copilot') ? 'copilot' : cur.tabs[0];
}
async function init() {
  app.config = { port: 8090, simbriefUser: '', aircraft: [] };
  bindUi();
  try { const e = await fetch('/api/edition', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)); if (e && e.current && Array.isArray(e.current.tabs) && e.current.tabs.length) applyEdition(e.current); } catch { /* ältere EFB oder Web-Version: alles anzeigen */ }
  showTab(app.tab);
  setInterval(tickClock, 1000); tickClock();
  applyDim(store.get('dim', 0));
  connectEvents();

  await loadConfig();
  app.checklists = await fetch('data/checklists.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
  fetch('/api/info').then((r) => r.json()).then((i) => { const el = $('#verInfo'); if (el) el.textContent = `Version ${i.version}` + (window.EDITION && window.EDITION.id !== 'full' ? ` · Ausgabe ${window.EDITION.name}` : ''); }).catch(() => {});
  app.airports = await fetch('data/airports.json').then((r) => r.json()).catch(() => []);
  app.defs = await fetch('data/aircraft.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ kinds: {} }));
  lastProfileId = undefined; onSim();
  if (app.tab === 'check') renderChecklists();

  const cached = await fetch('/api/simbrief?cached=1').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (cached && cached.origin) setOfp(cached);
  else if (app.config.simbriefUser) loadOfp(true);
}

async function loadConfig() {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      app.config = await r.json();
      renderAcSelect(); renderSetup(); updateFrames();
      $('#errBox').hidden = true;
      return;
    } catch (e) {
      showError(`PC-Brücke nicht erreichbar (${e.message}). Neuer Versuch …`);
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  showError('PC-Brücke nicht erreichbar. Läuft start.bat auf dem PC und ist das iPad im selben WLAN?');
}

function connectEvents() {
  const es = new EventSource('/api/events');
  es.onmessage = (e) => { app.sim = JSON.parse(e.data); onSim(); };
  ['cl', 'cp'].forEach((n) => es.addEventListener(n, (e) => { try { if (window.onEfbEvent) window.onEfbEvent(n, JSON.parse(e.data)); } catch { /* egal */ } }));
  es.onerror = () => { app.sim = { ...app.sim, connected: false, bridgeDown: true }; onSim(); };
  es.onopen = () => { app.sim.bridgeDown = false; };
}

// ---------- Tabs ----------
function showTab(name) {
  if (window.EDITION && !window.EDITION.has(name)) name = (window.EDITION.tabs || [])[0] || 'flight'; // Tab gehört nicht zur gewählten Ausgabe
  app.tab = name; store.set('tab', name);
  $$('.pb').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + name));
  if (name === 'efb') updateFrames();
  if (name === 'map') initMap();
  emit('tab', name);
  if (name === 'check') renderChecklists();
  if (name === 'gsx') { gsxUi.html = ''; renderGsx(); }
  if (name === 'setup') renderGsxFileInfo();
  if (name === 'perf' && !$('#windDir').value && app.sim.windDir !== null && app.sim.windDir !== undefined) {
    $('#windDir').value = String(Math.round(app.sim.windDir)).padStart(3, '0');
    $('#windSpd').value = Math.round(app.sim.windSpd);
    calcWind();
  }
}

// ---------- Flieger-Profil ----------
function detectedProfile() {
  const title = (app.sim.title || '').toLowerCase();
  if (!title) return null;
  // Beste Übereinstimmung gewinnt: „PMDG&737“ (alle Teile müssen vorkommen) schlägt „737“
  let best = null, bestScore = 0;
  for (const a of app.config.aircraft) {
    for (const m of a.match || []) {
      const parts = String(m || '').toLowerCase().split('&').map((x) => x.trim()).filter(Boolean);
      if (!parts.length || !parts.every((x) => title.includes(x))) continue;
      const score = parts.length * 1000 + parts.join('').length;
      if (score > bestScore) { best = a; bestScore = score; }
    }
  }
  return best;
}
function currentProfile() {
  const sel = store.get('ac', 'auto');
  if (sel !== 'auto') return app.config.aircraft.find((a) => a.id === sel) || detectedProfile();
  return detectedProfile();
}
function renderAcSelect() {
  const sel = $('#acSelect');
  const det = detectedProfile();
  const cur = store.get('ac', 'auto');
  const label = (a) => (a.dev ? `${a.name} · ${a.dev}` : a.name);
  const groups = {};
  app.config.aircraft.forEach((a) => { (groups[a.maker || 'Sonstige'] = groups[a.maker || 'Sonstige'] || []).push(a); });
  const order = Object.keys(groups).sort((x, y) => (x === 'Sonstige') - (y === 'Sonstige') || x.localeCompare(y, 'de'));
  sel.innerHTML = `<option value="auto">Automatisch${det ? ': ' + esc(label(det)) : ''}</option>` +
    order.map((mk) => `<optgroup label="${esc(mk)}">${groups[mk].slice().sort((x, y) => label(x).localeCompare(label(y), 'de', { numeric: true }))
      .map((a) => `<option value="${esc(a.id)}">${esc(label(a))}</option>`).join('')}</optgroup>`).join('');
  sel.value = app.config.aircraft.some((a) => a.id === cur) ? cur : 'auto';
}
function fillHost(url) { return (url || '').replace(/\{host\}/g, location.hostname); }

function updateFrames(force) {
  const p = currentProfile();
  const remote = !!(p && p.remote);
  $('#remoteEfb').hidden = !remote;
  $('#efbFrameWrap').hidden = remote;
  $('#efbOpen').hidden = remote;
  $$('[data-reload=efb]').forEach((b) => { b.hidden = remote; });
  for (const kind of ['efb']) {
    if (kind === 'efb' && remote) { $('#efbTitle').textContent = `${p.name} – Remote-EFB`; continue; }
    const url = p ? fillHost(p[kind + 'Url']) : '';
    const frame = $('#' + kind + 'Frame');
    const empty = $('#' + kind + 'Empty');
    $('#' + kind + 'Title').textContent = p ? `${p.name} – ${kind === 'efb' ? 'EFB' : 'MCDU'}` : '';
    $('#' + kind + 'Open').href = url || '#';
    if (!p) {
      empty.innerHTML = 'Kein Flieger erkannt. Wähle oben links einen Flieger aus oder lade einen Flieger im Sim.';
      empty.classList.add('on'); continue;
    }
    if (!url) {
      empty.innerHTML = kind === 'efb' && p.notes
        ? `<p>${esc(p.notes)}</p><p class="note">Eine eigene EFB-Adresse kannst du unter Setup eintragen.</p>`
        : `Für ${esc(p.name)} ist keine ${kind.toUpperCase()}-Adresse eingetragen. Du kannst sie unter Setup ergänzen.`;
      empty.classList.add('on'); continue;
    }
    empty.classList.remove('on');
    // Nur laden, wenn der Tab sichtbar ist oder schon einmal geladen war
    const visible = app.tab === kind;
    if ((visible || app.frames[kind]) && (force === kind || app.frames[kind] !== url)) {
      frame.src = url; app.frames[kind] = url;
    }
  }
}

// Module (remote-efb.js, perf-calc.js, charts.js, map-layers.js) melden sich hier an
const hooks = { sim: [], profile: [], tab: [], ofp: [] };
function emit(kind, ...args) { for (const f of hooks[kind]) { try { f(...args); } catch (e) { showError(e.message); } } }

// ---------- Live-Daten ----------
let lastProfileId = null;
function onSim() {
  const s = app.sim;
  const lamp = $('#simLamp');
  const lampCls = 'lamp' + (s.connected ? ' ok' : s.bridgeDown ? '' : ' warn'); if (lamp.className !== lampCls) lamp.className = lampCls;
  lamp.title = s.bridgeDown ? 'PC-Brücke nicht erreichbar' : s.connected ? (s.demo ? 'Demo-Modus' : 'Mit MSFS verbunden') : 'Warte auf MSFS';

  const stripHtml = s.connected && s.lat !== null
    ? `<span><small>GS</small>${fmt(s.gs)}</span><span><small>ALT</small>${fmt(s.alt)}</span><span><small>HDG</small>${String(Math.round(s.hdg) % 360).padStart(3, '0')}</span>`
    : `<span class="dim-t">${s.bridgeDown ? 'PC-Brücke offline' : 'Sim nicht verbunden'}</span>`;
  if (stripHtml !== onSim._strip) { onSim._strip = stripHtml; $('#stripLive').innerHTML = stripHtml; } // nur bei Änderung schreiben (spart Layout und Neuzeichnen)

  const p = currentProfile();
  if ((p && p.id) !== lastProfileId) {
    lastProfileId = p && p.id;
    renderAcSelect(); updateFrames();
    if (app.tab === 'check') renderChecklists();
    fetch('/api/efb/kind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: (p && p.remote) || '' }) }).catch(() => {});
    emit('profile', p);
  } else if (store.get('ac', 'auto') === 'auto') {
    const opt = $('#acSelect option[value=auto]');
    const det = detectedProfile();
    const label = 'Automatisch' + (det ? ': ' + (det.dev ? `${det.name} · ${det.dev}` : det.name) : '');
    if (opt && opt.textContent !== label) opt.textContent = label;
  }

  if (app.tab === 'flight') renderLive();
  if (app.tab === 'gsx') renderGsx();
  updatePlane();
  emit('sim', s);
}

function renderLive() {
  const s = app.sim;
  const rows = [
    ['Flieger', s.title || '–'],
    ['Position', s.lat !== null && s.lat !== undefined ? `${s.lat.toFixed(4)} ${s.lon.toFixed(4)}` : '–'],
    ['Höhe (MSL)', `${fmt(s.alt)} ft`],
    ['Höhe (AGL)', s.agl !== null && s.agl !== undefined ? `${fmt(s.agl)} ft` : '–'],
    ['Groundspeed', `${fmt(s.gs)} kt`],
    ['Vertikal', `${fmt(s.vs)} ft/min`],
    ['Wind', s.windDir !== null && s.windDir !== undefined ? `${String(Math.round(s.windDir)).padStart(3, '0')}° / ${fmt(s.windSpd)} kt` : '–'],
    ['OAT / QNH', s.oat !== null && s.oat !== undefined ? `${fmt(s.oat)} °C / ${Math.round(s.qnh)} hPa` : '–'],
  ];
  $('#liveKv').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
}

function tickClock() {
  const d = new Date();
  $('#utc').textContent = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

// ---------- SimBrief ----------
async function loadOfp(silent) {
  const btns = $$('#btnLoadOfp, [data-action=loadOfp]');
  btns.forEach((b) => { b.disabled = true; b.dataset.label = b.dataset.label || b.textContent; b.textContent = 'Lade OFP…'; });
  try {
    const r = await fetch('/api/simbrief');
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Unbekannter Fehler');
    setOfp(data);
  } catch (e) {
    if (!silent) alert('OFP konnte nicht geladen werden: ' + e.message);
  } finally {
    btns.forEach((b) => { b.disabled = false; b.textContent = b.dataset.label; });
  }
}

function renderWt() {
  const o = app.ofp; if (!o) return;
  const g = o.general || {};
  const w = o.weights || {}, f = o.fuel || {};
  const wt = [
    ['Block Fuel', f.plan_ramp], ['Trip', f.enroute_burn], ['Reserve', f.reserve], ['Alternate', f.alternate_burn],
    ['ZFW', w.est_zfw], ['TOW', w.est_tow], ['LDW', w.est_ldw], ['PAX', w.pax_count],
  ];
  $('#wtKv').innerHTML = wt.map(([k, v]) => `<dt>${k}</dt><dd>${k === 'PAX' ? fmt(num(v)) : WU.show(WU.ofpKg(v, o))}</dd>`).join('') +
    `<dt>Cost Index</dt><dd>${esc(g.costindex ?? '–')}</dd>`;
}
WU.on(() => { renderWt(); });

function setOfp(o) {
  app.ofp = o;
  const g = o.general || {}, or = o.origin || {}, de = o.destination || {}, al = o.alternate || {};
  const callsign = (o.atc && o.atc.callsign) || `${g.icao_airline || ''}${g.flight_number || ''}`;
  const fl = num(g.initial_altitude);
  const block = num(o.times && o.times.est_block);
  const blockTxt = block ? `${Math.floor(block / 3600)}:${String(Math.round((block % 3600) / 60)).padStart(2, '0')}` : '–';

  $('#stripFlight').innerHTML = `<b>${esc(callsign)}</b>  ${esc(or.icao_code)} ${esc(or.plan_rwy || '')}  –  ${esc(de.icao_code)} ${esc(de.plan_rwy || '')}  FL${fl ? Math.round(fl / 100) : '–'}`;

  $('#routeBlock').innerHTML = `
    <div class="apt">${esc(or.icao_code)}<small>${esc(or.name)} · RWY ${esc(or.plan_rwy || '–')}</small></div>
    <div class="route-line"><span>${esc(callsign)} · FL${fl ? Math.round(fl / 100) : '–'}</span><span class="below">${fmt(num(g.air_distance))} NM · Block ${blockTxt}${al.icao_code ? ' · ALTN ' + esc(al.icao_code) : ''}</span><i class="rl-done"></i><i class="rl-plane" hidden><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M18 2l2.4 11 12 6.5v3l-12-3.2-.9 8 3.8 2.8v2.4L18 31l-5.3 1.5v-2.4l3.8-2.8-.9-8-12 3.2v-3l12-6.5z"/></svg></i><span class="rl-pct below" hidden></span></div>
    <div class="apt dest">${esc(de.icao_code)}<small>${esc(de.name)} · RWY ${esc(de.plan_rwy || '–')}</small></div>
    <div class="route-meta">${esc(g.route || '')}</div>`;

  renderWt();

  const wx = o.weather || {};
  $('#wxBox').innerHTML = [['DEP', or.icao_code, wx.orig_metar], ['ARR', de.icao_code, wx.dest_metar], ['ALT', al.icao_code, wx.altn_metar]]
    .filter((x) => x[2]).map(([t, icao, m]) => `<p><b>${t} ${esc(icao)}</b>${esc(m)}</p>`).join('') || '<span class="dim-t">Keine METARs im OFP.</span>';

  const planHtml = o.text && o.text.plan_html;
  $('#ofpBody').innerHTML = planHtml || '<p class="empty">Der OFP enthält keinen Text.</p>';
  const gen = o.params && o.params.time_generated ? new Date(Number(o.params.time_generated) * 1000) : null;
  $('#ofpInfo').textContent = gen ? `Erstellt ${gen.toLocaleString(window.LANG === 'en' ? 'en-GB' : 'de-DE')}` : '';

  renderPerf();
  drawRoute();
  updateProgress();
  emit('ofp', o);
}

// ---------- Performance ----------
function asArray(x) { return Array.isArray(x) ? x : x ? [x] : []; }
function renderPerf() {
  const tlr = app.ofp && app.ofp.tlr;
  const block = (part, el) => {
    const data = tlr && tlr[part];
    if (!data) return;
    const planned = data.conditions && data.conditions.planned_runway;
    const rwys = asArray(data.runway);
    const r = rwys.find((x) => x.identifier === planned) || rwys[0];
    if (!r) return;
    const sp = [['V1', r.speeds_v1], ['VR', r.speeds_vr], ['V2', r.speeds_v2], ['VREF', r.speeds_vref || data.distance_dry && data.distance_dry.speeds_vref]]
      .filter((x) => x[1]);
    const skip = /^(speeds_|identifier)/;
    const rows = Object.entries(r).filter(([k, v]) => !skip.test(k) && (typeof v === 'string' || typeof v === 'number') && v !== '');
    const cond = data.conditions ? Object.entries(data.conditions).filter(([, v]) => typeof v === 'string' || typeof v === 'number') : [];
    $(el).innerHTML = `
      <div class="perf-rwy">RWY ${esc(r.identifier || planned || '–')}</div>
      ${sp.length ? `<div class="speeds">${sp.map(([k, v]) => `<div><small>${k}</small>${esc(v)}</div>`).join('')}</div>` : ''}
      <dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(v)}</dd>`).join('')}
      ${cond.map(([k, v]) => `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
  };
  block('takeoff', '#perfTo');
  block('landing', '#perfLdg');
  const or = app.ofp && app.ofp.origin;
  if (or && or.plan_rwy && !$('#rwyHdg').value) {
    const m = String(or.plan_rwy).match(/^(\d{2})/);
    if (m) { $('#rwyHdg').value = String(Number(m[1]) * 10).padStart(3, '0'); calcWind(); }
  }
}

function calcWind() {
  const rwy = num($('#rwyHdg').value), dir = num($('#windDir').value), spd = num($('#windSpd').value);
  const out = $('#windOut');
  if (rwy === null || dir === null || spd === null) { out.textContent = ''; return; }
  const diff = ((dir - rwy) * Math.PI) / 180;
  const head = spd * Math.cos(diff), cross = spd * Math.sin(diff);
  out.innerHTML = `<span class="${head >= 0 ? 'head' : 'tail'}">${head >= 0 ? 'Gegenwind' : 'Rückenwind'} ${fmt(Math.abs(head))} kt</span>   ` +
    `Seitenwind ${fmt(Math.abs(cross))} kt ${Math.abs(cross) < 0.5 ? '' : cross > 0 ? 'von rechts' : 'von links'}`;
}

// ---------- Karte ----------
let map, planeMarker, routeLayer, follow = true;
// Leaflet wird erst geladen, wenn die Karte geöffnet wird – sonst kann eine
// hängende Internet-Anfrage den Start der ganzen App blockieren.
let leafletLoading = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'lib/leaflet/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'lib/leaflet/leaflet.js';
    js.onload = resolve;
    js.onerror = () => { leafletLoading = null; reject(new Error('Kartenbibliothek nicht ladbar')); };
    document.head.appendChild(js);
  });
  return leafletLoading;
}
function initMap() {
  if (map) { setTimeout(() => map.invalidateSize(), 50); return; }
  if (!window.L) {
    $('#map').innerHTML = '<p class="empty" style="padding:20px">Karte wird geladen …</p>';
    loadLeaflet().then(() => { $('#map').innerHTML = ''; initMap(); })
      .catch(() => { $('#map').innerHTML = '<p class="empty" style="padding:20px">Kartenbibliothek nicht geladen. Hat das iPad Internet? Öffne die Karte erneut, um es nochmal zu versuchen.</p>'; });
    return;
  }
  map = L.map('map', { zoomControl: false, attributionControl: true, preferCanvas: true, zoomSnap: 0.5, wheelPxPerZoomLevel: 90 }).setView([51.42, 12.24], 8);
  // Kacheln von OpenStreetMap über die PC-Brücke (kostenlos, ohne Schlüssel); dunkel per CSS-Filter
  const tmax = (app.config && app.config.tileMax) || 19;
  L.tileLayer(window.TILE_URL || `/tiles/{z}/{x}/{y}.png?p=${encodeURIComponent((app.config && app.config.tileActive) || 'carto')}`, {
    maxZoom: 19, maxNativeZoom: tmax, className: 'osm-tiles', updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 2, attribution: (app.config && app.config.tileAttr) || '© OpenStreetMap-Mitwirkende',
  }).addTo(map);
  map.getContainer().classList.toggle('map-light', store.get('mapStyle', 'dark') === 'light');
  $('#mapStyle').textContent = store.get('mapStyle', 'dark') === 'light' ? 'Dunkel' : 'Hell';
  map.on('dragstart', () => { follow = false; $('#mapFollow').classList.remove('on'); });
  drawRoute(); updatePlane();
  setTimeout(() => map.invalidateSize(), 50);
  emit('tab', 'map:init');
}
const planeSvg = (hdg) => `<svg width="36" height="36" viewBox="0 0 36 36" style="transform:rotate(${hdg}deg)"><path d="M18 2l2.4 11 12 6.5v3l-12-3.2-.9 8 3.8 2.8v2.4L18 31l-5.3 1.5v-2.4l3.8-2.8-.9-8-12 3.2v-3l12-6.5z" fill="#ffa31a" stroke="#000" stroke-width="1"/></svg>`;
let planeHdg = null, planeAt = 0, panAt = 0;
function updatePlane() {
  const s = app.sim;
  if (!map || s.lat === null || s.lat === undefined) return;
  // nur auf der Karte und höchstens 4-mal pro Sekunde zeichnen
  const now = performance.now();
  if (app.tab !== 'map' && planeMarker) return;
  if (now - planeAt < 250) return;
  planeAt = now;
  const pos = [s.lat, s.lon], hdg = Math.round(s.hdg || 0);
  if (!planeMarker) { planeHdg = hdg; planeMarker = L.marker(pos, { icon: L.divIcon({ className: 'plane-icon', html: planeSvg(hdg), iconSize: [36, 36], iconAnchor: [18, 18] }), interactive: false }).addTo(map); }
  else {
    planeMarker.setLatLng(pos);
    if (Math.abs(((hdg - planeHdg + 540) % 360) - 180) >= 2) { planeHdg = hdg; const el = planeMarker.getElement(); const sv = el && el.querySelector('svg'); if (sv) sv.style.transform = `rotate(${hdg}deg)`; } // nur drehen, Symbol nicht neu bauen
  }
  if (follow && app.tab === 'map' && now - panAt > 400) { // nur nachführen, wenn sich das Flugzeug merklich von der Mitte entfernt hat (jedes Verschieben zeichnet die Karte neu)
    const c = map.latLngToContainerPoint(pos), sz = map.getSize();
    if (Math.hypot(c.x - sz.x / 2, c.y - sz.y / 2) > 6) { panAt = now; map.panTo(pos, { animate: false }); }
  }
}
function drawRoute() {
  if (!map || !app.ofp) return;
  const fixes = asArray(app.ofp.navlog && app.ofp.navlog.fix);
  const or = app.ofp.origin, de = app.ofp.destination;
  const pts = [];
  if (or && or.pos_lat) pts.push({ ident: or.icao_code, lat: +or.pos_lat, lon: +or.pos_long });
  fixes.forEach((f) => pts.push({ ident: f.ident, lat: +f.pos_lat, lon: +f.pos_long, type: f.type, altFt: Number(f.altitude_feet), wd: f.wind_dir, ws: f.wind_spd }));
  if (routeLayer) routeLayer.remove();
  routeLayer = L.layerGroup().addTo(map);
  L.polyline(pts.map((p) => [p.lat, p.lon]), { color: '#e040fb', weight: 3 }).addTo(routeLayer);
  pts.filter((p) => p.type !== 'ltlg' && p.ident !== 'TOC' && p.ident !== 'TOD').forEach((p) => {
    L.circleMarker([p.lat, p.lon], { radius: 4, color: '#e040fb', fillOpacity: 1 })
      .bindTooltip(p.ident, { permanent: true, direction: 'right', className: 'wpt-label', offset: [4, 0] })
      .on('click', () => showWpWind(p))
      .addTo(routeLayer);
  });
  routeLayer.bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lon]));
  void de;
}

// Wind an einem Wegpunkt: Vorhersage auf mehreren Höhen (Open-Meteo), die Zeile der OFP-Flughöhe ist markiert
async function showWpWind(p) {
  const pad3 = (n) => String(Math.round(n)).padStart(3, '0');
  const head = `<b>${esc(p.ident)}</b>${Number.isFinite(p.altFt) && p.altFt > 0 ? ` · OFP ${p.altFt >= 18000 ? 'FL' + Math.round(p.altFt / 100) : fmt(p.altFt) + ' ft'}` : ''}${p.wd !== undefined && p.wd !== '' ? ` · OFP-Wind ${pad3(p.wd)}°/${Math.round(p.ws)} kt` : ''}`;
  const pop = L.popup({ maxWidth: 280, className: 'wp-pop' }).setLatLng([p.lat, p.lon]).setContent(`${head}<p class="wx-note">Lade Wind …</p>`).openOn(map);
  try {
    const r = await fetch(`/api/wx/profile?lat=${p.lat.toFixed(3)}&lon=${p.lon.toFixed(3)}`); if (!r.ok) throw new Error(r.status);
    const d = await r.json(), lv = d.levels || [], pt = (d.point && d.point.levels) || {};
    const want = Number.isFinite(p.altFt) && p.altFt > 0 ? p.altFt / 100 : null;
    let near = null; if (want !== null) lv.forEach((l) => { if (near === null || Math.abs(l.fl - want) < Math.abs(near.fl - want)) near = l; });
    const rows = lv.map((l) => { const v = pt[l.id]; return `<tr class="${near && near.id === l.id ? 'hit' : ''}"><td>${esc(l.label)}</td><td>${v && v.dir != null ? pad3(v.dir) + '°' : '–'}</td><td>${v && v.kt != null ? Math.round(v.kt) + ' kt' : '–'}</td><td>${v && v.temp != null ? Math.round(v.temp) + ' °C' : '–'}</td></tr>`; }).join('');
    pop.setContent(`${head}<table class="wp-wind"><thead><tr><th>Höhe</th><th>Wind</th><th>Stärke</th><th>Temp</th></tr></thead><tbody>${rows}</tbody></table><p class="wx-note">Vorhersage von Open-Meteo${d.demo ? ' (Demo)' : ''}${near ? ' · markiert: nächste Stufe zur OFP-Höhe' : ''}</p>`);
  } catch (e) { pop.setContent(`${head}<p class="wx-note">Wind konnte nicht geladen werden (${esc(String(e.message || e))}). Braucht Internet am PC.</p>`); }
}

// ---------- Checklisten ----------
let clIndex = 0;
function checklistKey() { const p = currentProfile(); return (p && p.checklist) || 'airbus-narrow'; }
function renderChecklists() {
  const key = checklistKey();
  const lists = app.checklists[key] || [];
  const prog = store.get('cl.' + key, {});
  if (clIndex >= lists.length) clIndex = 0;
  $('#checkSide').innerHTML = lists.map((l, i) => {
    const done = (prog[i] || []).filter(Boolean).length;
    const full = done === l.items.length;
    return `<button class="cl-btn ${i === clIndex ? 'on' : ''} ${full ? 'done' : ''}" data-cl="${i}">${esc(l.name)}<span class="cnt">${done}/${l.items.length}</span></button>`;
  }).join('') + `<button class="btn-s" id="clResetAll">Alle zurücksetzen</button>`;
  const l = lists[clIndex];
  if (!l) { $('#checkMain').innerHTML = '<p class="empty">Keine Checklisten vorhanden.</p>'; return; }
  const ticks = prog[clIndex] || [];
  const nextIdx = l.items.findIndex((_, i) => !ticks[i]);
  $('#checkMain').innerHTML = `<h2 class="cl-title">${esc(l.name)}</h2>
    <ul class="cl-items">${l.items.map((it, i) => `<li><button class="${ticks[i] ? 'done' : ''} ${i === nextIdx ? 'next' : ''}" data-item="${i}">
      <span class="box"></span><span>${esc(it.item)}</span><span class="resp">${esc(it.resp)}</span></button></li>`).join('')}</ul>
    ${nextIdx === -1 ? `<div class="cl-complete">${esc(l.name)} complete</div>` : ''}
    <div class="cl-foot">
      ${clIndex < lists.length - 1 ? `<button class="btn" id="clNext">Nächste: ${esc(lists[clIndex + 1].name)}</button>` : ''}
      <button class="btn-s" id="clReset">Diese zurücksetzen</button>
    </div>`;
}
function tickItem(i) {
  const key = checklistKey();
  const prog = store.get('cl.' + key, {});
  const t = prog[clIndex] || [];
  t[i] = !t[i]; prog[clIndex] = t;
  store.set('cl.' + key, prog);
  renderChecklists();
}

// ---------- GSX ----------
const GSX_ST = { 0: 'Unbekannt', 1: 'Bereit', 2: 'Nicht verfügbar', 3: 'Übersprungen', 4: 'Angefordert', 5: 'Läuft', 6: 'Fertig' };
// Kachel: [Dienst, Beschriftung, GSX-Statusvariable]
const GSX_TILES = [
  ['deboarding', 'Deboarding', 'deboarding'], ['catering', 'Catering', 'catering'],
  ['refueling', 'Betanken', 'refueling'], ['boarding', 'Boarding', 'boarding'],
  ['pushback', 'Pushback', 'departure'], ['jetway', 'Fluggastbrücke', null],
  ['stairs', 'Treppen', null], ['gpu', 'GPU', null],
];
const GSX_EXTRA = [
  ['deice', 'De-Icing'], ['followme', 'Follow-me'], ['parking', 'Parkposition'], ['position', 'Position anpassen'],
  ['additional', 'Zusatzdienste'], ['cleaning', 'Reinigung'], ['lavatory', 'Toilette'], ['water', 'Wasser'],
  ['crewbus', 'Crew-Bus'], ['cameras', 'Kameras'],
];
const gsxUi = { busy: null, msg: '', msgBad: false, showMenuUntil: 0, html: '' };

function gsxWebUrl() {
  const u = String((app.config && app.config.gsxWebUrl) || '').trim();
  return u ? u.replace(/\{host\}/g, location.hostname) : '';
}
function renderGsxMode() {
  const url = gsxWebUrl(), mode = url ? store.get('gsxMode', 'web') : 'tiles';
  $('#gsxMode').hidden = !url;
  $$('#gsxMode [data-gsxmode]').forEach((b) => b.classList.toggle('on', b.dataset.gsxmode === mode));
  const web = !!url && mode === 'web';
  $('#gsxWeb').hidden = !web;
  ['#gsxTiles', '#gsxAsk', '.gsx-foot'].forEach((s) => { const e = document.querySelector('#tab-gsx ' + s); if (e) e.style.display = web ? 'none' : ''; });
  if (url) $('#gsxOpenWeb').href = url;
  const f = $('#gsxFrame');
  if (web && f.dataset.src !== url) { f.dataset.src = url; f.src = url; }
  return web;
}
function renderGsx() {
  if (renderGsxMode()) return;
  const g = app.sim.gsx || {};
  const info = app.sim.gsxInfo || {};
  const tiles = GSX_TILES.map(([key, label, v]) => {
    const st = v ? Math.round(g[v] || 0) : null;
    let sub = st === null ? 'Antippen' : GSX_ST[st] || st;
    if (key === 'boarding' && g.paxBoarding) sub += ` · ${fmt(g.paxBoarding)} PAX`;
    if (gsxUi.busy === key) sub = 'Wird angefordert …';
    return `<button class="gsx-tile st-${st === null ? 'x' : st} ${gsxUi.busy === key ? 'busy' : ''}" data-svc="${key}" ${gsxUi.busy ? 'disabled' : ''}>
      <span class="t-name">${label}</span><span class="t-state">${esc(sub)}</span></button>`;
  }).join('') + '<h3 class="gsx-sub">Weitere Dienste</h3>' + GSX_EXTRA.map(([key, label]) =>
    `<button class="gsx-tile small-t st-x ${gsxUi.busy === key ? 'busy' : ''}" data-svc="${key}" ${gsxUi.busy ? 'disabled' : ''}><span class="t-name">${label}</span>${gsxUi.busy === key ? '<span class="t-state">Wird angefordert …</span>' : ''}</button>`).join('');

  // Rückfragen von GSX (z. B. Pushback-Richtung, Handling-Agent) als Kacheln
  const m = info.menu;
  const showAsk = m && m.items && m.items.length && (m.age < 60 || Date.now() < gsxUi.showMenuUntil);
  const ask = showAsk ? m.items.map((t, i) => `<button class="gsx-tile st-x" data-gsx="${i}"><span class="t-name">${esc(t)}</span></button>`).join('') : '';

  let note = gsxUi.msg;
  if (!note) {
    if (!app.sim.connected) note = 'Sim nicht verbunden.';
    else if (!info.menuFile) note = 'GSX-Menüdatei nicht gefunden. Pfad unter Setup eintragen.';
    else if (!g.installed) note = 'GSX scheint nicht zu laufen (Couatl nicht gestartet).';
  }
  const html = tiles + '|' + (showAsk ? m.title + ask : '') + '|' + note + gsxUi.msgBad;
  if (html === gsxUi.html) return;
  gsxUi.html = html;
  $('#gsxTiles').innerHTML = tiles;
  $('#gsxAsk').hidden = !showAsk;
  if (showAsk) { $('#gsxAskTitle').textContent = m.title; $('#gsxAskItems').innerHTML = ask; }
  const n = $('#gsxNote');
  n.textContent = note || '';
  n.classList.toggle('bad', !!gsxUi.msgBad);
}

async function gsxPost(path, body) {
  return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then((x) => x.json()).catch(() => ({ ok: false, error: 'PC-Brücke nicht erreichbar.' }));
}
function gsxFlash(msg, bad) {
  gsxUi.msg = msg; gsxUi.msgBad = bad;
  clearTimeout(gsxUi.t);
  gsxUi.t = setTimeout(() => { gsxUi.msg = ''; gsxUi.msgBad = false; renderGsx(); }, 6000);
  renderGsx();
}
async function gsxService(key) {
  gsxUi.busy = key; renderGsx();
  const r = await gsxPost('/api/gsx/service', { service: key });
  gsxUi.busy = null;
  if (r.menu) gsxUi.showMenuUntil = Date.now() + 40000;
  gsxFlash(r.ok ? `GSX: „${r.chosen}“ ausgelöst.` : r.error, !r.ok);
}
async function gsxChoose(i) {
  const r = await gsxPost('/api/gsx/choose', { index: i });
  gsxUi.showMenuUntil = 0;
  gsxFlash(r.ok ? 'Auswahl an GSX gesendet.' : 'Auswahl konnte nicht gesendet werden.', !r.ok);
}
async function gsxRefresh() {
  const r = await gsxPost('/api/gsx/refresh');
  if (r.ok) { gsxUi.showMenuUntil = Date.now() + 40000; gsxFlash('', false); } else gsxFlash(r.error, true);
}

// ---------- Setup ----------
function renderSetup() {
  $('#sbUser').value = app.config.simbriefUser || '';
  $('#spClient').value = app.config.spotifyClientId || '';
  $('#gsxFile').value = app.config.gsxMenuFile || '';
  $('#gsxWebIn').value = app.config.gsxWebUrl || '';
  $('#tileProv').innerHTML = Object.entries(app.config.tileProviders || {}).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('') + '<option value="custom">Eigene Adresse …</option>';
  $('#tileProv').value = app.config.tileActive || 'osm';
  $('#tileUrl').value = app.config.tileUrl || '';
  $('#tileUrlRow').hidden = $('#tileProv').value !== 'custom';
  $('#acEditor').innerHTML = app.config.aircraft.map((a, i) => `
    <div class="ac-edit" data-i="${i}">
      <div class="ac-head">
        <label class="ac-name">Name<input data-f="name" value="${esc(a.name)}"></label>
        <button class="btn-s ac-del" data-del="${i}">Entfernen</button>
      </div>
      <div class="ac-fields">
        <label>EFB-Adresse<input data-f="efbUrl" value="${esc(a.efbUrl)}" autocapitalize="off" autocorrect="off"></label>
        <label>Hersteller<input data-f="maker" value="${esc(a.maker || '')}" placeholder="Airbus, Boeing …"></label>
        <label>Entwickler<input data-f="dev" value="${esc(a.dev || '')}" placeholder="PMDG, iniBuilds …"></label>
        <label>Suchbegriffe (Komma; „PMDG&737“ = beides)<input data-f="match" value="${esc((a.match || []).join(', '))}" autocapitalize="off" autocorrect="off"></label>
      </div>
    </div>`).join('') + `<button class="btn-s" id="acAdd">Flieger hinzufügen</button>`;
}
function readSetup() {
  $$('.ac-edit').forEach((row) => {
    const a = app.config.aircraft[row.dataset.i];
    row.querySelectorAll('input').forEach((inp) => {
      a[inp.dataset.f] = inp.dataset.f === 'match' ? inp.value.split(',').map((s) => s.trim()).filter(Boolean) : inp.value.trim();
    });
  });
  app.config.simbriefUser = $('#sbUser').value.trim();
  app.config.spotifyClientId = $('#spClient').value.trim();
  app.config.gsxMenuFile = $('#gsxFile').value.trim();
  app.config.gsxWebUrl = $('#gsxWebIn').value.trim();
  app.config.tileProvider = $('#tileProv').value;
  app.config.tileUrl = $('#tileProv').value === 'custom' ? $('#tileUrl').value.trim() : '';
}
function renderGsxFileInfo() {
  const f = (app.sim.gsxInfo || {}).menuFile;
  $('#gsxFileInfo').textContent = f ? `Gefunden: ${f}` : 'Noch nicht gefunden. Die Datei heißt „menu“ und liegt im GSX-Paketordner unter html_ui\\InGamePanels\\FSDT_GSX_Panel.';
}
async function saveSetup() {
  readSetup();
  const r = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(app.config) });
  if (typeof Settings !== 'undefined') Settings.toast(r.ok ? 'Gespeichert' : 'Speichern fehlgeschlagen', !r.ok);
  if (r.ok) { app.config = await r.json(); renderSetup(); renderAcSelect(); app.frames = { efb: '' }; updateFrames(); setTimeout(renderGsxFileInfo, 800); }
}
function applyDim(v) { $('#dim').style.opacity = v / 100; $('#dimRange').value = v; }

// ---------- Bedienung ----------
function bindUi() {
  $('#rail').addEventListener('click', (e) => { const b = e.target.closest('.pb'); if (b) showTab(b.dataset.tab); });
  $('#acSelect').addEventListener('change', (e) => {
    store.set('ac', e.target.value); lastProfileId = undefined; onSim();
  });
  $('#btnLoadOfp').addEventListener('click', () => loadOfp());
  $('#tileProv').addEventListener('change', (e) => { $('#tileUrlRow').hidden = e.target.value !== 'custom'; });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.action === 'loadOfp') loadOfp();
    if (t.dataset.reload) updateFrames(t.dataset.reload);
    if (t.dataset.cl !== undefined) { clIndex = Number(t.dataset.cl); renderChecklists(); }
    if (t.dataset.item !== undefined) tickItem(Number(t.dataset.item));
    if (t.id === 'clNext') { clIndex++; renderChecklists(); }
    if (t.id === 'clReset') { const k = 'cl.' + checklistKey(); const p = store.get(k, {}); delete p[clIndex]; store.set(k, p); renderChecklists(); }
    if (t.id === 'clResetAll' && confirm('Alle Checklisten zurücksetzen?')) { store.set('cl.' + checklistKey(), {}); clIndex = 0; renderChecklists(); }
    if (t.dataset.svc) gsxService(t.dataset.svc);
    if (t.dataset.gsx !== undefined) gsxChoose(Number(t.dataset.gsx));
    if (t.id === 'gsxRefresh') gsxRefresh();
    if (t.dataset.gsxmode) { store.set('gsxMode', t.dataset.gsxmode); gsxUi.html = ''; renderGsx(); }
    if (t.dataset.del !== undefined) { readSetup(); app.config.aircraft.splice(Number(t.dataset.del), 1); renderSetup(); }
    if (t.id === 'acAdd') { readSetup(); app.config.aircraft.push({ id: 'ac-' + Date.now(), name: 'Neuer Flieger', match: [], efbUrl: '', checklist: 'airbus-narrow' }); renderSetup(); }
    if (t.id === 'btnSave' || t.id === 'btnSave2') saveSetup();
    if (t.id === 'mapStyle' && map) {
      const light = store.get('mapStyle', 'dark') !== 'light';
      store.set('mapStyle', light ? 'light' : 'dark');
      map.getContainer().classList.toggle('map-light', light);
      t.textContent = light ? 'Dunkel' : 'Hell';
    }
    if (t.id === 'mapFollow') { follow = !follow; t.classList.toggle('on', follow); updatePlane(); }
    if (t.id === 'mapRoute' && routeLayer && routeLayer.bounds && routeLayer.bounds.isValid()) { follow = false; $('#mapFollow').classList.remove('on'); map.fitBounds(routeLayer.bounds, { padding: [30, 30] }); }
    if (t.id === 'windLive' && app.sim.windDir !== null && app.sim.windDir !== undefined) {
      $('#windDir').value = String(Math.round(app.sim.windDir)).padStart(3, '0'); $('#windSpd').value = Math.round(app.sim.windSpd); calcWind();
    }
  });
  ['#rwyHdg', '#windDir', '#windSpd'].forEach((s) => $(s).addEventListener('input', calcWind));
  $('#dimRange').addEventListener('input', (e) => { store.set('dim', +e.target.value); applyDim(+e.target.value); });
}

document.addEventListener('DOMContentLoaded', init);


// ---------- Flugzeug auf der Streckenlinie ----------
function updateProgress() {
  const pl = $('.rl-plane'), o = app.ofp, s = app.sim;
  if (!pl) return;
  const a = o && o.origin, b = o && o.destination;
  const ok = a && b && a.pos_lat && b.pos_lat && s && s.connected && s.lat != null && s.lat !== 0;
  pl.hidden = !ok; $('.rl-pct').hidden = !ok;
  if (!ok) { $('.rl-done').style.width = '0'; return; }
  const d = (p, q, r, t) => { const k = Math.PI / 180, x = Math.sin((r - p) * k / 2) ** 2 + Math.cos(p * k) * Math.cos(r * k) * Math.sin((t - q) * k / 2) ** 2; return 6371 / 1.852 * 2 * Math.asin(Math.sqrt(x)); };
  const done = d(+a.pos_lat, +a.pos_long, s.lat, s.lon), left = d(s.lat, s.lon, +b.pos_lat, +b.pos_long);
  const f = Math.max(0, Math.min(1, done / Math.max(1, done + left)));
  pl.style.left = (f * 100).toFixed(1) + '%';
  $('.rl-done').style.width = (f * 100).toFixed(1) + '%';
  const r = $('.rl-pct');
  // Passt zur Streckenlänge aus dem OFP (Anzeige oben): der Anteil kommt aus der Luftlinie, die Summe aus der geplanten Strecke
  const plan = Number(o.general && o.general.air_distance) || 0;
  const tot = plan > 0 ? plan : done + left;
  r.textContent = `${fmt(Math.round(f * tot))} NM geflogen · ${fmt(Math.round((1 - f) * tot))} NM verbleibend`;
}
hooks.sim.push(updateProgress);
