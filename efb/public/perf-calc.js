// Takeoff- und Landing-Rechner mit eigenem Näherungsmodell (siehe perf-model.js)
'use strict';

const PerfCalc = (() => {
  const M = PerfModel;
  const COND = [['dry', 'Trocken'], ['wet', 'Nass'], ['contam', 'Verunreinigt']];
  const KIND_TYPE = { 'fbw-a320': 'A20N', 'hdw-a339': 'A339', 'fbw-a380': 'A388' };
  let type = store.get('perfType', null);
  let built = false;

  const v = (id) => { const x = $(id).value.trim().replace(',', '.'); return x === '' || isNaN(Number(x)) ? null : Number(x); };
  const set = (id, val, auto) => { const el = $(id); el.value = val === null || val === undefined || (typeof val === 'number' && isNaN(val)) ? '' : String(val); if (auto) el.dataset.auto = '1'; else delete el.dataset.auto; };
  const field = (label, id, attrs = '') => `<label>${label}<input id="${id}" inputmode="decimal" autocomplete="off" ${attrs}></label>`;
  const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([k, t]) => `<option value="${k}" ${String(k) === String(cur) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  const airport = (icao) => (app.airports || []).find((a) => a.icao === String(icao || '').toUpperCase().trim());
  const kg = (x) => WU.show(x, 10);
  const wtxt = (w) => String(w).replace(/(\d+) kg/g, (m, n) => WU.show(+n, 10));
  // Höchstgewichte je Piste aus dem TLR des OFP (SimBrief): max_weight steht dort in der OFP-Einheit
  function tlrTable(part) {
    const o = app.ofp, d = o && o.tlr && o.tlr[part]; if (!d) return '';
    const rows = asArray(d.runway).map((r) => ({ id: r.identifier, w: WU.ofpKg(r.max_weight != null ? r.max_weight : r.maximum_weight, o), lim: r.limit_code || r.limiting_factor || '', plan: r.identifier === (d.conditions && d.conditions.planned_runway) })).filter((r) => r.w);
    if (!rows.length) return '';
    return `<h4 class="tlr-h">Höchstgewichte laut OFP (TLR)</h4><table class="tlr-t"><tbody>${rows.map((r) => `<tr class="${r.plan ? 'hit' : ''}"><td>${esc(r.id)}${r.plan ? ' ◂' : ''}</td><td>${WU.show(r.w, 10)}</td><td>${esc(r.lim)}</td></tr>`).join('')}</tbody></table>`;
  }
  WU.on((old, nu) => { // Eingaben in die neue Einheit umrechnen, Beschriftung anpassen
    if (!built) return;
    ['#tTow', '#lLw'].forEach((id) => {
      const el = $(id); if (!el) return;
      const x = v(id); if (x !== null) el.value = String(Math.round(nu === 'lbs' ? x / 0.45359237 : x * 0.45359237));
      if (el.parentNode && el.parentNode.firstChild) el.parentNode.firstChild.textContent = `Gewicht ${WU.label()}`;
    });
    calc();
  });

  function guessType() {
    const o = app.ofp && app.ofp.aircraft && String(app.ofp.aircraft.icaocode || '').toUpperCase();
    if (o && M.TYPES[o]) return o;
    const p = currentProfile();
    if (p && p.id === 'fenix-a320') return 'A320';
    if (p && KIND_TYPE[p.perf]) return KIND_TYPE[p.perf];
    if (p && PerfModel.TYPES[p.perf]) return p.perf;
    return 'A20N';
  }

  function typeOptions(cur) {
    const groups = {};
    Object.values(M.TYPES).forEach((t) => { (groups[t.grp] = groups[t.grp] || []).push(t); });
    return Object.entries(groups).map(([g, ts]) => `<optgroup label="${esc(g)}">${ts.map((t) => `<option value="${t.code}" ${t.code === cur ? 'selected' : ''}>${esc(M.label(t.code))}</option>`).join('')}</optgroup>`).join('');
  }
  function flapLists() {
    const F = M.FAMILIES[M.TYPES[type].fam];
    return { to: [['1+F', F.to[0]], ['2', F.to[1]], ['3', F.to[2]]], ldg: [['FULL', F.ldg[0]], ['3', F.ldg[1]]] };
  }
  function refreshFlaps() {
    const L = flapLists(), t = $('#tConf'), l = $('#lConf');
    const ct = t.value, cl = l.value;
    t.innerHTML = L.to.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join(''); t.value = ct;
    l.innerHTML = L.ldg.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join(''); l.value = cl;
  }

  function build() {
    if (built) return;
    built = true;
    if (!type || !M.TYPES[type]) type = guessType();
    $('#calcHead').innerHTML = `
      <div class="calc-head">
        <label class="ct">Flugzeugtyp<select id="pType">${typeOptions(type)}</select></label>
        <button class="btn" id="pFromOfp">Aus OFP übernehmen</button>
        <p class="note">Eigene Näherungsrechnung für Planung und Gefühl – kein FCOM. Im Sim gelten weiter die Werte des Flugzeugs.</p>
      </div>`;
    $('#calcTo').innerHTML = `
      <h3>Takeoff</h3>
      <div class="calc-grid">
        ${field('Flughafen', 'tIcao', 'maxlength="4" autocapitalize="characters" placeholder="EDDP"')}${field('Piste', 'tRwy', 'inputmode="text" autocapitalize="characters" placeholder="26R"')}
        ${field('Länge m (TORA)', 'tTora')}${field('Elevation ft', 'tElev')}
        ${field('Temperatur °C', 'tOat')}${field('QNH hPa', 'tQnh')}${field('Wind aus °', 'tWdir')}${field('Wind kt', 'tWspd')}
        ${field('Gewicht ' + WU.label(), 'tTow')}
        <label>Klappen${sel('tConf', flapLists().to, '2')}</label>
        <label>Piste${sel('tCond', COND, 'dry')}</label>
      </div>
      <div class="calc-out" id="tOut"></div>`;
    $('#calcLdg').innerHTML = `
      <h3>Landung</h3>
      <div class="calc-grid">
        ${field('Flughafen', 'lIcao', 'maxlength="4" autocapitalize="characters" placeholder="EDDM"')}${field('Piste', 'lRwy', 'inputmode="text" autocapitalize="characters" placeholder="08R"')}
        ${field('Länge m (LDA)', 'lLda')}${field('Elevation ft', 'lElev')}
        ${field('Temperatur °C', 'lOat')}${field('QNH hPa', 'lQnh')}${field('Wind aus °', 'lWdir')}${field('Wind kt', 'lWspd')}
        ${field('Böen kt', 'lGust')}${field('Gewicht ' + WU.label(), 'lLw')}
        <label>Klappen${sel('lConf', flapLists().ldg, 'FULL')}</label>
        <label>Piste${sel('lCond', COND, 'dry')}</label>
      </div>
      <div class="calc-out" id="lOut"></div>`;
    if (app.ofp) fromOfp(); else calc();
  }

  function rwyHint(pre) {
    const a = airport($('#' + pre + 'Icao').value);
    const warn = $('#' + pre + 'Icao').value.trim().length === 4 && !a ? ' (nicht in der Flughafenliste – Daten bitte von Hand eintragen)' : '';
    return { a, warn };
  }

  function calcTakeoff() {
    const out = $('#tOut');
    const need = ['#tTora', '#tOat', '#tQnh', '#tTow'].filter((s) => v(s) === null);
    if (need.length) { out.innerHTML = '<p class="empty">Länge, Temperatur, QNH und Gewicht eintragen.</p>'; return; }
    const hdg = M.rwyHeading($('#tRwy').value);
    const p = { type, conf: $('#tConf').value, cond: $('#tCond').value, tow: WU.toKg(v('#tTow')), tora: v('#tTora'), elev: v('#tElev') || 0, qnh: v('#tQnh'), oat: v('#tOat'),
      windDir: v('#tWdir') || 0, windSpd: hdg === null ? 0 : v('#tWspd') || 0, rwyHdg: hdg || 0 };
    const r = M.takeoff(p);
    if (r.error) { out.innerHTML = `<p class="bad">${esc(r.error)}</p>`; return; }
    const bad = !r.fits;
    if (!bad) { window.PerfLast = { v1: r.v1, vr: r.vr, v2: r.v2, flex: r.flex, conf: p.conf, rwy: ($('#tRwy').value || '').trim().toUpperCase(), icao: ($('#tIcao').value || '').trim().toUpperCase(), t: Date.now() }; store.set('perfLast', window.PerfLast); }
    const pct = Math.min(100, (r.req / p.tora) * 100);
    out.innerHTML = `
      ${bad ? `<p class="bad strong">Zu schwer für diese Piste – höchstens ${kg(r.maxTow)}.</p>` : ''}
      <div class="maxw ${bad ? 'bad' : ''}"><small>Höchstgewicht Piste</small><b>${kg(r.maxTow)}</b><span>${bad ? 'Du bist ' + kg(p.tow - r.maxTow) + ' darüber' : 'Reserve ' + kg(r.maxTow - p.tow)} · ${r.limitedBy}</span></div>
      <div class="speeds ${bad ? 'dim' : ''}"><div><small>V1</small>${r.v1}</div><div><small>VR</small>${r.vr}</div><div><small>V2</small>${r.v2}</div>
        <div class="thr"><small>Schub</small>${bad ? '–' : r.flex ? `${M.FAMILIES[M.TYPES[type].fam].atm} ${r.flex}°` : 'TOGA'}</div></div>
      <div class="ldg-row ${bad ? 'bad' : 'ok'}"><span>Nötige Strecke</span><span>${fmt(Math.round(r.req))} m</span><div class="ldg-bar"><div style="width:${pct}%"></div></div></div>
      <dl class="kv">
        <dt>Verfügbar</dt><dd>${fmt(p.tora)} m · Reserve ${fmt(Math.max(0, Math.round(p.tora - r.req)))} m</dd>
        <dt>Mit voller Leistung</dt><dd>${fmt(Math.round(r.reqToga))} m</dd>
        <dt>Höchstgewicht Piste</dt><dd>${kg(r.maxTow)} <small>(${r.limitedBy})</small></dd>
        <dt>Wind</dt><dd>${hdg === null ? 'Pistenkurs fehlt' : `${r.head >= 0 ? 'Gegen' : 'Rücken'}wind ${fmt(Math.abs(r.head))} kt · Seitenwind ${fmt(Math.abs(r.cross))} kt`}</dd>
        <dt>Druckhöhe</dt><dd>${fmt(Math.round(r.pa))} ft · ISA ${r.isaDev >= 0 ? '+' : ''}${fmt(r.isaDev)}</dd>
      </dl>
      ${r.warnings.map((w) => `<p class="bad">${esc(wtxt(w))}</p>`).join('')}${rwyHint('t').warn ? `<p class="note">${esc(rwyHint('t').warn)}</p>` : ''}${tlrTable('takeoff')}`;
  }

  function calcLanding() {
    const out = $('#lOut');
    const need = ['#lLda', '#lOat', '#lQnh', '#lLw'].filter((s) => v(s) === null);
    if (need.length) { out.innerHTML = '<p class="empty">Länge, Temperatur, QNH und Gewicht eintragen.</p>'; return; }
    const hdg = M.rwyHeading($('#lRwy').value);
    const p = { type, conf: $('#lConf').value, cond: $('#lCond').value, lw: WU.toKg(v('#lLw')), lda: v('#lLda'), elev: v('#lElev') || 0, qnh: v('#lQnh'), oat: v('#lOat'),
      windDir: v('#lWdir') || 0, windSpd: hdg === null ? 0 : v('#lWspd') || 0, gust: hdg === null ? 0 : v('#lGust') || 0, rwyHdg: hdg || 0 };
    const r = M.landing(p);
    if (r.error) { out.innerHTML = `<p class="bad">${esc(r.error)}</p>`; return; }
    const names = { lo: 'Autobrake LO', med: 'Autobrake MED', max: 'Autobrake MAX' };
    const rows = ['lo', 'med', 'max'].map((k) => {
      const ok = r.dist[k] <= p.lda;
      return `<div class="ldg-row ${ok ? 'ok' : 'bad'} ${r.rec === k ? 'rec' : ''}"><span>${names[k]}${r.rec === k ? ' ◂' : ''}</span><span>${fmt(Math.round(r.dist[k]))} m</span><div class="ldg-bar"><div style="width:${Math.min(100, (r.dist[k] / p.lda) * 100)}%"></div></div></div>`;
    }).join('');
    out.innerHTML = `
      <div class="maxw"><small>Höchstgewicht Piste</small><b>${kg(r.maxLw)}</b><span>Reserve ${kg(r.maxLw - p.lw)} · mit Autobrake MED</span></div>
      <div class="speeds"><div><small>VLS</small>${r.vls}</div><div><small>+ Wind</small>${r.add}</div><div><small>VAPP</small>${r.vapp}</div>
        <div class="thr"><small>Empfehlung</small>${r.rec ? r.rec.toUpperCase() : '–'}</div></div>
      ${rows}
      <dl class="kv">
        <dt>Verfügbar</dt><dd>${fmt(p.lda)} m</dd>
        <dt>Höchstgewicht Piste</dt><dd>${kg(r.maxLw)} <small>(mit Autobrake MED)</small></dd>
        <dt>Wind</dt><dd>${hdg === null ? 'Pistenkurs fehlt' : `${r.head >= 0 ? 'Gegen' : 'Rücken'}wind ${fmt(Math.abs(r.head))} kt · Seitenwind ${fmt(Math.abs(r.cross))} kt`}</dd>
      </dl>
      ${r.warnings.map((w) => `<p class="bad">${esc(wtxt(w))}</p>`).join('')}${rwyHint('l').warn ? `<p class="note">${esc(rwyHint('l').warn)}</p>` : ''}${tlrTable('landing')}`;
  }

  function calc() { if (!built) return; calcTakeoff(); calcLanding(); }

  // Flughafen eingegeben → Elevation und längste Piste vorbelegen (nur, solange nichts von Hand drinsteht)
  function fillAirport(pre) {
    const { a } = rwyHint(pre);
    if (!a) return;
    const len = $('#' + pre + (pre === 't' ? 'Tora' : 'Lda')), el = $('#' + pre + 'Elev');
    if (!len.value || len.dataset.auto) set('#' + pre + (pre === 't' ? 'Tora' : 'Lda'), a.rwy, true);
    if (!el.value || el.dataset.auto) set('#' + pre + 'Elev', a.elev, true);
  }

  function fillWx(pre, metar) {
    const m = M.parseMetar(metar);
    if (m.oat !== undefined) set('#' + pre + 'Oat', m.oat);
    if (m.qnh !== undefined) set('#' + pre + 'Qnh', m.qnh);
    if (m.windDir !== undefined) set('#' + pre + 'Wdir', m.windDir);
    if (m.windSpd !== undefined) set('#' + pre + 'Wspd', m.windSpd);
    if (pre === 'l') set('#lGust', m.gust || '');
  }

  // SimBrief nennt Pistenlängen im OFP meist in Fuß. Einheit aus dem OFP oder per Vergleich mit der Flughafenliste bestimmen.
  function runwayMeters(raw, icao, units) {
    const x = num(raw);
    if (!x) return null;
    const u = String(units || '').toLowerCase();
    if (/^(ft|feet|foot)/.test(u)) return Math.round(x * 0.3048);
    if (/^m/.test(u)) return Math.round(x);
    const a = airport(icao);
    if (a) return Math.abs(x * 0.3048 - a.rwy) < Math.abs(x - a.rwy) ? Math.round(x * 0.3048) : Math.round(x);
    return x > 5000 ? Math.round(x * 0.3048) : Math.round(x);
  }

  function fromOfp() {
    const o = app.ofp;
    if (!o) { $('#calcHead .note').textContent = 'Es ist noch kein OFP geladen.'; return; }
    build();
    const t = M.TYPES[String((o.aircraft && o.aircraft.icaocode) || '').toUpperCase()] ? String(o.aircraft.icaocode).toUpperCase() : guessType();
    type = t; store.set('perfType', t); $('#pType').value = t; refreshFlaps();
    const tlr = o.tlr || {};
    const pick = (part) => {
      const d = tlr[part]; if (!d) return null;
      const rw = asArray(d.runway);
      return rw.find((x) => x.identifier === (d.conditions && d.conditions.planned_runway)) || rw[0] || null;
    };
    // Takeoff
    const or = o.origin || {}, tr = pick('takeoff');
    set('#tIcao', or.icao_code || ''); set('#tRwy', (tr && tr.identifier) || or.plan_rwy || '');
    set('#tTora', '', true); set('#tElev', '', true); fillAirport('t');
    { const m = tr && runwayMeters(tr.length, or.icao_code, tr.length_units || (tlr.takeoff && tlr.takeoff.units) || (tlr.takeoff && tlr.takeoff.conditions && tlr.takeoff.conditions.length_units)); if (m) set('#tTora', m); }
    if (tr && ['1+F', '2', '3'].includes(String(tr.flap_setting)) && type.startsWith('A')) $('#tConf').value = String(tr.flap_setting);
    set('#tTow', o.weights && Math.round(WU.fromKg(WU.ofpKg(o.weights.est_tow, o))));
    fillWx('t', o.weather && o.weather.orig_metar);
    // Landung
    const de = o.destination || {}, lr = pick('landing');
    set('#lIcao', de.icao_code || ''); set('#lRwy', (lr && lr.identifier) || de.plan_rwy || '');
    set('#lLda', '', true); set('#lElev', '', true); fillAirport('l');
    { const m = lr && runwayMeters(lr.length, de.icao_code, lr.length_units || (tlr.landing && tlr.landing.units) || (tlr.landing && tlr.landing.conditions && tlr.landing.conditions.length_units)); if (m) set('#lLda', m); }
    set('#lLw', o.weights && Math.round(WU.fromKg(WU.ofpKg(o.weights.est_ldw, o))));
    fillWx('l', o.weather && o.weather.dest_metar);
    calc();
    $('#calcHead .note').textContent = `Übernommen: ${or.icao_code || '?'} → ${de.icao_code || '?'}. Temperatur, QNH und Wind stammen aus dem METAR im OFP – bitte kurz prüfen.`;
  }

  // Für den Flight Finder: Strecke direkt in die Rechner übernehmen
  function setRoute(dep, arr) {
    build();
    set('#tIcao', dep); set('#lIcao', arr);
    set('#tTora', '', true); set('#tElev', '', true); set('#lLda', '', true); set('#lElev', '', true);
    fillAirport('t'); fillAirport('l'); calc();
  }

  document.addEventListener('input', (e) => {
    const id = e.target.id;
    if (!id) return;
    if (e.target.dataset && e.target.dataset.auto && /^[tl](Tora|Lda|Elev)$/.test(id)) delete e.target.dataset.auto;
    if (id === 'tIcao' || id === 'lIcao') { e.target.value = e.target.value.toUpperCase(); fillAirport(id[0]); }
    if ($('#calcTo').contains(e.target) || $('#calcLdg').contains(e.target)) calc();
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'pType') { type = e.target.value; store.set('perfType', type); refreshFlaps(); calc(); }
    else if ($('#calcTo').contains(e.target) || $('#calcLdg').contains(e.target)) calc();
  });
  document.addEventListener('click', (e) => { if (e.target.closest('#pFromOfp')) fromOfp(); });

  hooks.tab.push((n) => { if (n === 'perf') build(); });
  hooks.ofp.push(() => { if (built && !$('#tTow').value) fromOfp(); });
  hooks.profile.push(() => { if (built && !store.get('perfType', null)) { type = guessType(); $('#pType').value = type; refreshFlaps(); calc(); } });
  return { setRoute, fromOfp };
})();
