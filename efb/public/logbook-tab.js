// Logbuch-Tab: Flüge ansehen, filtern, sortieren, bewerten und löschen
'use strict';

const LogbookTab = (() => {
  let data = { entries: [], active: null, size: 0 }, timer = null, open = null, selMode = false, sel = new Set(), adding = false;
  let view = null;   // { filter, sort, type } – lokale Änderungen, bis Setup sie überschreibt
  const L = () => (Settings.get() ? Settings.get().logbook : { filter: 'airline', sort: 'date', type: '' });
  const V = () => view || (view = { ...L() });
  const pad = (n) => String(n).padStart(2, '0');
  const hm = (ms) => { if (!ms) return '–'; const d = new Date(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}z`; };
  const day = (ms) => { const d = new Date(ms); return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${String(d.getUTCFullYear()).slice(2)}`; };
  const dur = (min) => { if (min == null || !isFinite(min) || min < 0) return '–'; const m = Math.round(min); return `${Math.floor(m / 60)}:${pad(m % 60)} h`; };
  const mins = (a, b) => (a && b ? (b - a) / 60000 : null);
  const kg = (v) => (v == null ? '–' : WU.show(v));
  const block = (e) => mins(e.t.off, e.t.on);
  const airMin = (e) => mins(e.t.to, e.t.ldg);
  const airlineOf = (e) => Settings.airlines().find((a) => a.id === e.airline);

  async function load() {
    try { data = await fetch('/api/logbook', { cache: 'no-store' }).then((r) => r.json()); } catch { /* alte Daten behalten */ }
    if (app.tab === 'logbook') render();
  }
  async function post(path, body) {
    const r = await fetch('/api/logbook/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    if (!r || !r.ok) { Settings.toast('Aktion fehlgeschlagen', true); return null; }
    return r.json();
  }

  // ---------- Daten aufbereiten ----------
  function list() {
    const v = V(), cur = Settings.current();
    let l = data.entries.slice();
    if (v.filter === 'airline' && cur) l = l.filter((e) => e.airline === cur.id);
    if (v.type) l = l.filter((e) => (e.type || '–') === v.type);
    const by = {
      date: (a, b) => b.t.off - a.t.off,
      time: (a, b) => (block(b) || 0) - (block(a) || 0),
      airline: (a, b) => (a.airlineName || '~').localeCompare(b.airlineName || '~') || b.t.off - a.t.off,
      type: (a, b) => (a.type || '~').localeCompare(b.type || '~') || b.t.off - a.t.off,
    };
    return l.sort(by[v.sort] || by.date);
  }
  const groupKey = (e, sort) => (sort === 'type' ? e.type || 'Ohne Typ' : sort === 'airline' ? e.airlineName || 'Ohne Airline' : '');

  // ---------- Darstellung ----------
  function stats(l) {
    const blk = l.reduce((s, e) => s + (block(e) || 0), 0), air = l.reduce((s, e) => s + (airMin(e) || 0), 0), nm = l.reduce((s, e) => s + (e.dist || 0), 0);
    const td = l.map((e) => e.tdVs).filter((x) => x != null && x < 0);
    const soft = td.length ? Math.round(td.reduce((s, x) => s + x, 0) / td.length) : null;
    const items = [['Flüge', l.length], ['Blockzeit', dur(blk)], ['Flugzeit', dur(air)], ['Strecke', `${fmt(nm)} NM`]];
    if (soft != null) items.push(['Ø Landerate', `${soft} ft/min`]);
    return `<div class="lb-stats">${items.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>`;
  }

  function row(e) {
    const al = airlineOf(e), isOpen = open === e.id, b = block(e);
    return `<div class="lb-item ${isOpen ? 'open' : ''}" data-id="${esc(e.id)}">
      <button class="lb-row" data-act="toggle">
        ${selMode ? `<span class="lb-chk ${sel.has(e.id) ? 'on' : ''}"></span>` : ''}
        <span class="lb-date">${day(e.t.off)}<small>${hm(e.t.off)}</small></span>
        <span class="lb-cs">${esc(e.callsign || e.title || '–')}${e.airlineName ? `<small><i class="al-dot" style="background:${esc(al ? al.accent : '#8b98a5')}"></i>${esc(e.airlineName)}</small>` : ''}</span>
        <span class="lb-rt"><b>${esc(e.dep || '????')}</b><span class="lb-arrow">→</span><b>${esc(e.arr || '????')}</b>${e.partial ? '<small>Teilaufzeichnung</small>' : ''}</span>
        <span class="lb-ty">${esc(e.type || '–')}<small>${esc(e.reg || '')}</small></span>
        <span class="lb-bt">${dur(b)}<small>${e.dist ? fmt(e.dist) + ' NM' : ''}</small></span>
        <span class="lb-star">${e.rating ? '★'.repeat(e.rating) : ''}</span>
      </button>
      ${isOpen ? detail(e) : ''}
    </div>`;
  }

  function detail(e) {
    const t = e.t, burn = e.fuelStart != null && e.fuelEnd != null ? e.fuelStart - e.fuelEnd : null;
    const cell = (k, v) => `<div><small>${k}</small><b>${v}</b></div>`;
    const rng = (a, b) => (a ? `${hm(a)}${b ? ` – ${hm(b)}` : ''}` : '–');
    return `<div class="lb-detail">
      <div class="lb-grid">
        ${cell('Boarding', t.board0 ? `${rng(t.board0, t.board1)} (${dur(mins(t.board0, t.board1))})` : '–')}
        ${cell('Betankung', t.fuel0 ? `${rng(t.fuel0, t.fuel1)} (${dur(mins(t.fuel0, t.fuel1))})` : '–')}
        ${cell('Off-Block', hm(t.off))}${cell('Start', hm(t.to))}${cell('Landung', hm(t.ldg))}${cell('On-Block', hm(t.on))}
        ${cell('Deboarding', t.deb0 ? `${rng(t.deb0, t.deb1)} (${dur(mins(t.deb0, t.deb1))})` : '–')}
        ${cell('Blockzeit', dur(block(e)))}${cell('Flugzeit', dur(airMin(e)))}
        ${cell('Geplant (Block)', e.planBlock ? dur(e.planBlock) : '–')}
        ${cell('Strecke', e.dist ? `${fmt(e.dist)} NM${e.planNm ? ` (Plan ${fmt(e.planNm)})` : ''}` : '–')}
        ${cell('Max. Höhe', e.maxAlt ? `${fmt(e.maxAlt)} ft` : '–')}
        ${cell('Passagiere', e.pax ? fmt(e.pax) : '–')}
        ${cell('Sprit beim Start', kg(e.fuelStart))}${cell('Verbrauch', burn != null ? kg(burn) : '–')}
        ${cell('Startgewicht', kg(e.tow))}${cell('Landegewicht', kg(e.ldw))}
        ${cell('Landerate', e.tdVs != null ? `${e.tdVs} ft/min` : '–')}${cell('Alternate', esc(e.alt || '–'))}
        ${e.touchGo ? cell('Touch and Go', e.touchGo) : ''}
      </div>
      ${e.route ? `<p class="lb-route"><small>Route</small>${esc(e.route)}</p>` : ''}
      ${e.metarDep || e.metarArr ? `<p class="lb-route"><small>METAR</small>${esc(e.metarDep)}${e.metarDep && e.metarArr ? '<br>' : ''}${esc(e.metarArr)}</p>` : ''}
      <div class="lb-edit">
        <div class="stars" data-stars>${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" class="${n <= e.rating ? 'on' : ''}" aria-label="${n} Sterne">★</button>`).join('')}</div>
        <textarea data-notes rows="2" maxlength="1000" placeholder="Notiz zum Flug (Wetter, Besonderheiten, Verspätung …)">${esc(e.notes)}</textarea>
        <div class="actions"><button class="btn-s" data-act="del">Eintrag löschen</button></div>
      </div>
    </div>`;
  }

  function addForm() {
    const cur = Settings.current(), today = new Date().toISOString().slice(0, 10);
    return `<div class="panel lb-add">
      <h3>Flug von Hand eintragen</h3>
      <div class="lb-addgrid">
        <label>Datum<input type="date" id="laDate" value="${today}"></label>
        <label>Flugnummer<input id="laCs" maxlength="12" autocapitalize="characters"></label>
        <label>Von<input id="laDep" maxlength="4" autocapitalize="characters" placeholder="EDDF"></label>
        <label>Nach<input id="laArr" maxlength="4" autocapitalize="characters" placeholder="KJFK"></label>
        <label>Typ<input id="laType" maxlength="4" autocapitalize="characters" placeholder="A20N"></label>
        <label>Kennzeichen<input id="laReg" maxlength="10" autocapitalize="characters"></label>
        <label>Blockzeit (Min.)<input id="laBlk" type="number" min="1" max="1500"></label>
        <label>Strecke (NM)<input id="laDist" type="number" min="0"></label>
        <label>Airline<select id="laAl"><option value="">Keine</option>${Settings.airlines().map((a) => `<option value="${esc(a.id)}" ${cur && cur.id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      </div>
      <div class="actions"><button class="btn-s" data-act="addOk">Eintragen</button><button class="btn-s" data-act="addNo">Abbrechen</button></div>
    </div>`;
  }

  function render() {
    const body = $('#logBody'); if (!body) return;
    const keepScroll = body.scrollTop, v = V(), cur = Settings.current(), l = list();
    const types = [...new Set(data.entries.map((e) => e.type || '–'))].sort();
    const act = data.active;
    const phase = { taxi: 'Rollt', ground: 'Am Boden', air: 'In der Luft', landed: 'Gelandet' };
    let html = `<div class="lb-head"><h2>Logbuch</h2>
      ${act ? `<span class="lb-live"><i></i>Aufzeichnung läuft: ${esc(act.callsign || '')} ${esc(act.dep || '????')} → ${esc(act.arr || '????')} · ${phase[act.phase] || ''}</span>` : '<span class="dim-t">Flüge werden automatisch aufgezeichnet.</span>'}
    </div>
    <div class="lb-bar">
      <div class="seg">
        <button data-flt="airline" class="${v.filter === 'airline' ? 'on' : ''}" ${cur ? '' : 'disabled'}>${cur ? esc(cur.short || cur.name) : 'Airline'}</button>
        <button data-flt="all" class="${v.filter === 'all' || !cur ? 'on' : ''}">Alle</button>
      </div>
      <label class="lb-sort">Sortieren<select id="lbSortSel">${[['date', 'Datum'], ['type', 'Flugzeugtyp'], ['time', 'Blockzeit'], ['airline', 'Airline']].map(([k, t]) => `<option value="${k}" ${v.sort === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="lb-sort">Typ<select id="lbTypeSel"><option value="">Alle Typen</option>${types.map((t) => `<option ${v.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <span class="lb-gap"></span>
      <button class="btn-s ${selMode ? 'on' : ''}" data-act="selmode">${selMode ? 'Fertig' : 'Auswählen'}</button>
      <button class="btn-s" data-act="add">Hinzufügen</button>
    </div>`;
    if (selMode) html += `<div class="lb-selbar"><button class="btn-s" data-act="selall">Alle in der Liste</button><button class="btn-s" data-act="seldel" ${sel.size ? '' : 'disabled'}>${sel.size} löschen</button></div>`;
    if (adding) html += addForm();
    html += stats(l);

    if (!l.length) {
      html += `<p class="empty">${data.entries.length ? 'Keine Flüge für diese Auswahl. Wechsle oben auf „Alle“.' : 'Noch keine Flüge. Sobald du abhebst und wieder parkst, erscheint der Flug hier automatisch.'}</p>`;
    } else {
      let last = null;
      for (const e of l) {
        const g = groupKey(e, v.sort);
        if (g && g !== last) {
          const grp = l.filter((x) => groupKey(x, v.sort) === g);
          html += `<div class="lb-group"><b>${esc(g)}</b><span>${grp.length} ${grp.length === 1 ? 'Flug' : 'Flüge'} · ${dur(grp.reduce((s, x) => s + (block(x) || 0), 0))}</span></div>`;
          last = g;
        }
        html += row(e);
      }
    }
    body.innerHTML = html;
    body.scrollTop = keepScroll;
  }

  // ---------- Bedienung ----------
  function bind() {
    const body = $('#logBody');
    body.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button'); if (!t) return;
      const item = t.closest('.lb-item'), id = item ? item.dataset.id : null;
      if (t.dataset.flt) { V().filter = t.dataset.flt; render(); return; }
      if (t.dataset.star && id) {
        const e = data.entries.find((x) => x.id === id), n = +t.dataset.star;
        e.rating = e.rating === n ? 0 : n; render(); post('update', { id, patch: { rating: e.rating } }); return;
      }
      switch (t.dataset.act) {
        case 'toggle':
          if (selMode) { sel.has(id) ? sel.delete(id) : sel.add(id); } else open = open === id ? null : id;
          render(); break;
        case 'del':
          if (t.dataset.armed) { await post('delete', { ids: [id] }); open = null; Settings.toast('Eintrag gelöscht'); load(); }
          else { t.dataset.armed = '1'; t.textContent = 'Sicher? Nochmal tippen'; t.classList.add('danger'); setTimeout(() => { if (t.isConnected) { delete t.dataset.armed; t.textContent = 'Eintrag löschen'; t.classList.remove('danger'); } }, 4000); }
          break;
        case 'selmode': selMode = !selMode; sel.clear(); render(); break;
        case 'selall': list().forEach((e) => sel.add(e.id)); render(); break;
        case 'seldel':
          if (t.dataset.armed) { const n = sel.size; await post('delete', { ids: [...sel] }); sel.clear(); selMode = false; Settings.toast(`${n} ${n === 1 ? 'Eintrag' : 'Einträge'} gelöscht`); load(); }
          else { t.dataset.armed = '1'; t.textContent = `Wirklich ${sel.size} löschen?`; t.classList.add('danger'); setTimeout(() => { if (t.isConnected) render(); }, 4000); }
          break;
        case 'add': adding = !adding; render(); break;
        case 'addNo': adding = false; render(); break;
        case 'addOk': {
          const v = (s) => $(s).value.trim();
          const al = Settings.airlines().find((a) => a.id === $('#laAl').value);
          const dep = v('#laDep'), arr = v('#laArr'), blk = +v('#laBlk');
          if (!dep || !arr || !blk) { Settings.toast('Von, Nach und Blockzeit werden gebraucht', true); return; }
          const off = Date.parse(v('#laDate') + 'T12:00:00Z') || Date.now();
          const r = await post('add', { t: { off }, blockMin: blk, dep, arr, callsign: v('#laCs'), type: v('#laType'), reg: v('#laReg'), dist: +v('#laDist') || 0, airline: al ? al.id : '', airlineName: al ? al.name : '' });
          if (r) { adding = false; Settings.toast('Flug eingetragen'); load(); }
          break;
        }
        default:
      }
    });
    body.addEventListener('change', (ev) => {
      const el = ev.target;
      if (el.id === 'lbSortSel') { V().sort = el.value; render(); }
      if (el.id === 'lbTypeSel') { V().type = el.value; render(); }
    });
    // Notizen speichern, wenn das Feld verlassen wird
    body.addEventListener('focusout', (ev) => {
      const el = ev.target; if (!el.matches || !el.matches('[data-notes]')) return;
      const id = el.closest('.lb-item').dataset.id, e = data.entries.find((x) => x.id === id);
      if (e && e.notes !== el.value) { e.notes = el.value; post('update', { id, patch: { notes: el.value } }); }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    Settings.onChange(() => { if (app.tab === 'logbook' && !document.activeElement.matches('textarea,input,select')) render(); });
    hooks.tab.push((name) => {
      clearInterval(timer);
      if (name === 'logbook') { view = { ...L() }; open = null; selMode = false; sel.clear(); adding = false; render(); load(); timer = setInterval(() => { if (!document.activeElement.matches('textarea,input,select')) load(); }, 15000); }
    });
  });
  WU.on(() => { if (typeof render === 'function' && app.tab === 'logbook') render(); });
  return { load };
})();
