// Wetter-Tab: aktuelles METAR, VATSIM-ATIS oder nur die Werte – für Abflug, Ziel, Ausweichflughafen und die aktuelle Position.
'use strict';

const WxTab = (() => {
  let data = null, busy = false, err = '', lastKey = '';
  let mode = store.get('wxMode', 'metar');
  const MODES = [['metar', 'METAR'], ['atis', 'ATIS'], ['vals', 'Werte']];

  const icaos = () => {
    const o = app.ofp; if (!o) return [];
    return [['DEP', o.origin], ['ARR', o.destination], ['ALT', o.alternate]]
      .filter(([, a]) => a && /^[A-Z0-9]{4}$/i.test(a.icao_code || '')).map(([role, a]) => ({ role, icao: a.icao_code.toUpperCase(), name: a.name || '' }));
  };
  const here = () => { const s = app.sim; return s && s.connected && s.lat != null && s.lat !== 0 ? { lat: s.lat, lon: s.lon } : null; };

  async function poll(force) {
    if (busy) return;
    const list = icaos(), h = here();
    if (!list.length && !h) { data = null; render(); return; }
    if (!force && data && Date.now() - data.fetched < 55000 && lastKey === list.map((x) => x.icao).join()) return;
    busy = true;
    try {
      const q = new URLSearchParams({ icao: list.map((x) => x.icao).join(',') });
      if (h) { q.set('lat', h.lat.toFixed(3)); q.set('lon', h.lon.toFixed(3)); }
      data = await fetch('/api/metar?' + q, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      data.fetched = Date.now(); lastKey = list.map((x) => x.icao).join(); err = data.error || '';
    } catch (e) { err = e.message || String(e); }
    busy = false;
    fillFlight(); if (app.tab === 'wx') render();
  }

  const ago = (ms) => { if (!ms) return ''; const m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'gerade eben' : m < 90 ? `vor ${m} min` : `vor ${Math.round(m / 60)} h`; };
  const pad3 = (n) => String(Math.round(n) % 360 || 360).padStart(3, '0');
  const wind = (m) => (m.wspd === 0 ? 'Windstill' : `${m.wdir === 'VRB' ? 'VRB' : pad3(m.wdir) + '°'} / ${m.wspd} kt${m.wgst ? ' (Böen ' + m.wgst + ')' : ''}`);
  const cloudTxt = (m) => (m.clouds.length ? m.clouds.map((c) => `${c.cover}${c.base != null ? ' ' + fmt(c.base) + ' ft' : ''}`).join(', ') : 'Keine Wolken gemeldet');

  function body(item, mode) {
    const st = data.stations[item.icao] || {}, m = item.here || st.metar, at = st.atis || [];
    const stale = m && m.time && Date.now() - m.time > 75 * 60000;
    const age = m ? `<span class="wx-age${stale ? ' old' : ''}">${ago(m.time)}</span>` : '';
    let main = '';
    if (mode === 'atis' && !item.here) {
      if (at.length) {
        main = at.map((a) => `<div class="wx-atis"><b>${esc(a.cs)}</b> · ${esc(a.freq || '')}${a.code ? ' · Information ' + esc(a.code) : ''}<p>${esc(a.text || 'Kein Text.')}</p></div>`).join('');
      } else main = `<p class="wx-note">Keine ATIS auf VATSIM online.${m ? ' Stattdessen das METAR:' : ''}</p>${m ? `<p class="wx-raw">${esc(m.raw)}</p>` : ''}`;
    } else if (!m) main = '<p class="wx-note">Kein METAR verfügbar.</p>';
    else if (mode === 'vals' || (mode === 'atis' && item.here)) {
      const rows = [['Wind', wind(m)], ['Sicht', m.vis != null ? m.vis + ' SM' : '–'], ['Wolken', cloudTxt(m)], ['Temp / Taupunkt', m.temp != null ? `${m.temp} / ${m.dew != null ? m.dew : '–'} °C` : '–'], ['QNH', m.qnh != null ? `${Math.round(m.qnh)} hPa` : '–']];
      main = `<dl class="kv wx-kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
    } else main = `<p class="wx-raw">${esc(m.raw)}</p>`;
    return { main, age, cat: m && m.cat };
  }

  function card(item) {
    const b = body(item, mode);
    const title = item.here ? `Aktueller Standort · ${esc(item.here.icao)} (${item.here.distNm} NM)` : `<b>${item.role}</b> ${esc(item.icao)}`;
    return `<div class="panel wx-card"><h3>${title}${b.cat ? `<span class="wx-cat ${esc(b.cat)}">${esc(b.cat)}</span>` : ''}${b.age}</h3>${b.main}</div>`;
  }

  function render() {
    const root = $('#wxBody'); if (!root) return;
    const list = icaos();
    const bar = `<div class="wx-bar"><div class="seg" role="tablist">${MODES.map(([k, t]) => `<button class="${mode === k ? 'on' : ''}" data-wxm="${k}">${t}</button>`).join('')}</div>
      <span class="wx-upd">${data ? 'Aktualisiert ' + ago(data.fetched) : ''}${err ? ' · <span class="bad-t">Fehler: ' + esc(err) + '</span>' : ''}</span>
      <button class="btn" id="wxRefresh">${busy ? 'Lädt …' : 'Aktualisieren'}</button></div>`;
    let cards = '';
    if (!list.length && !here()) cards = '<p class="empty">Noch kein Flugplan. Lade den OFP, dann erscheinen hier Abflug, Ziel und Ausweichflughafen. Mit laufendem Sim kommt auch dein Standort dazu.</p>';
    else if (!data) cards = '<p class="empty">Lade Wetter …</p>';
    else {
      cards = list.map(card).join('');
      if (data.here) cards += card({ here: data.here, icao: data.here.icao });
      else if (here()) cards += '<div class="panel wx-card"><h3>Aktueller Standort</h3><p class="wx-note">Keine Wetterstation in der Nähe.</p></div>';
    }
    root.innerHTML = bar + `<div class="wx-grid">${cards}</div>`;
  }

  // Wetter-Kasten auf der Flug-Seite mit den frischen METARs füllen
  function fillFlight() {
    const box = $('#wxBox'); if (!box || !data || !app.ofp) return;
    const html = icaos().map((x) => { const m = (data.stations[x.icao] || {}).metar; return m ? `<p><b>${x.role} ${esc(x.icao)}</b>${esc(m.raw)} <span class="wx-age">${ago(m.time)}</span></p>` : ''; }).join('');
    if (html) box.innerHTML = html;
  }

  document.addEventListener('click', (e) => {
    const m = e.target.closest('[data-wxm]');
    if (m) { mode = m.dataset.wxm; store.set('wxMode', mode); render(); }
    else if (e.target.closest('#wxRefresh')) { poll(true); render(); }
  });
  hooks.ofp.push(() => { poll(true); });
  hooks.tab.push((t) => { if (t === 'wx') { render(); poll(false); } if (t === 'flight') poll(false); });
  setInterval(() => { if (document.hidden) return; if (app.tab === 'wx' || app.tab === 'flight') poll(false); if (app.tab === 'wx' && data) render(); }, 30000);
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => poll(true), 1500));
  return { poll, render };
})();
