// Charts: ChartFox als Weboberfläche und gespeicherte Bilder/PDFs (die Lido-Bilder gibt der Sim nicht heraus)
'use strict';

const Charts = (() => {
  let source = store.get('chartSrc', 'chartfox');
  if (source !== 'chartfox' && source !== 'local') source = 'chartfox';
  let apt = null;
  let theme = store.get('chartTheme', 'light');
  let local = {};
  let lidoIndex = null;
  let current = null; // { kind:'lido', guid, name, pages, page } | { kind:'local', file }
  let zoom = 1, fit = true;
  const LIDO_GROUPS = [['APPR', 'Anflug'], ['STAR', 'STAR'], ['SID', 'SID'], ['ARPT', 'Flughafen']];

  // Flughäfen der Route: Abflug, Ziel, alle Ausweichflughäfen
  const ofpAirports = () => {
    if (!app.ofp) return [];
    const alts = Array.isArray(app.ofp.alternate) ? app.ofp.alternate : [app.ofp.alternate];
    return [...new Set([app.ofp.origin, app.ofp.destination, ...alts].filter((a) => a && a.icao_code).map((a) => a.icao_code))];
  };


  async function show() {
    $$('#chartSource button').forEach((b) => b.classList.toggle('on', b.dataset.src === source));
    if (source === 'local' || source === 'chartfox') local = await fetch('/api/charts').then((r) => r.json()).catch(() => ({}));
    const list = [...new Set([...ofpAirports(), ...(source === 'local' ? Object.keys(local) : []), ...(apt ? [apt] : [])])];
    if (!apt || !list.includes(apt)) apt = list[0] || null;
    $('#chartAirports').innerHTML = list.map((a) => `<button class="chip ${ofpAirports().includes(a) ? 'ofp' : ''} ${a === apt ? 'on' : ''}" data-capt="${esc(a)}">${esc(a)}</button>`).join('');
    renderList();
  }

  // ---------- ChartFox als Weboberfläche ----------
  const cfUrl = () => (apt ? `https://chartfox.org/${encodeURIComponent(apt)}` : 'https://chartfox.org/');
  function drawChartfox() {
    $('#chartTools').hidden = true;
    $('#cfTools').hidden = false;
    $('#cfDelete').hidden = true;
    $('#cfTab').href = cfUrl();
    current = { kind: 'chartfox', apt };
    const apts = [...new Set([...ofpAirports(), ...(apt ? [apt] : [])])];
    const roles = {};
    if (app.ofp) {
      roles[app.ofp.origin && app.ofp.origin.icao_code] = 'Abflug';
      roles[app.ofp.destination && app.ofp.destination.icao_code] = 'Ziel';
      (Array.isArray(app.ofp.alternate) ? app.ofp.alternate : [app.ofp.alternate]).forEach((a) => { if (a && a.icao_code && !roles[a.icao_code]) roles[a.icao_code] = 'Ausweich'; });
    }
    $('#chartCanvas').innerHTML = `<div class="cf-launch">
      <h3>ChartFox</h3>
      <p>ChartFox lässt sich nicht in andere Seiten einbetten. Öffne es in Safari und lege es per Split View neben dieses EFB: Antippen und halten auf dem Tab-Symbol, dann „Split View“ (oder Slide Over).</p>
      <div class="cf-links">${apts.length ? apts.map((a) => `<a class="btn" target="_blank" rel="noopener" href="https://chartfox.org/${encodeURIComponent(a)}"><b>${esc(a)}</b><small>${esc(roles[a] || 'Flughafen')}</small></a>`).join('')
        : '<p class="empty">Lade einen OFP oder gib links einen ICAO-Code ein.</p>'}
        <a class="btn-s" target="_blank" rel="noopener" href="https://chartfox.org/">ChartFox-Startseite</a></div>
      <p class="note">Wichtige Karte gefunden? Screenshot machen und links bei „Gespeichert“ ablegen – dann liegt sie offline im EFB.</p></div>`;
  }
  function chartfoxList() {
    const files = local[apt] || [];
    $('#chartList').innerHTML = `<p class="note">ChartFox öffnet in Safari (Buttons rechts).</p>
      <p class="note"><b>Screenshot ablegen:</b> Am iPad Lauter + Ein/Aus drücken, in der Vorschau unten links Zuschneiden und „Fertig → In Fotos sichern“, dann hier „Bild ablegen“. Oder „Kopieren und Löschen“ wählen und „Aus Zwischenablage“ tippen.</p>
      ${apt ? `<h4>Gespeichert für ${esc(apt)} <small>${files.length}</small></h4>` + (files.map((f) => `<button class="chart-item" data-cfile="${esc(f)}" data-tosaved="1">${esc(f.replace(/\.(pdf|png|jpe?g)$/i, ''))}</button>`).join('') || '<p class="note">Noch nichts gespeichert.</p>') : ''}`;
  }
  async function uploadImage(blob, suggested) {
    if (!apt) { flash('Wähle zuerst einen Flughafen (ICAO).'); return; }
    const name = prompt(`Name der Karte (wird für ${apt} gespeichert):`, suggested || '');
    if (name === null) return;
    const r = await fetch(`/api/charts/upload?icao=${encodeURIComponent(apt)}&name=${encodeURIComponent(name)}`, { method: 'POST', body: blob });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { flash(d.error || 'Speichern fehlgeschlagen'); return; }
    flash(`Gespeichert: ${d.file}`);
    local = await fetch('/api/charts').then((x) => x.json()).catch(() => local);
    if (source === 'chartfox') chartfoxList();
  }
  function flash(msg) {
    const n = $('#chartNote'); if (!n) return;
    n.textContent = msg; clearTimeout(flash.t); flash.t = setTimeout(() => { n.textContent = ''; }, 6000);
  }

  async function renderList() {
    const note = $('#chartNote');
    const el = $('#chartList');
    note.textContent = '';
    if (source === 'chartfox') { chartfoxList(); if (!current || current.kind !== 'chartfox' || current.apt !== apt) { drawChartfox(); current.apt = apt; } return; }
    if (!apt) { el.innerHTML = '<p class="note">Gib oben einen ICAO-Code ein oder lade einen OFP.</p>'; return; }
    if (source === 'local') {
      const files = local[apt] || [];
      el.innerHTML = files.map((f) => `<button class="chart-item" data-cfile="${esc(f)}">${esc(f.replace(/\.(pdf|png|jpe?g)$/i, ''))}</button>`).join('') ||
        `<p class="note">Keine Dateien in <code>charts/${esc(apt)}</code> auf dem PC.</p>`;
      return;
    }
    const lido = app.sim.lido || {};
    if (!lido.connected) {
      el.innerHTML = '';
      note.innerHTML = 'Das Sim-Modul „Cockpit EFB Link“ ist nicht verbunden. Es muss im Community-Ordner liegen, der Sim laufen und das EFB des Sims einmal geöffnet worden sein. Bis dahin kannst du auf „Eigene“ umschalten.' +
        (lido.lastLog ? `<br><br>Letzte Meldung aus dem Sim: <code>${esc(lido.lastLog.msg)}</code>` : '');
      return;
    }
    el.innerHTML = '<p class="note">Lade Charts aus dem Sim …</p>';
    try {
      const r = await fetch(`/api/lido/index?icao=${encodeURIComponent(apt)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      lidoIndex = d;
      const rwyFilter = (app.ofp && [app.ofp.origin, app.ofp.destination].find((x) => x && x.icao_code === apt) || {}).plan_rwy;
      el.innerHTML = LIDO_GROUPS.map(([g, label]) => {
        const items = d.groups[g] || [];
        if (!items.length) return '';
        return `<h4>${label} <small>${items.length}</small></h4>` + items.map((c) => {
          const hit = rwyFilter && c.runways.some((x) => x === rwyFilter);
          return `<button class="chart-item ${hit ? 'hit' : ''}" data-cguid="${esc(c.guid)}" data-cname="${esc(c.name)}">${esc(c.name)}${c.geo ? ' <span class="geo" title="Flugzeugposition möglich">◉</span>' : ''}</button>`;
        }).join('');
      }).join('') || `<p class="note">Für ${esc(apt)} hat Lido keine Charts. Lido deckt vor allem Verkehrsflughäfen ab.</p>`;
    } catch (e) {
      el.innerHTML = `<p class="note bad">${esc(e.message)}</p>`;
    }
  }

  async function openLido(guid, name) {
    $$('[data-cguid]').forEach((b) => b.classList.toggle('on', b.dataset.cguid === guid));
    $('#chartCanvas').innerHTML = '<p class="empty">Lade Chart …</p>';
    try {
      const r = await fetch(`/api/lido/pages?guid=${encodeURIComponent(guid)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      current = { kind: 'lido', guid, name, pages: d.pages, page: 0 };
      fit = true;
      drawLido();
    } catch (e) {
      $('#chartCanvas').innerHTML = `<p class="empty bad">${esc(e.message)}</p>`;
    }
  }

  function imgUrl() { return `/api/lido/image?guid=${encodeURIComponent(current.guid)}&page=${current.page}&theme=${theme}`; }

  function drawLido() {
    const p = current.pages[current.page];
    if (!p) return;
    $('#chartTools').hidden = false;
    $('#chartTheme').hidden = false;
    $('#chartTheme').textContent = theme === 'dark' ? 'Tag' : 'Nacht';
    $('#chartPage').hidden = current.pages.length < 2;
    $('#chartPage').textContent = `Seite ${current.page + 1}/${current.pages.length}`;
    $('#chartOpen').href = imgUrl();
    $('#chartCanvas').innerHTML = `<div class="chart-stage" id="chartStage" style="aspect-ratio:${p.width}/${p.height}">
        <img id="chartImg" src="${imgUrl()}" alt="${esc(current.name)}">
        <div class="chart-plane" id="chartPlane" hidden>${planeSvgSmall()}</div>
      </div>`;
    $('#chartImg').onerror = () => { $('#chartCanvas').insertAdjacentHTML('beforeend', '<p class="empty bad">Das Bild konnte nicht geladen werden. Läuft das Sim-Modul?</p>'); };
    applyZoom();
    updatePlane();
  }

  function openLocal(file) {
    current = { kind: 'local', file };
    $$('[data-cfile]').forEach((b) => b.classList.toggle('on', b.dataset.cfile === file));
    const url = `/charts/${encodeURIComponent(apt)}/${encodeURIComponent(file)}`;
    $('#chartTools').hidden = false;
    $('#cfTools').hidden = false; $('#cfDelete').hidden = false;
    $('#chartTheme').hidden = true; $('#chartPage').hidden = true;
    $('#chartOpen').href = url;
    fit = true;
    $('#chartCanvas').innerHTML = /\.pdf$/i.test(file)
      ? `<iframe src="${url}" title="${esc(file)}"></iframe>`
      : `<div class="chart-stage" id="chartStage"><img id="chartImg" src="${url}" alt="${esc(file)}"></div>`;
    applyZoom();
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((x) => x === 'image/png' || x === 'image/jpeg');
        if (type) { await uploadImage(await it.getType(type), ''); return; }
      }
      flash('In der Zwischenablage ist kein Bild.');
    } catch (e) {
      flash('Zugriff auf die Zwischenablage nicht möglich. Bitte „Bild ablegen“ benutzen.');
    }
  }
  document.addEventListener('change', async (e) => {
    if (e.target.id !== 'cfFile') return;
    for (const f of e.target.files) await uploadImage(f, f.name.replace(/\.[^.]+$/, '').replace(/^IMG_|^Screenshot[ _-]*/i, ''));
    e.target.value = '';
  });

  function applyZoom() {
    const stage = $('#chartStage'); if (!stage) return;
    stage.style.width = fit ? '100%' : `${zoom * 100}%`;
  }

  // ---------- Flugzeugposition auf georeferenzierten Charts ----------
  const planeSvgSmall = () => '<svg width="30" height="30" viewBox="0 0 36 36"><path d="M18 2l2.4 11 12 6.5v3l-12-3.2-.9 8 3.8 2.8v2.4L18 31l-5.3 1.5v-2.4l3.8-2.8-.9-8-12 3.2v-3l12-6.5z" fill="#e040fb" stroke="#000" stroke-width="1.2"/></svg>';

  // Lambert-Projektion wie im MSFS-SDK (ChartViewLambertConformalConicProjection)
  function lcc(proj) {
    const R = 6378137, d2r = Math.PI / 180;
    const p1 = proj.standardParallel1 * d2r, p2 = proj.standardParallel2 * d2r;
    const n = Math.abs(p1 - p2) < 1e-9 ? Math.sin(p1)
      : Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
    const F = (Math.cos(p1) * Math.tan(Math.PI / 4 + p1 / 2) ** n) / n;
    const p0 = (R * F) / Math.tan(Math.PI / 4 + p1 / 2) ** n;
    return (lat, lon) => {
      const pr = (R * F) / Math.tan(Math.PI / 4 + (lat * d2r) / 2) ** n;
      const th = n * (lon - proj.centralMeridian) * d2r;
      return [pr * Math.sin(th), -(p0 - pr * Math.cos(th))]; // y nach unten wie im Bild
    };
  }
  // Rechnet Lat/Lon in Bildkoordinaten (Pixel der Chart-Seite) um
  function toChart(area, lat, lon) {
    const f = lcc(area.projection);
    const w = area.worldRectangle, c = area.chartRectangle;
    const a = f(w.upperLeft[1], w.upperLeft[0]), b = f(w.lowerRight[1], w.lowerRight[0]), q = f(lat, lon);
    const rot = (-(w.orientation || 0) * Math.PI) / 180;
    const r = ([x, y]) => [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
    const B = r([b[0] - a[0], b[1] - a[1]]), Q = r([q[0] - a[0], q[1] - a[1]]);
    const scale = Math.hypot(c.lowerRight[0] - c.upperLeft[0], c.lowerRight[1] - c.upperLeft[1]) / Math.hypot(B[0], B[1]);
    const x = c.upperLeft[0] + Q[0] * scale, y = c.upperLeft[1] + Q[1] * scale;
    const inside = x >= Math.min(c.upperLeft[0], c.lowerRight[0]) && x <= Math.max(c.upperLeft[0], c.lowerRight[0])
      && y >= Math.min(c.upperLeft[1], c.lowerRight[1]) && y <= Math.max(c.upperLeft[1], c.lowerRight[1]);
    return { x, y, inside };
  }
  function updatePlane() {
    const el = $('#chartPlane');
    if (!el || !current || current.kind !== 'lido') return;
    const p = current.pages[current.page];
    const s = app.sim;
    if (!p || !p.areas.length || s.lat === null || s.lat === undefined) { el.hidden = true; return; }
    let pos = null;
    for (const area of p.areas) { const r = toChart(area, s.lat, s.lon); if (r.inside) { pos = r; break; } }
    if (!pos) { el.hidden = true; return; }
    el.hidden = false;
    el.style.left = `${(pos.x / p.width) * 100}%`;
    el.style.top = `${(pos.y / p.height) * 100}%`;
    el.firstElementChild.style.transform = `rotate(${s.hdg || 0}deg)`;
  }

  // ---------- Bedienung ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t || !t.closest('#tab-charts')) return;
    if (t.dataset.src) { source = t.dataset.src; store.set('chartSrc', source); current = null; $('#cfTools').hidden = true; $('#chartTools').hidden = true; $('#chartCanvas').innerHTML = '<p class="empty">Wähle links einen Flughafen und eine Karte.</p>'; show(); }
    if (t.dataset.capt) { apt = t.dataset.capt; show(); }
    if (t.dataset.cguid) openLido(t.dataset.cguid, t.dataset.cname);
    if (t.dataset.cfile) { if (t.dataset.tosaved) { source = 'local'; store.set('chartSrc', source); const f = t.dataset.cfile; show().then(() => openLocal(f)); } else openLocal(t.dataset.cfile); }
    if (t.id === 'cfReload') drawChartfox();
    if (t.id === 'cfPaste') pasteImage();
    if (t.id === 'cfDelete' && current && current.kind === 'local' && confirm(`„${current.file}“ löschen?`)) {
      fetch('/api/charts/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ icao: apt, file: current.file }) })
        .then(() => { current = null; $('#chartCanvas').innerHTML = '<p class="empty">Gelöscht.</p>'; show(); });
    }
    if (t.dataset.zoom !== undefined) {
      const z = Number(t.dataset.zoom);
      if (z === 0) fit = true; else { if (fit) { zoom = 1; fit = false; } zoom = Math.max(0.5, Math.min(4, zoom * (z > 0 ? 1.4 : 1 / 1.4))); }
      applyZoom();
    }
    if (t.id === 'chartTheme') { theme = theme === 'dark' ? 'light' : 'dark'; store.set('chartTheme', theme); if (current && current.kind === 'lido') drawLido(); }
    if (t.id === 'chartPage' && current && current.kind === 'lido') { current.page = (current.page + 1) % current.pages.length; drawLido(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'chartIcao' && e.key === 'Enter') {
      const v = e.target.value.trim().toUpperCase();
      if (/^[A-Z0-9]{3,4}$/.test(v)) { apt = v; e.target.value = ''; e.target.blur(); show(); }
    }
  });

  let lastLidoConn = null;
  hooks.tab.push((n) => { if (n === 'charts') show(); });
  hooks.ofp.push(() => {
    if (app.tab === 'charts') show();
  });
  hooks.sim.push((s) => {
    if (app.tab !== 'charts') return;
    updatePlane();
    const c = !!(s.lido && s.lido.connected);
    if (c !== lastLidoConn) { lastLidoConn = c; if (source === 'lido') renderList(); }
  });

  // Für die Karte: aktuell geöffnete georeferenzierte Seite
  function currentGeo() {
    if (!current || current.kind !== 'lido') return null;
    const p = current.pages[current.page];
    if (!p || !p.areas.length) return null;
    return { url: imgUrl(), page: p, name: current.name };
  }
  return { show, currentGeo, toChart };
})();
