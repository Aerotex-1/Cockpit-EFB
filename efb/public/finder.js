// Flight Finder: Flugzeug + gewünschte Flugzeit (+ optional Start/Ziel) → passende Strecken
'use strict';

const Finder = (() => {
  const M = PerfModel;
  const PRESETS = [['Kurz', 30, 60], ['Mittel', 60, 120], ['Lang', 120, 240], ['Sehr lang', 240, 420], ['Interkontinental', 420, 720]];
  const TAXI_AND_PROFILE_MIN = 32; // Rollen, Steig- und Sinkflug zusätzlich zur Reiseflugzeit
  let built = false, results = [], note = '';

  const rad = (d) => (d * Math.PI) / 180;
  function gc(a, b) {
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    const nm = 2 * 3440.065 * Math.asin(Math.sqrt(h));
    const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
    return { nm, brg: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360 };
  }
  const blockMin = (T, nm) => (nm / T.gs) * 60 + TAXI_AND_PROFILE_MIN;
  const hm = (min) => { const m = Math.round(min); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`; };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const lookup = (s) => { s = String(s || '').trim().toUpperCase(); return s ? (app.airports || []).find((a) => a.icao === s || a.iata === s) || null : null; };
  const cur = () => { const el = $('#fType'); return el ? el.value : 'A20N'; };

  function pair(T, a, b) {
    const g = gc(a, b);
    return { dep: a, arr: b, nm: g.nm, brg: g.brg, min: blockMin(T, g.nm) };
  }

  function search() {
    const T = M.TYPES[cur()];
    const min = Number($('#fMin').value) || 0, max = Number($('#fMax').value) || 9999;
    const depTxt = $('#fDep').value.trim(), arrTxt = $('#fArr').value.trim();
    const dep = lookup(depTxt), arr = lookup(arrTxt);
    note = ''; results = [];
    if (depTxt && !dep) { note = `„${depTxt.toUpperCase()}“ ist nicht in der Flughafenliste.`; return render(); }
    if (arrTxt && !arr) { note = `„${arrTxt.toUpperCase()}“ ist nicht in der Flughafenliste.`; return render(); }
    if (dep && arr) {
      if (dep === arr) { note = 'Start und Ziel sind gleich.'; return render(); }
      results = [pair(T, dep, arr)];
      return render();
    }
    if (max > 300 && $('#fReg').value === 'eu') $('#fReg').value = 'all'; // Langstrecken gibt es in Europa kaum
    const eu = $('#fReg').value === 'eu';
    const pool = (app.airports || []).filter((a) => (!eu || a.eu) && a.rwy >= T.minRwy);
    const longest = T.rangeNm * 0.9;
    const used = new Set();
    const deps = dep ? [dep] : shuffle(pool);
    for (const d of deps) {
      for (const a of arr ? [arr] : shuffle(pool)) {
        if (a === d) continue;
        const p = pair(T, d, a);
        if (p.nm > longest || p.min < min || p.min > max) continue;
        const key = d.icao + a.icao;
        if (used.has(key)) continue;
        used.add(key); results.push(p);
        if (!dep) break; // bei zufälligem Start: je Flughafen nur eine Strecke, damit es abwechslungsreich bleibt
        if (results.length >= 6) break;
      }
      if (results.length >= 6) break;
    }
    if (!results.length) note = `Keine Strecke mit ${T.name} zwischen ${hm(min)} und ${hm(max)} gefunden. Mach das Zeitfenster größer${eu ? ' oder wähle „Weltweit“' : ''}.`;
    render();
  }

  function render() {
    const T = M.TYPES[cur()];
    const el = $('#fResults');
    if (!el) return;
    const card = (r, i) => {
      const short = (a) => a.rwy < T.minRwy;
      return `<article class="route">
        <div class="route-main">
          <div class="r-end"><b>${esc(r.dep.icao)}</b><span>${esc(r.dep.name)}</span></div>
          <div class="r-line"><i></i><span>${fmt(Math.round(r.nm))} NM · ${hm(r.min)}</span></div>
          <div class="r-end right"><b>${esc(r.arr.icao)}</b><span>${esc(r.arr.name)}</span></div>
        </div>
        <div class="route-meta"><span>Kurs ${String(Math.round(r.brg)).padStart(3, '0')}°</span><span>Piste ${fmt(r.dep.rwy)} / ${fmt(r.arr.rwy)} m</span>
          ${short(r.dep) || short(r.arr) ? '<span class="warn">Piste kurz für den Typ</span>' : ''}${r.nm > T.rangeNm * 0.9 ? '<span class="warn">Reichweite knapp</span>' : ''}</div>
        <div class="route-act">
          <a class="btn" target="_blank" rel="noopener" href="https://www.simbrief.com/system/dispatch.php?orig=${r.dep.icao}&dest=${r.arr.icao}&type=${cur()}">In SimBrief planen</a>
          <button class="btn-s" data-fperf="${i}">In Performance-Rechner</button>
        </div></article>`;
    };
    el.innerHTML = (note ? `<p class="empty">${esc(note)}</p>` : '') + results.map(card).join('');
  }

  function typeOptions(cur) {
    const groups = {};
    Object.values(M.TYPES).forEach((t) => { (groups[t.grp] = groups[t.grp] || []).push(t); });
    return Object.entries(groups).map(([g, ts]) => `<optgroup label="${esc(g)}">${ts.map((t) => `<option value="${t.code}" ${t.code === cur ? 'selected' : ''}>${esc(M.label(t.code))}</option>`).join('')}</optgroup>`).join('');
  }

  function build() {
    if (built) return;
    built = true;
    const stored = store.get('finderType', null);
    const guess = (() => { const p = currentProfile(); const o = app.ofp && app.ofp.aircraft && String(app.ofp.aircraft.icaocode || '').toUpperCase(); return stored || (M.TYPES[o] ? o : p && p.id === 'fenix-a320' ? 'A320' : 'A20N'); })();
    $('#finderForm').innerHTML = `
      <div class="calc-grid finder-grid">
        <label>Flugzeug<select id="fType">${typeOptions(guess)}</select></label>
        <label>Flugzeit von (Min)<input id="fMin" inputmode="numeric" value="60"></label>
        <label>bis (Min)<input id="fMax" inputmode="numeric" value="120"></label>
        <label>Start (leer = Zufall)<input id="fDep" autocapitalize="characters" autocomplete="off" maxlength="4" placeholder="EDDP"></label>
        <label>Ziel (leer = Zufall)<input id="fArr" autocapitalize="characters" autocomplete="off" maxlength="4" placeholder="optional"></label>
        <label>Region<select id="fReg"><option value="eu">Europa</option><option value="all">Weltweit</option></select></label>
      </div>
      <div class="chips">${PRESETS.map(([n, a, b]) => `<button class="chip" data-fpre="${a}-${b}">${n} <small>${hm(a).replace(' h', '')}–${hm(b).replace(' h', '')}</small></button>`).join('')}</div>
      <div class="form-row"><button class="btn" id="fGo">Würfeln</button><span class="note">Start, Ziel oder beides eintragen, um die Suche einzugrenzen. ${(app.airports || []).length} Flughäfen im Bestand.</span></div>`;
    search();
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'fGo') search();
    if (t.dataset.fpre) { const [a, b] = t.dataset.fpre.split('-'); $('#fMin').value = a; $('#fMax').value = b; search(); }
    if (t.dataset.fperf !== undefined) { const r = results[Number(t.dataset.fperf)]; if (r) { PerfCalc.setRoute(r.dep.icao, r.arr.icao); showTab('perf'); } }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'fType') { store.set('finderType', e.target.value); search(); }
    if (e.target.id === 'fReg') search();
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'fDep' || e.target.id === 'fArr') e.target.value = e.target.value.toUpperCase(); });
  hooks.tab.push((n) => { if (n === 'finder') build(); });
  return { search };
})();
