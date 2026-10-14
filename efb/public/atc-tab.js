// ATC-Tab für VATSIM: IFR-Freigabe notieren, Lotsen auf der Route sehen, Frequenz als „aktiv“ merken.
// Alles hier ist reine Anzeige – es wird nichts an den Simulator oder das Flugzeug gesendet.
'use strict';

const AtcTab = (() => {
  const FIELDS = ['cs', 'dep', 'dest', 'rte', 'sid', 'rwy', 'alt', 'sqk', 'atis', 'qnh', 'park', 'note'];
  let clr = store.get('clr', { flightKey: '' });
  let active = store.get('atcActive', null);
  let prev = store.get('atcPrev', null);
  let sidbook = store.get('sidbook', {});
  let fileSids = {};
  let data = null, err = '', timer = null, lastKey = '', lastPoll = 0, built = false;

  const save = () => store.set('clr', clr);
  const upper = (v) => String(v || '').trim().toUpperCase();
  const asArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);
  const ROLE_NAME = { DEL: 'Delivery', GND: 'Ground', TWR: 'Tower', APP: 'Approach / Departure', CTR: 'Center', FSS: 'FSS' };

  // ---------- OFP → Formular ----------
  function flightKey(o) {
    return o ? [o.atc && o.atc.callsign, o.origin && o.origin.icao_code, o.destination && o.destination.icao_code, o.params && o.params.time_generated].join('|') : '';
  }
  function sidFromRoute(route) {
    const t = String(route || '').trim().split(/\s+/)[0] || '';
    return /^[A-Z]{3,6}\d[A-Z]$/.test(t) ? t : '';
  }
  function fromOfp(force) {
    const o = app.ofp; if (!o) return;
    const key = flightKey(o);
    if (!force && clr.flightKey === key) return;
    const route = (o.general && o.general.route) || '';
    clr = {
      flightKey: key, cs: (o.atc && o.atc.callsign) || '', dep: (o.origin && o.origin.icao_code) || '', dest: (o.destination && o.destination.icao_code) || '',
      rte: route, sid: sidFromRoute(route), rwy: (o.origin && o.origin.plan_rwy) || '', alt: '', cvs: false, sqk: '', atis: '', qnh: '', park: '', note: '', rb: false,
    };
    applySidAlt();
    save();
  }
  function sidList() {
    const dep = upper(clr.dep);
    const names = new Set([...Object.keys(fileSids[dep] || {}), ...Object.keys(sidbook[dep] || {})]);
    const s = sidFromRoute(clr.rte); if (s) names.add(s);
    return [...names].sort();
  }
  function sidEntry() {
    const dep = upper(clr.dep), sid = upper(clr.sid);
    return (sidbook[dep] && sidbook[dep][sid]) || (fileSids[dep] && fileSids[dep][sid]) || null;
  }
  function applySidAlt() {
    const e = sidEntry();
    if (e && e.alt && (!clr.alt || clr.altAuto)) { clr.alt = String(e.alt); clr.altAuto = true; }
  }

  // ---------- Darstellung ----------
  const sqkOk = (s) => /^[0-7]{4}$/.test(s || '');
  function summary() {
    const v = (x, ph = '—') => (x ? esc(x) : `<i>${ph}</i>`);
    return `<div class="clr-sum">
      <div><small>Rufzeichen</small><b>${v(upper(clr.cs))}</b></div>
      <div><small>Ziel</small><b>${v(upper(clr.dest))}</b></div>
      <div><small>SID</small><b>${v(upper(clr.sid))}</b></div>
      <div><small>Piste</small><b>${v(upper(clr.rwy))}</b></div>
      <div><small>Parkposition</small><b>${v(upper(clr.park))}</b></div>
      <div><small>Steigflug</small><b>${clr.cvs ? 'Climb via SID' : 'Climb ' + v(clr.alt)}</b></div>
      <div><small>ATIS / QNH</small><b>${v(upper(clr.atis))}${clr.qnh ? ' / ' + esc(clr.qnh) : ''}</b></div>
      <div class="sq ${sqkOk(clr.sqk) ? '' : 'miss'}"><small>Squawk</small><b>${v(clr.sqk, '––––')}</b></div>
    </div>`;
  }
  const inp = (label, id, extra = '') => `<label>${label}<input id="clr_${id}" value="${esc(clr[id] || '')}" autocomplete="off" autocapitalize="characters" autocorrect="off" ${extra}></label>`;

  function build() {
    $('#clrPanel').innerHTML = `
      <h3>IFR-Freigabe</h3>
      <div id="clrSum">${summary()}</div>
      <div class="calc-grid clr-grid">
        ${inp('Rufzeichen', 'cs')}${inp('Abflug', 'dep', 'maxlength="4"')}${inp('Ziel', 'dest', 'maxlength="4"')}
        <label>SID<input id="clr_sid" value="${esc(clr.sid || '')}" list="sidList" autocomplete="off" autocapitalize="characters" autocorrect="off"></label>
        <datalist id="sidList">${sidList().map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
        ${inp('Piste', 'rwy', 'maxlength="3"')}${inp('Anfangshöhe', 'alt', 'inputmode="text" placeholder="z. B. 5000 / FL60"')}
        ${inp('Parkposition', 'park', 'maxlength="8" placeholder="z. B. A12"')}
        <label class="chk"><input type="checkbox" id="clr_cvs" ${clr.cvs ? 'checked' : ''}> Climb via SID <small>(sonst nur „Climb“ auf die Anfangshöhe)</small></label>
        ${inp('Squawk', 'sqk', 'inputmode="numeric" maxlength="4" placeholder="0000"')}${inp('ATIS', 'atis', 'maxlength="1"')}${inp('QNH', 'qnh', 'inputmode="numeric" maxlength="4"')}
      </div>
      <label class="clr-note">Route / Notizen<textarea id="clr_note" rows="3" autocapitalize="off">${esc(clr.note || '')}</textarea></label>
      <div class="form-row">
        <button class="btn-s" id="clrSidOfp">SID aus OFP</button>
        <button class="btn-s" id="clrSqk" hidden></button>
        <button class="btn-s ${clr.rb ? 'on' : ''}" id="clrRb">Readback gesprochen</button>
        <button class="btn-s" id="clrReset">Neu aus OFP</button>
      </div>
      <p class="note" id="clrHint"></p>`;
    hint();
    sqkButton();
    built = true;
  }
  function hint() {
    const el = $('#clrHint'); if (!el) return;
    const e = sidEntry();
    el.textContent = !clr.sid ? 'SID eintragen oder aus dem OFP übernehmen. Die App merkt sich zu jeder SID die Anfangshöhe, sobald du sie einmal eingetragen hast.'
      : e && e.alt ? `Zu ${upper(clr.sid)} ist die Anfangshöhe ${e.alt} gemerkt.` : 'Neue SID – die Anfangshöhe wird beim Eintragen für das nächste Mal gemerkt.';
  }
  function sqkButton() {
    const b = $('#clrSqk'); if (!b) return;
    const a = data && data.me && data.me.assigned;
    b.hidden = !a || a === clr.sqk;
    if (a) { b.textContent = `Squawk von VATSIM übernehmen (${a})`; b.dataset.sqk = a; }
  }

  function station(c, label) {
    const on = active && active.freq === c.freq && active.cs === c.cs;
    return `<button class="stn ${on ? 'on' : ''}" data-f="${esc(c.freq)}" data-cs="${esc(c.cs)}" data-name="${esc(c.name || '')}">
      <b>${esc(c.freq)}</b><span>${esc(c.cs)}</span><small>${esc(label || ROLE_NAME[c.role] || '')}${c.name ? ' · ' + esc(c.name) : ''}</small></button>`;
  }
  const missing = (txt) => `<div class="stn off"><b>–</b><span>${esc(txt)}</span><small>nicht besetzt</small></div>`;

  function airportBlock(title, ap) {
    if (!ap) return '';
    const list = ap.controllers || [];
    const roles = ['DEL', 'GND', 'TWR', 'APP'];
    const cards = [];
    (ap.atis || []).forEach((a) => cards.push(station({ cs: a.cs, freq: a.freq, name: '' }, `ATIS ${a.code || ''}`)));
    roles.forEach((r) => {
      const hit = list.filter((c) => c.role === r);
      if (hit.length) hit.forEach((c) => cards.push(station(c)));
      else cards.push(missing(`${ap.icao} ${r}`));
    });
    return `<section class="frq"><h4>${esc(title)} <b>${esc(ap.icao)}</b></h4><div class="stns">${cards.join('')}</div></section>`;
  }
  function renderFreq() {
    const el = $('#freqPanel'); if (!el) return;
    if (err) { el.innerHTML = `<h3>Frequenzen</h3><p class="empty">${esc(err)}</p>`; return; }
    if (!data) { el.innerHTML = '<h3>Frequenzen</h3><p class="empty">Lade Lotsen von VATSIM …</p>'; return; }
    const route = (data.enroute || []).map((f) => `<section class="frq"><h4>Strecke <b>${esc(f.fir)}</b> <small>${esc(f.name || '')}</small></h4><div class="stns">${
      f.controllers.length ? f.controllers.map((c) => station(c, c.role === 'FSS' ? 'FSS' : 'Center')).join('') : missing(`${f.prefix} Center`)}</div></section>`).join('');
    const noFir = !data.boundaries ? `<p class="note">FIR-Grenzen konnten nicht geladen werden${data.boundaryError ? ` (${esc(data.boundaryError)})` : ''}. Es werden nur Flughäfen angezeigt. Der PC braucht dafür einmalig Internet.</p>` : '';
    el.innerHTML = `<h3>Frequenzen <small class="dim-t">Stand ${esc(String(data.updated || '').slice(11, 19))} UTC${data.demo ? ' · Demo-Daten' : ''}</small></h3>
      ${airportBlock('Abflug', data.dep)}${route}${airportBlock('Ziel', data.dest)}${(data.alts || []).map((a) => airportBlock('Ausweich', a)).join('')}${noFir}`;
  }
  // COM1 im Sim (nur Anzeige): aktiv und Standby; gestellt wird per Sprache über den Copilot
  const mhz = (hz) => (hz > 1e6 ? (hz / 1e6).toFixed(3) : '---.---');
  function com1Html() {
    const s = app.sim || {};
    if (!s.connected) return '<div class="com1-row"><span><small>COM1 AKTIV</small><b>---.---</b></span><span><small>COM1 STANDBY</small><b>---.---</b></span></div><p class="note">Keine Verbindung zum Sim.</p>';
    return `<div class="com1-row"><span><small>COM1 AKTIV</small><b>${mhz(s.com1)}</b></span><span><small>COM1 STANDBY</small><b>${mhz(s.com1s)}</b></span></div>`;
  }
  setInterval(() => { const b = document.getElementById('com1Box'); if (b && app.tab === 'atc') { const h = com1Html(); if (b.innerHTML !== h) b.innerHTML = h; } }, 1000);
  function renderRadio() {
    const el = $('#radioPanel'); if (!el) return;
    el.innerHTML = `<h3>Aktive Frequenz</h3>
      <div class="com1" id="com1Box">${com1Html()}</div>
      <div class="radio"><div class="radio-main"><small>ACTIVE</small><b>${active ? esc(active.freq) : '---.---'}</b><span>${active ? esc(active.cs || '') : 'Tippe unten auf eine Frequenz'}</span></div>
        <button class="radio-prev" id="radioPrev" ${prev ? '' : 'disabled'}><small>Vorher</small><b>${prev ? esc(prev.freq) : '---.---'}</b><span>${prev ? esc(prev.cs || '') : ''}</span></button></div>
      <div class="form-row"><label class="inl">Frequenz <input id="radioIn" inputmode="decimal" placeholder="121.500" maxlength="7"></label>
        <button class="btn-s" id="radioSet">Setzen</button><button class="btn-s" data-f="121.500" data-cs="Guard">Guard 121.500</button><button class="btn-s" data-f="122.800" data-cs="UNICOM">UNICOM 122.800</button></div>
      <p class="note">Das ist nur eine Gedächtnisstütze im EFB. Im Sim und im Flieger ändert sich nichts.</p>`;
    chip();
  }
  function chip() {
    const el = $('#stripAtc'); if (!el) return;
    el.hidden = !active;
    if (active) el.innerHTML = `<small>ACT</small><b>${esc(active.freq)}</b><span>${esc(active.cs || '')}</span>`;
  }
  function setActive(freq, cs, name) {
    if (!/^\d{3}\.\d{1,3}$/.test(freq)) return;
    if (active && active.freq === freq && active.cs === cs) return;
    prev = active; active = { freq, cs: cs || '', name: name || '' };
    store.set('atcActive', active); store.set('atcPrev', prev);
    renderRadio(); renderFreq();
  }

  // ---------- Daten von der PC-Brücke ----------
  function routePoints() {
    const o = app.ofp; if (!o) return [];
    const pts = [];
    const add = (la, lo) => { la = Number(la); lo = Number(lo); if (isFinite(la) && isFinite(lo) && (la || lo)) pts.push([la, lo]); };
    if (o.origin) add(o.origin.pos_lat, o.origin.pos_long);
    asArr(o.navlog && o.navlog.fix).forEach((f) => add(f.pos_lat, f.pos_long));
    if (o.destination) add(o.destination.pos_lat, o.destination.pos_long);
    // höchstens ~120 Punkte schicken
    const step = Math.max(1, Math.ceil(pts.length / 120));
    return pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  }
  // ATIS-Buchstabe und QNH vom VATSIM-ATIS des Abflughafens (solange du sie nicht selbst geändert hast)
  function autoAtis() {
    const a = data && data.dep && (data.dep.atis || [])[0]; if (!a) return;
    if (clr.atis && clr.atisAuto === false) return;
    const code = String(a.code || '').toUpperCase().slice(0, 1);
    const txt = asArr(a.text).join(' ');
    const m = /\b(?:QNH|Q)\s*:?\s*(\d{3,4})\b/i.exec(txt) || /\bA(\d{4})\b/.exec(txt);
    let q = m ? m[1] : '';
    if (/^A?\d{4}$/.test(q) && /\bA\d{4}\b/.test(txt) && !/QNH/i.test(txt)) q = String(Math.round(Number(q) / 100 * 33.8639));
    if (code && (clr.atis !== code || (q && clr.qnh !== q))) {
      clr.atis = code; if (q) clr.qnh = q; clr.atisAuto = true; save();
      const A = $('#clr_atis'), Q = $('#clr_qnh'); if (A) A.value = clr.atis; if (Q) Q.value = clr.qnh || '';
      const S = $('#clrSum'); if (S) S.innerHTML = summary();
    }
  }
  // Parkposition: vor dem Abflug nächster OSM-Standplatz, solange der Flieger steht (Eingabe von Hand gewinnt)
  function autoPark() {
    const s = app.sim || {}; if (!s.connected || !s.onGround || (s.gs || 0) > 1 || s.lat == null) return;
    if (clr.park && clr.parkAuto === false) return;
    const icao = upper(clr.dep); if (!icao || !window.TaxiNav) return;
    if (!TaxiNav.data[icao]) { if (!autoPark.req) { autoPark.req = true; TaxiNav.ensure(icao, s.lat, s.lon).finally(() => { autoPark.req = false; }); } return; }
    const st = TaxiNav.nearestStand(icao, s.lat, s.lon, 60); if (!st || st === clr.park) return;
    clr.park = st; clr.parkAuto = true; save();
    const P = $('#clr_park'); if (P) P.value = st;
    const S = $('#clrSum'); if (S) S.innerHTML = summary();
  }
  setInterval(() => { if (app.tab === 'atc') autoPark(); }, 3000);
  async function poll(force) {
    if (!force && Date.now() - lastPoll < 10000) return;
    lastPoll = Date.now();
    const alts = asArr(app.ofp && app.ofp.alternate).map((a) => a && a.icao_code).filter(Boolean);
    try {
      const r = await fetch('/api/atc', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: routePoints(), dep: upper(clr.dep), dest: upper(clr.dest), alts, callsign: upper(clr.cs) }) });
      if (!r.ok) throw new Error('PC-Brücke antwortet nicht (' + r.status + ')');
      data = await r.json(); err = '';
    } catch (e) {
      err = `Keine Daten von VATSIM: ${e.message || e}. Hat der PC Internet?`;
    }
    autoAtis(); renderFreq(); sqkButton();
  }
  const startPolling = () => { stopPolling(); poll(true); timer = setInterval(() => poll(), 20000); };
  const stopPolling = () => { if (timer) clearInterval(timer); timer = null; };

  // ---------- Bedienung ----------
  document.addEventListener('input', (e) => {
    const id = e.target.id;
    if (!id || !id.startsWith('clr_')) return;
    const f = id.slice(4);
    clr[f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (f === 'atis' || f === 'qnh') clr.atisAuto = false;
    if (f === 'park') clr.parkAuto = false;
    if (f === 'alt') {
      clr.altAuto = false;
      const dep = upper(clr.dep), sid = upper(clr.sid);
      if (dep && sid && clr.alt.trim()) { (sidbook[dep] = sidbook[dep] || {})[sid] = { alt: clr.alt.trim() }; store.set('sidbook', sidbook); }
    }
    if (f === 'sid') { applySidAlt(); const a = $('#clr_alt'); if (a && clr.altAuto) a.value = clr.alt; hint(); }
    if (f === 'sqk') clr.sqk = e.target.value.replace(/[^0-7]/g, '');
    save();
    $('#clrSum').innerHTML = summary();
    sqkButton();
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'clr_dep' || e.target.id === 'clr_dest' || e.target.id === 'clr_cs') { build(); poll(true); }
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button, .stn-link'); if (!t) return;
    if (t.id === 'clrSidOfp') {
      const s = sidFromRoute(app.ofp && app.ofp.general && app.ofp.general.route);
      if (s) { clr.sid = s; applySidAlt(); save(); build(); } else { const h = $('#clrHint'); if (h) h.textContent = 'Im OFP steht keine SID in der Route.'; }
    }
    if (t.id === 'clrSqk') { clr.sqk = t.dataset.sqk; save(); build(); }
    if (t.id === 'clrRb') { clr.rb = !clr.rb; save(); t.classList.toggle('on', clr.rb); }
    if (t.id === 'clrReset') { fromOfp(true); build(); poll(true); }
    if (t.classList.contains('stn') && t.dataset.f) setActive(t.dataset.f, t.dataset.cs, t.dataset.name);
    else if (t.dataset.f && t.closest('#radioPanel')) setActive(t.dataset.f, t.dataset.cs, '');
    if (t.id === 'radioSet') { const v = $('#radioIn').value.trim().replace(',', '.'); const f = /^\d{3}$/.test(v) ? v + '.000' : v; setActive(f.padEnd(7, '0'), '', ''); }
    if (t.id === 'radioPrev' && prev) { const p = prev; prev = active; active = p; store.set('atcActive', active); store.set('atcPrev', prev); renderRadio(); renderFreq(); }
  });
  document.addEventListener('click', (e) => { if (e.target.closest('#stripAtc')) showTab('atc'); });

  hooks.tab.push((n) => {
    if (n === 'atc') {
      fromOfp(false);
      $('#clrPanel') && build(); renderRadio(); renderFreq();
      startPolling();
    } else stopPolling();
  });
  hooks.ofp.push(() => { fromOfp(false); if (app.tab === 'atc') { build(); poll(true); } });
  // eigene SID-Liste aus data/sids.json (optional)
  fetch('data/sids.json').then((r) => (r.ok ? r.json() : {})).then((j) => { fileSids = j && typeof j === 'object' ? j : {}; }).catch(() => {});
  document.addEventListener('DOMContentLoaded', chip);
  setTimeout(chip, 500);
  return { setActive };
})();
