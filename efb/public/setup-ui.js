// Setup-Seite: Airlines, Design, Tabs, Presets, Logbuch-Verwaltung
'use strict';

const SetupUi = (() => {
  let sec = store.get('setSec', 'airlines');
  let logInfo = null;
  const S = () => Settings.get();
  const THEME_PREV = {
    cockpit: ['#0b1016', '#17212b', '#38c8f5', '#e8edf2'],
    glass: ['linear-gradient(135deg,#3b5bff,#ff5ac8 60%,#00c8ff)', 'rgba(255,255,255,.28)', '#7ad7ff', '#fff'],
    day: ['#dde5ec', '#ffffff', '#0b73a0', '#142230'],
    night: ['#070000', '#170404', '#ff5d4d', '#e7a9a1'],
    contrast: ['#000', '#0d0d0d', '#ffe14d', '#fff'],
  };
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  const sw = (id, on, label, hint) => `<label class="sw-row"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><span class="sw"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i></span></label>`;

  // Zweistufiges Löschen: erst „Sicher?“, dann ausführen
  function confirmTap(btn, fn) {
    if (btn.dataset.armed) { clearTimeout(btn._t); delete btn.dataset.armed; btn.textContent = btn.dataset.label; fn(); return; }
    btn.dataset.label = btn.textContent; btn.dataset.armed = '1'; btn.textContent = 'Sicher? Nochmal tippen'; btn.classList.add('danger');
    btn._t = setTimeout(() => { delete btn.dataset.armed; btn.textContent = btn.dataset.label; btn.classList.remove('danger'); }, 4000);
  }

  // ---------- Airlines ----------
  function renderAirlines() {
    const s = S(); if (!s) return;
    const cards = s.airlines.map((a) => `
      <div class="al-card ${a.id === s.activeAirline ? 'on' : ''}" data-id="${esc(a.id)}">
        <div class="al-top">
          <span class="al-dot" style="background:${esc(a.accent)}"></span><b>${esc(a.name)}</b>
          ${a.id === s.activeAirline ? '<span class="tag">Aktiv</span>' : `<button class="btn-s" data-al="use">Wählen</button>`}
          <button class="btn-s al-del" data-al="del">Löschen</button>
        </div>
        <div class="al-fields">
          <label>Name<input data-f="name" value="${esc(a.name)}" maxlength="40"></label>
          <label>Kürzel<input data-f="short" value="${esc(a.short)}" maxlength="12" autocapitalize="characters"></label>
          <label>ICAO-Code<input data-f="icao" value="${esc(a.icao)}" maxlength="3" autocapitalize="characters" placeholder="z. B. DLH"></label>
          <label>Hauptfarbe<input type="color" data-f="accent" value="${esc(a.accent)}"></label>
          <label>Zweitfarbe<input type="color" data-f="accent2" value="${esc(a.accent2)}"></label>
          <label>Design<select data-f="theme"><option value="">Standard (${esc(THEME_INFO[s.theme].name)})</option>${Object.keys(THEME_INFO).map((k) => `<option value="${k}" ${a.theme === k ? 'selected' : ''}>${esc(THEME_INFO[k].name)}</option>`).join('')}</select></label>
        </div>
        <div class="al-bg">
          <div class="bg-thumb" style="${a.bg ? `background-image:url('/bg/${encodeURIComponent(a.bg)}')` : ''}">${a.bg ? '' : '<span>Kein Hintergrund</span>'}</div>
          <div class="al-bg-act">
            <button class="btn-s" data-al="bg">${a.bg ? 'Bild ändern' : 'Hintergrundbild wählen'}</button>
            ${a.bg ? '<button class="btn-s" data-al="nobg">Bild entfernen</button>' : ''}
            <input type="file" accept="image/*" hidden data-file="al">
          </div>
        </div>
      </div>`).join('');
    $('#sec-airlines').innerHTML = `
      <h2>Airlines</h2>
      <p class="note">Wähle, für welche Airline dein EFB fliegt. Jede Airline hat eine eigene Farbe, ein eigenes Hintergrundbild und ihre eigenen Logbuch-Einträge. Zum schnellen Wechseln tippst du auf das Airline-Feld oben in der Leiste.</p>
      ${cards || '<p class="empty">Noch keine Airline angelegt. Wähle unten eine Vorlage oder lege eine eigene an.</p>'}
      <div class="panel al-add">
        <h3>Airline hinzufügen</h3>
        <div class="row-gap">
          <select id="alTpl"><option value="">Vorlage wählen …</option>${AIRLINE_TEMPLATES.map((t, i) => `<option value="${i}">${esc(t.name)} (${t.icao})</option>`).join('')}</select>
          <button class="btn-s" data-al="addTpl">Vorlage hinzufügen</button>
          <button class="btn-s" data-al="addNew">Eigene Airline</button>
        </div>
        <p class="note">Vorlagen setzen nur Name, Code und Farben. Logos werden nicht mitgeliefert, ein eigenes Bild legst du als Hintergrund fest.</p>
      </div>
      <div class="panel">
        <h3>Automatik</h3>
        ${sw('alAuto', s.autoAirline, 'Airline aus dem Flugplan übernehmen', 'Passt der ICAO-Code im SimBrief-Flugplan zu einer deiner Airlines, wird sie gewählt.')}
        ${sw('alColor', s.useAirlineColor, 'Farbe der Airline verwenden', 'Gilt für Cockpit, Glas und Tageslicht.')}
      </div>`;
  }

  // ---------- Design ----------
  function renderDesign() {
    const s = S(); if (!s) return;
    const a = Settings.current();
    const cards = Object.keys(THEME_INFO).map((k) => {
      const p = THEME_PREV[k];
      return `<button class="th-card ${s.theme === k ? 'on' : ''}" data-theme="${k}">
        <span class="th-prev" style="background:${p[0]}"><i style="background:${p[1]};border-color:${p[2]}"></i><u style="background:${p[2]}"></u><em style="background:${p[3]}"></em></span>
        <b>${esc(THEME_INFO[k].name)}</b><small>${esc(THEME_INFO[k].desc)}</small></button>`;
    }).join('');
    $('#designDyn').innerHTML = `
      <h2>Design</h2>
      <div class="th-grid">${cards}</div>
      ${a && a.theme ? `<p class="note">Die Airline „${esc(a.name)}“ hat ein eigenes Design (${esc(THEME_INFO[a.theme].name)}). Es hat Vorrang vor dieser Auswahl.</p>` : ''}
      <div class="panel">
        <h3>Feinschliff</h3>
        <label class="rng">Deckkraft der Flächen bei Hintergrundbild und Glas <b id="opV">${s.screenOpacity} %</b>
          <input type="range" id="opRange" min="20" max="100" value="${s.screenOpacity}"></label>
        <label class="rng">Unschärfe bei Glas <b id="blV">${s.glassBlur} px</b>
          <input type="range" id="blRange" min="0" max="40" value="${s.glassBlur}"></label>
      </div>
      <div class="panel">
        <h3>Standard-Hintergrund</h3>
        <p class="note">Gilt für alle Airlines ohne eigenes Bild. Gut lesbar sind ruhige, eher dunkle Bilder. Große Bilder werden automatisch verkleinert.</p>
        <div class="al-bg">
          <div class="bg-thumb" style="${s.bgDefault ? `background-image:url('/bg/${encodeURIComponent(s.bgDefault)}')` : ''}">${s.bgDefault ? '' : '<span>Kein Hintergrund</span>'}</div>
          <div class="al-bg-act">
            <button class="btn-s" data-bg="pick">${s.bgDefault ? 'Bild ändern' : 'Bild wählen'}</button>
            ${s.bgDefault ? '<button class="btn-s" data-bg="clear">Entfernen</button>' : ''}
            <input type="file" accept="image/*" hidden data-file="def">
          </div>
        </div>
      </div>`;
  }

  // ---------- Tabs ----------
  function renderTabs() {
    const s = S(); if (!s) return;
    const { order, hidden } = s.tabs;
    $('#sec-tabs').innerHTML = `
      <h2>Tabs</h2>
      <p class="note">Blende Tabs aus, die du nicht brauchst, und lege die Reihenfolge fest. Setup bleibt immer sichtbar und steht am Ende.</p>
      <div class="tab-list">${order.map((t, i) => {
        const fixed = t === 'setup';
        return `<div class="tab-row ${hidden.includes(t) ? 'off' : ''}" data-t="${t}">
          <span class="tab-name">${esc(TAB_LABELS[t])}</span>
          <span class="tab-mv"><button class="btn-s" data-mv="-1" ${fixed || i === 0 ? 'disabled' : ''} aria-label="Nach oben">▲</button><button class="btn-s" data-mv="1" ${fixed || i >= order.length - 2 ? 'disabled' : ''} aria-label="Nach unten">▼</button></span>
          <label class="sw"><input type="checkbox" data-vis ${hidden.includes(t) ? '' : 'checked'} ${fixed ? 'disabled' : ''}><i></i></label></div>`;
      }).join('')}</div>
      <div class="actions"><button class="btn-s" id="tabAll">Alle einblenden</button><button class="btn-s" id="tabReset">Reihenfolge zurücksetzen</button></div>`;
  }

  // ---------- Presets ----------
  function renderPresets() {
    const s = S(); if (!s) return;
    const rows = s.presets.map((p) => {
      const al = s.airlines.find((a) => a.id === p.airline);
      const n = p.tabs.order.filter((t) => !p.tabs.hidden.includes(t)).length;
      return `<div class="pr-row" data-id="${esc(p.id)}"><div><b>${esc(p.name)}</b><small>${esc(p.theme ? THEME_INFO[p.theme].name : 'Design unverändert')} · ${al ? esc(al.name) : 'Airline unverändert'} · ${n} Tabs</small></div>
        <button class="btn-s" data-pr="load">Laden</button><button class="btn-s" data-pr="upd" title="Mit dem aktuellen Stand überschreiben">Aktualisieren</button><button class="btn-s" data-pr="del">Löschen</button></div>`;
    }).join('');
    $('#sec-presets').innerHTML = `
      <h2>Presets</h2>
      <p class="note">Ein Preset merkt sich Design, Airline und die sichtbaren Tabs. So wechselst du zum Beispiel mit einem Tipp zwischen „Langstrecke Lufthansa“ und „Online-ATC“.</p>
      ${rows || '<p class="empty">Noch keine Presets gespeichert.</p>'}
      <div class="panel">
        <h3>Aktuellen Stand speichern</h3>
        <div class="row-gap"><input id="prName" placeholder="Name, z. B. Langstrecke" maxlength="40"><button class="btn-s" id="prSave">Als Preset speichern</button></div>
      </div>
      <div class="panel">
        <h3>Beispiele</h3>
        <p class="note">Legt vier fertige Presets an, die du danach ändern oder löschen kannst: Alles, Nur Fliegen, Online (VATSIM) und Nachtflug.</p>
        <button class="btn-s" id="prDemo">Beispiel-Presets anlegen</button>
      </div>`;
  }

  // ---------- Logbuch ----------
  async function renderLogbook() {
    const s = S(); if (!s) return;
    try { logInfo = await fetch('/api/logbook', { cache: 'no-store' }).then((r) => r.json()); } catch { logInfo = null; }
    const n = logInfo ? logInfo.entries.length : 0, kb = logInfo ? Math.max(1, Math.round(logInfo.size / 1024)) : 0;
    $('#sec-logbook').innerHTML = `
      <h2>Logbuch</h2>
      <p class="note">Das Logbuch schreibt der PC mit, auch wenn das iPad aus ist. Aktuell ${n} ${n === 1 ? 'Eintrag' : 'Einträge'} (${kb} KB). Ein Eintrag braucht nur etwa 1 KB.</p>
      <div class="panel">
        <h3>Anzeige</h3>
        <div class="fld-row">
          <label class="field">Standard-Ansicht<select id="lbFilter"><option value="airline" ${s.logbook.filter === 'airline' ? 'selected' : ''}>Nur die gewählte Airline</option><option value="all" ${s.logbook.filter === 'all' ? 'selected' : ''}>Alle Einträge</option></select></label>
          <label class="field">Sortierung<select id="lbSort">${[['date', 'Datum'], ['type', 'Flugzeugtyp'], ['time', 'Blockzeit'], ['airline', 'Airline']].map(([v, l]) => `<option value="${v}" ${s.logbook.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">Höchstens speichern<input type="number" id="lbMax" min="20" max="5000" step="10" value="${s.logbook.max}"></label>
        </div>
        <p class="note">Ist die Höchstzahl erreicht, verschwinden die ältesten Einträge automatisch.</p>
      </div>
      <div class="panel">
        <h3>Aufräumen</h3>
        <div class="row-gap">
          <button class="btn-s" data-lb="30">Älter als 30 Tage löschen</button>
          <button class="btn-s" data-lb="90">Älter als 90 Tage löschen</button>
          <button class="btn-s" data-lb="365">Älter als 1 Jahr löschen</button>
          ${Settings.current() ? `<button class="btn-s" data-lb="air">Alle von „${esc(Settings.current().name)}“ löschen</button>` : ''}
          <button class="btn-s" data-lb="all">Gesamtes Logbuch löschen</button>
        </div>
        <p class="note">Einzelne Einträge löschst du direkt im Tab Logbuch. Vorher kannst du alles als CSV für Excel sichern.</p>
        <a class="btn-s" href="/api/logbook.csv" download="logbuch.csv">Als CSV exportieren</a>
      </div>`;
  }

  function renderLang() {
    const cur = window.LANG;
    $('#sec-lang').innerHTML = `<h2>Sprache</h2>
      <p class="note">Gilt für dieses Gerät. Auf dem iPad und am PC kannst du unterschiedliche Sprachen wählen. Die Seite lädt nach der Auswahl neu.</p>
      <div class="th-grid lang-grid">
        <button class="th-card ${cur === 'de' ? 'on' : ''}" data-lang="de"><b>Deutsch</b><small>German</small></button>
        <button class="th-card ${cur === 'en' ? 'on' : ''}" data-lang="en"><b>English</b><small>Englisch</small></button>
      </div>
      <p class="note">Checklisten, Flugplan-Texte (SimBrief) und Wetter-Meldungen sind ohnehin englisch.</p>`;
  }

  const RENDER = { lang: renderLang, airlines: renderAirlines, design: renderDesign, tabs: renderTabs, presets: renderPresets, logbook: renderLogbook };
  function show(name) {
    sec = name; store.set('setSec', name);
    $$('#setNav button').forEach((b) => b.classList.toggle('on', b.dataset.sec === name));
    $$('.set-sec').forEach((e) => e.classList.toggle('on', e.id === 'sec-' + name));
    if (RENDER[name]) RENDER[name]();
    const body = $('.set-body'); if (body) body.scrollTop = 0;
  }
  const typing = () => { const e = document.activeElement; return e && /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) && $('#tab-setup').contains(e); };
  const refresh = () => { if (RENDER[sec] && !typing()) RENDER[sec](); };

  // ---------- Bedienung ----------
  function airlineOf(el) { const card = el.closest('.al-card'); return card ? S().airlines.find((a) => a.id === card.dataset.id) : null; }

  function bind() {
    const root = $('#tab-setup');
    $('#setNav').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.sec); });

    root.addEventListener('click', async (e) => {
      const t = e.target.closest('button'); if (!t) return;
      const s = S(); if (!s) return;
      // Airlines
      if (t.dataset.al) {
        const a = airlineOf(t), k = t.dataset.al;
        if (k === 'use' && a) { Settings.setAirline(a.id); Settings.toast(`Airline: ${a.name}`); renderAirlines(); }
        if (k === 'del' && a) confirmTap(t, () => { Settings.change((d) => { d.airlines = d.airlines.filter((x) => x.id !== a.id); if (d.activeAirline === a.id) d.activeAirline = ''; }); renderAirlines(); });
        if (k === 'addTpl') {
          const i = $('#alTpl').value; if (i === '') return Settings.toast('Bitte erst eine Vorlage wählen', true);
          const tpl = AIRLINE_TEMPLATES[+i];
          Settings.change((d) => { const n = { id: uid('al'), ...tpl, callsign: '', bg: '', theme: '' }; d.airlines.push(n); if (!d.activeAirline) d.activeAirline = n.id; }); renderAirlines();
        }
        if (k === 'addNew') { Settings.change((d) => { const n = { id: uid('al'), name: 'Neue Airline', short: '', icao: '', callsign: '', accent: '#38c8f5', accent2: '#ffb020', bg: '', theme: '' }; d.airlines.push(n); if (!d.activeAirline) d.activeAirline = n.id; }); renderAirlines(); }
        if (k === 'bg' && a) t.parentElement.querySelector('input[type=file]').click();
        if (k === 'nobg' && a) { Settings.change((d) => { d.airlines.find((x) => x.id === a.id).bg = ''; }); renderAirlines(); }
      }
      // Standard-Hintergrund
      if (t.dataset.bg === 'pick') t.parentElement.querySelector('input[type=file]').click();
      if (t.dataset.bg === 'clear') { Settings.change((d) => { d.bgDefault = ''; }); renderDesign(); }
      if (t.dataset.lang) { window.i18n.set(t.dataset.lang); return; }
      // Design
      if (t.dataset.theme) { Settings.change((d) => { d.theme = t.dataset.theme; }); renderDesign(); }
      // Tabs
      const row = t.closest('.tab-row');
      if (row && t.dataset.mv) {
        const k = row.dataset.t, dir = +t.dataset.mv;
        Settings.change((d) => { const o = d.tabs.order, i = o.indexOf(k), j = i + dir; if (j >= 0 && j < o.length - 1) { [o[i], o[j]] = [o[j], o[i]]; } }, true); renderTabs();
      }
      if (t.id === 'tabAll') { Settings.change((d) => { d.tabs.hidden = []; }); renderTabs(); }
      if (t.id === 'tabReset') { Settings.change((d) => { d.tabs.order = ['flight', 'efb', 'ofp', 'perf', 'finder', 'atc', 'map', 'charts', 'check', 'copilot', 'gsx', 'logbook', 'music', 'setup']; }); renderTabs(); }
      // Presets
      if (t.id === 'prSave') {
        const name = $('#prName').value.trim(); if (!name) return Settings.toast('Bitte einen Namen eingeben', true);
        Settings.change((d) => { d.presets.push({ id: uid('pr'), name, theme: d.theme, airline: d.activeAirline, tabs: JSON.parse(JSON.stringify(d.tabs)) }); }); renderPresets();
      }
      if (t.id === 'prDemo') {
        const all = s.tabs.order.filter((x) => x !== 'setup');
        const mk = (name, theme, keep) => ({ id: uid('pr'), name, theme, airline: '', tabs: { order: [...keep, ...all.filter((x) => !keep.includes(x)), 'setup'], hidden: all.filter((x) => !keep.includes(x)) } });
        Settings.change((d) => {
          d.presets.push(
            { id: uid('pr'), name: 'Alles', theme: '', airline: '', tabs: { order: all.concat('setup'), hidden: [] } },
            mk('Nur Fliegen', '', ['flight', 'ofp', 'perf', 'map', 'check', 'gsx', 'logbook']),
            mk('Online (VATSIM)', '', ['flight', 'ofp', 'atc', 'finder', 'map', 'charts', 'logbook']),
            mk('Nachtflug', 'night', ['flight', 'ofp', 'map', 'check', 'logbook', 'music']),
          );
        }); renderPresets();
      }
      const pr = t.closest('.pr-row');
      if (pr && t.dataset.pr) {
        const p = s.presets.find((x) => x.id === pr.dataset.id); if (!p) return;
        if (t.dataset.pr === 'load') { Settings.applyPreset(p); renderPresets(); }
        if (t.dataset.pr === 'upd') confirmTap(t, () => { Settings.change((d) => { const q = d.presets.find((x) => x.id === p.id); q.theme = d.theme; q.airline = d.activeAirline; q.tabs = JSON.parse(JSON.stringify(d.tabs)); }); renderPresets(); });
        if (t.dataset.pr === 'del') confirmTap(t, () => { Settings.change((d) => { d.presets = d.presets.filter((x) => x.id !== p.id); }); renderPresets(); });
      }
      // Logbuch aufräumen
      if (t.dataset.lb) {
        const k = t.dataset.lb, cur = Settings.current();
        const body = k === 'all' ? { all: true } : k === 'air' ? { airline: cur.id } : { olderThanDays: +k };
        confirmTap(t, async () => {
          const r = await fetch('/api/logbook/prune', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => null);
          Settings.toast(r ? `${r.removed} ${r.removed === 1 ? 'Eintrag' : 'Einträge'} gelöscht` : 'Löschen fehlgeschlagen', !r); renderLogbook();
        });
      }
    });

    root.addEventListener('input', (e) => {
      const el = e.target, s = S(); if (!s) return;
      const f = el.dataset.f, a = airlineOf(el);
      if (f && a) {
        let v = el.value;
        if (f === 'icao') v = v.toUpperCase().slice(0, 3);
        Settings.change((d) => { d.airlines.find((x) => x.id === a.id)[f] = v; }, true);
        if (f === 'accent') { const dot = el.closest('.al-card').querySelector('.al-dot'); dot.style.background = v; }
        if (f === 'name') el.closest('.al-card').querySelector('.al-top b').textContent = v;
      }
      if (el.id === 'opRange') { Settings.change((d) => { d.screenOpacity = +el.value; }, true); $('#opV').textContent = el.value + ' %'; }
      if (el.id === 'blRange') { Settings.change((d) => { d.glassBlur = +el.value; }, true); $('#blV').textContent = el.value + ' px'; }
    });

    root.addEventListener('change', async (e) => {
      const el = e.target, s = S(); if (!s) return;
      if (el.dataset.f === 'theme') { const a = airlineOf(el); Settings.change((d) => { d.airlines.find((x) => x.id === a.id).theme = el.value; }); }
      if (el.id === 'alAuto') Settings.change((d) => { d.autoAirline = el.checked; });
      if (el.id === 'alColor') Settings.change((d) => { d.useAirlineColor = el.checked; });
      if (el.matches('[data-vis]')) { const k = el.closest('.tab-row').dataset.t; Settings.change((d) => { const h = new Set(d.tabs.hidden); if (el.checked) h.delete(k); else h.add(k); d.tabs.hidden = [...h]; }, true); el.closest('.tab-row').classList.toggle('off', !el.checked); }
      if (el.id === 'lbFilter') Settings.change((d) => { d.logbook.filter = el.value; });
      if (el.id === 'lbSort') Settings.change((d) => { d.logbook.sort = el.value; });
      if (el.id === 'lbMax') Settings.change((d) => { d.logbook.max = Math.max(20, Math.min(5000, +el.value || 1000)); });
      if (el.type === 'file' && el.files[0]) {
        const file = el.files[0], a = airlineOf(el), kind = el.dataset.file;
        el.value = '';
        Settings.toast('Bild wird hochgeladen …');
        try {
          const name = await Settings.uploadBg(file, a ? a.id : 'standard');
          Settings.change((d) => { if (kind === 'al' && a) d.airlines.find((x) => x.id === a.id).bg = name; else d.bgDefault = name; });
          if (kind === 'al') renderAirlines(); else renderDesign();
        } catch (err) { Settings.toast(err.message, true); }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bind();
    Settings.onChange(refresh);
    hooks.tab.push((name) => { if (name === 'setup') show(sec); });
    show(sec);
  });
  return { show };
})();
