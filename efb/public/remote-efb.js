// Remote-EFB: Boden, Fuel, Payload, Presets und Störungen für FBW A32NX/A380X und Headwind A339X
'use strict';

const RemoteEfb = (() => {
  let rtab = store.get('rtab', 'ground');
  let viaGsx = store.get('viaGsx', false) === true;
  const viaSeg = () => `<div class="seg via-seg" id="viaSeg"><button data-via="0">Direkt im Flieger</button><button data-via="1">Mit GSX</button></div>`;
  async function gsxLoad(service, label) {
    const r = await fetch('/api/gsx/service', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service }) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: 'PC-Brücke nicht erreichbar.' }));
    if (!r.ok) flash(r.error || `GSX ${label} nicht möglich.`, true);
    else flash(r.menu ? `GSX fragt nach – bitte im Tab GSX antworten.` : `GSX: ${label} angefordert. Die Zielwerte gelten als Plan.`, false);
    if (r.menu) gsxUi.showMenuUntil = Date.now() + 40000;
    return r;
  }

  let failuresDb = null;
  let lastKind = null;
  let msgTimer = null;

  const st = () => app.sim.efb || {};
  const kindDef = () => (app.defs && app.defs.kinds[st().kind]) || null;
  const kg = (v) => (v === null || v === undefined || isNaN(v) ? '–' : `${fmt(v)} kg`);

  async function act(action, value) {
    const r = await fetch('/api/efb/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, value }) })
      .then((x) => x.json()).catch(() => ({ ok: false, error: 'PC-Brücke nicht erreichbar.' }));
    if (!r.ok) flash(r.error || 'Befehl konnte nicht gesendet werden.', true);
    else if (r.needsBridge && !(app.sim.lido && app.sim.lido.connected)) flash('Gespeichert. Wird an den Flieger gesendet, sobald das Sim-Modul verbunden ist.', false);
    return r;
  }
  function flash(msg, bad) {
    const el = $('#remoteMsg');
    if (!el) return;
    el.textContent = msg; el.classList.toggle('bad', !!bad);
    clearTimeout(msgTimer); msgTimer = setTimeout(() => { el.textContent = ''; }, 6000);
  }

  // ---------- Seiten-Gerüste (einmal pro Wechsel aufgebaut) ----------
  function skeleton() {
    const d = kindDef();
    const s = st();
    if (!d) {
      $('#remoteBody').innerHTML = '<p class="empty">Warte auf Daten vom Flieger …</p>';
      return;
    }
    if (s.std && ['presets'].includes(rtab)) rtab = 'ground';
    $$('#remoteNav button').forEach((b) => { b.hidden = !!s.std && ['presets'].includes(b.dataset.rtab); b.classList.toggle('on', b.dataset.rtab === rtab); });
    const foot = '<p class="remote-msg" id="remoteMsg"></p>';
    let html = '';
    if (rtab === 'ground') {
      html = `<div class="r-warn" id="gWarn" hidden></div>
        <h3>Türen</h3><div class="tiles" id="gDoors">${s.ground.doors.map((x) => `<button class="tile" data-door="${x.i}"><span class="t-name">${esc(x.name)}</span><span class="t-state" data-door-st="${x.i}"></span></button>`).join('')}</div>
        <h3>Fahrzeuge und Strom</h3><div class="tiles">
          ${tile('jetway', 'Fluggastbrücke')}${tile('stairs', 'Treppe')}${tile('catering', 'Catering-Truck')}${tile('baggage', 'Gepäckwagen')}
          ${tile('fuelTruck', 'Tankwagen', 'gFuel')}${tile('gpu', 'GPU', 'gGpu')}${s.ground.asu !== null ? tile('asu', 'Klimawagen (ASU)', 'gAsu') : ''}
        </div>
        ${s.std ? '<p class="note"><button class="btn-s" id="moreDoors">Weitere Türen (7–12) anzeigen</button> <button class=\"btn-s\" id=\"resetDoors\">Türzuordnung zurücksetzen</button> Frachttüren und Zusatztüren melden sich bei manchen Fliegern unter höheren Nummern.</p><p class="note" id="doorRaw"></p><p class="note">Die Zuordnung der Türen wird beim ersten Antippen gelernt (die Tür, die sich im Sim bewegt, gehört danach zur Kachel). Bei diesem Flieger gehen die Standard-Bodendienste des Sims (Türen, Fluggastbrücke, Wagen). Bei Add-ons mit eigenem System, etwa PMDG, nutzt du Türen und Bodenstrom besser im Cockpit oder über GSX.</p>' : `<h3>Bodenausrüstung</h3><div class="tiles">${tile('chocks', 'Bremsklötze', 'gChocks')}${tile('cones', 'Kegel', 'gCones')}</div>
        <p class="note">Klötze und Kegel erscheinen, wenn der Flieger steht und die Triebwerke aus sind. Die Einstellung gilt bis zum nächsten Laden des Fliegers.</p>`}`;
    } else if (rtab === 'fuel') {
      html = `<div class="big-row">
          <div class="big"><small>An Bord</small><span id="fCur">–</span></div>
          <div class="big"><small>Ziel</small><span id="fDes">–</span></div>
          <div class="big"><small>Max.</small><span id="fMax">–</span></div>
        </div>
        <div class="bar-wrap"><div class="bar-cur" id="fBarCur"></div><div class="bar-des" id="fBarDes"></div></div>
        <div class="form-row">
          <label>Ziel in kg <input id="fIn" inputmode="numeric"></label>
          <button class="btn" id="fSet">Ziel setzen</button>
          <button class="btn-s" id="fOfp">OFP-Block übernehmen</button>
        </div>
        ${s.std ? '' : `<div class="form-row">${viaSeg()}</div>
        <div class="form-row">
          <div class="seg" id="fRate"><button data-rate="0">Real</button><button data-rate="1">Schnell</button><button data-rate="2">Sofort</button></div>
          <button class="btn go" id="fGo">Betanken starten</button>
        </div>`}
        <div class="tanks" id="fTanks"></div>
        ${s.std ? '<p class="note">Die Menge wird sofort in die Tanks gefüllt (erst Flächen, dann Center). Hat dein Flieger ein eigenes Tanksystem, etwa PMDG, kann es den Wert überschreiben – dann bitte dort tanken.</p>' : '<p class="note">Bei „Real“ und „Schnell“ wird nur am Boden mit stehenden Triebwerken getankt. Mit „Mit GSX“ fordert der Knopf das Betanken bei GSX an; GSX tankt dann bis zum gesetzten Ziel.</p>'}`;
    } else if (rtab === 'payload' && s.std) {
      html = `<div class="big-row">
          <div class="big"><small>Nutzlast (ohne Besatzung)</small><span id="pPay">–</span></div>
          <div class="big"><small>Max. Nutzlast (Schätzung)</small><span id="pMax">–</span></div>
          <div class="big"><small>ZFW (Schätzung)</small><span id="pZfw">–</span></div>
          <div class="big"><small>Gesamtgewicht</small><span id="pGw">–</span></div>
        </div>
        <div class="form-row">
          <label>Passagiere <input id="pIn" inputmode="numeric"></label>
          <label>Zusatzfracht kg <input id="cIn" inputmode="numeric" value="0"></label>
          <button class="btn" id="pSetStd">Beladen</button>
          <button class="btn-s" id="pOfp">Aus OFP übernehmen</button>
        </div>
        <div class="form-row">
          <label>Gewicht/PAX <input id="pW" inputmode="numeric" value="84"></label>
          <label>Gewicht/Gepäck <input id="bW" inputmode="numeric" value="20"></label>
          <label>Besatzungs-Stationen <input id="crewIn" inputmode="numeric" value="2"></label>
        </div>
        <div class="stations" id="pStations"></div>
        <p class="note">Die Nutzlast wird sofort geladen und so auf die Stationen verteilt, wie sie schon beladen sind (bei leerem Flieger gleichmäßig). Besatzungs-Stationen bleiben unberührt. Die Verteilung kann vom Hersteller-Beladeplan abweichen – prüfe die Schwerpunkte im Flieger. Add-ons mit eigenem Beladesystem können den Wert überschreiben.</p>`;
    } else if (rtab === 'payload') {
      html = `<div class="big-row">
          <div class="big"><small>PAX an Bord / Ziel</small><span id="pPax">–</span></div>
          <div class="big"><small>Fracht an Bord / Ziel</small><span id="pCargo">–</span></div>
          <div class="big"><small>ZFW · CG</small><span id="pZfw">–</span></div>
          <div class="big"><small>GW · CG</small><span id="pGw">–</span></div>
        </div>
        <div class="form-row">
          <label>Passagiere <input id="pIn" inputmode="numeric"></label>
          <label>Zusatzfracht kg <input id="cIn" inputmode="numeric" value="0"></label>
          <button class="btn" id="pSet">Ziel setzen</button>
          <button class="btn-s" id="pOfp">Aus OFP übernehmen</button>
        </div>
        <div class="form-row">
          <label>Gewicht/PAX <input id="pW" inputmode="numeric"></label>
          <label>Gewicht/Gepäck <input id="bW" inputmode="numeric"></label>
          <button class="btn-s" id="wSet">Gewichte setzen</button>
        </div>
        <div class="form-row">${viaSeg()}</div>
        <div class="form-row">
          <div class="seg" id="pRate"><button data-brate="2">Real</button><button data-brate="1">Schnell</button><button data-brate="0">Sofort</button></div>
          <button class="btn go" id="pGo">Boarding starten</button>
        </div>
        <div class="stations" id="pStations"></div>`;
    } else if (rtab === 'presets') {
      html = `<div class="r-warn" id="prWarn" hidden></div>
        <div class="tiles">${app.defs.presets.map((p) => `<button class="tile" data-preset="${p.id}"><span class="t-name">${esc(p.name)}</span><span class="t-state" data-preset-st="${p.id}"></span></button>`).join('')}</div>
        <div class="form-row">
          <button class="btn-s" id="prExp">Schnell laden</button>
          <button class="btn-s" id="prCancel">Laden abbrechen</button>
        </div>
        <p class="note">Ein Preset schaltet das Cockpit Schritt für Schritt in den gewählten Zustand. Nur am Boden möglich. Schalter in deinem Replikat-Cockpit, die über Hardware gesteuert werden, können danach abweichen.</p>`;
    } else if (rtab === 'failures') {
      html = `<h3>Sim-Störungen</h3>
        <div class="tiles" id="sfTiles">${app.defs.simFailures.filter((f) => !f.engines || f.engines <= (st().kind === 'fbw-a380' ? 4 : 2)).map((f) => `<button class="tile st-x" data-simfail="${f.id}"><span class="t-name">${esc(f.name)}</span><span class="t-state">Antippen = an/aus</span></button>`).join('')}</div>
        <p class="note">Diese Störungen kommen vom MSFS selbst. ${s.std ? 'Add-ons mit eigenen Systemen (z. B. PMDG) reagieren darauf nur teilweise.' : 'Die Systeme von FBW und Headwind sind eigene Nachbauten; nicht jede Sim-Störung wirkt sich dort aus.'}</p>
        ${s.std ? '' : `<h3>Systemstörungen des Fliegers</h3>
        <div class="r-warn" id="fbBridge" hidden>Dafür muss das Sim-Modul (Ordner efb-app) im MSFS laufen. Ausgewählte Störungen werden gesendet, sobald es verbunden ist.</div>
        <div class="form-row"><input id="fbSearch" placeholder="Suchen, z. B. ELAC, Hydraulik" autocorrect="off"><button class="btn-s" id="fbClear">Alle zurücksetzen</button></div>
        <div id="fbList" class="fail-list"><p class="empty">Lade Liste …</p></div>`}`;
      if (!s.std) loadFailures();
    }
    $('#remoteBody').innerHTML = html + foot;
    update();
  }
  const tile = (action, label, id) => `<button class="tile" data-ract="${action}"${id ? ` id="${id}"` : ''}><span class="t-name">${label}</span><span class="t-state"></span></button>`;

  // ---------- Werte aktualisieren (bei jedem Datenpaket) ----------
  function setTile(el, on, text, cls) {
    if (!el) return;
    el.classList.remove('st-1', 'st-4', 'st-6', 'st-x');
    el.classList.add(cls || (on ? 'st-6' : 'st-x'));
    const t = el.querySelector('.t-state'); if (t) t.textContent = text;
  }
  function update() {
    const s = st(); const d = kindDef();
    if (!d || !s.kind) return;
    if (rtab === 'ground') {
      const g = s.ground;
      $$('[data-door]').forEach((el) => { const i = Number(el.dataset.door), x = g.doors[i], open = x ? x.open : (((g.doorRaw || [])[i]) || 0) / 100; open < 0 ? setTile(el, false, 'Antippen') : setTile(el, open > 0.9, open > 0.9 ? 'Offen' : open > 0.05 ? 'Bewegt sich' : 'Zu', open > 0.05 && open <= 0.9 ? 'st-4' : null); });
      setTile($('#gFuel'), g.fuelTruck > 0.5, g.fuelTruck > 0.5 ? 'Angeschlossen' : 'Antippen');
      setTile($('#gGpu'), g.gpu, g.gpu ? 'Strom verfügbar' : 'Antippen');
      setTile($('#gAsu'), g.asu, g.asu ? 'An' : 'Aus');
      setTile($('#gChocks'), g.chocks, g.chocks ? 'Aktiv' : 'Aus');
      setTile($('#gCones'), g.cones, g.cones ? 'Aktiv' : 'Aus');
      ['jetway', 'stairs', 'catering', 'baggage'].forEach((a) => setTile($(`[data-ract="${a}"]`), false, 'Antippen'));
      const w = $('#gWarn');
      if (w) {
        const txt = g.doorMsg || (g.enginesRunning ? 'Triebwerke laufen – Bodendienste nur eingeschränkt möglich.' : g.pushback ? 'Pushback ist angekoppelt.' : '');
        w.hidden = !txt; w.textContent = txt;
      }
      const dr = $('#doorRaw'); if (dr && g.doorRaw) dr.textContent = 'Sim-Türwerte (Diagnose): ' + g.doorRaw.map((x, i) => `${i + 1}: ${x} %`).join(' · ');
    } else if (rtab === 'fuel') {
      const f = s.fuel;
      $('#fCur').textContent = kg(f.currentKg); $('#fDes').textContent = kg(f.desiredKg); $('#fMax').textContent = kg(f.maxKg);
      $('#fBarCur').style.width = `${Math.min(100, (f.currentKg / f.maxKg) * 100)}%`;
      $('#fBarDes').style.left = `${Math.min(100, (f.desiredKg / f.maxKg) * 100)}%`;
      if (!$('#fGo')) { $('#fTanks').innerHTML = f.tanks.map((t) => `<div class="tank"><div class="tank-bar"><div style="height:${Math.min(100, (t.cur / t.max) * 100)}%"></div></div><small>${esc(t.name)}</small><span>${fmt(t.cur)}</span></div>`).join(''); if (!$('#fIn').value && f.desiredKg) $('#fIn').placeholder = Math.round(f.desiredKg); return; }
      $$('#fRate button').forEach((b) => b.classList.toggle('on', Number(b.dataset.rate) === Math.round(f.rate)));
      $$('#viaSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.via === '1') === viaGsx));
      $('#fRate').hidden = viaGsx;
      const go = $('#fGo'); go.textContent = viaGsx ? 'Betanken per GSX anfordern' : f.refueling ? 'Betanken stoppen' : 'Betanken starten'; go.classList.toggle('stop', !viaGsx && f.refueling);
      $('#fTanks').innerHTML = f.tanks.map((t) => `<div class="tank"><div class="tank-bar"><div style="height:${Math.min(100, (t.cur / t.max) * 100)}%"></div></div><small>${esc(t.name)}</small><span>${fmt(t.cur)}</span></div>`).join('');
      if (!$('#fIn').value && f.desiredKg) $('#fIn').placeholder = Math.round(f.desiredKg);
    } else if (rtab === 'payload' && s.std) {
      const p = s.stdPayload;
      $('#pPay').textContent = kg(p.payKg); $('#pMax').textContent = kg(p.maxPay + p.payKg); $('#pZfw').textContent = kg(p.zfw); $('#pGw').textContent = kg(p.gw);
      const top = Math.max(1, ...p.stations.map((x) => x.kg));
      $('#pStations').innerHTML = p.stations.map((x) => `<div class="station${x.i <= p.crew ? ' cargo' : ''}"><span>Station ${x.i}${x.i <= p.crew ? ' (Besatzung)' : ''}</span><div class="sbar"><div class="cur" style="width:${(x.kg / top) * 100}%"></div></div><span class="num">${fmt(x.kg)} kg</span></div>`).join('');
    } else if (rtab === 'payload') {
      const p = s.payload;
      $('#pPax').textContent = `${p.paxCur} / ${p.paxDes}`;
      $('#pCargo').textContent = `${fmt(p.cargoCur)} / ${fmt(p.cargoDes)} kg`;
      $('#pZfw').textContent = `${fmt(p.zfw)} · ${fmt(p.zfwCg, 1)} %`;
      $('#pGw').textContent = `${fmt(p.gw)} · ${fmt(p.gwCg, 1)} %`;
      if (document.activeElement !== $('#pW')) $('#pW').value = Math.round(p.paxWeight);
      if (document.activeElement !== $('#bW')) $('#bW').value = Math.round(p.bagWeight);
      $$('#pRate button').forEach((b) => b.classList.toggle('on', Number(b.dataset.brate) === Math.round(p.rate)));
      $$('#viaSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.via === '1') === viaGsx));
      $('#pRate').hidden = viaGsx;
      const go = $('#pGo'); go.textContent = viaGsx ? 'Boarding per GSX anfordern' : p.boarding ? 'Boarding stoppen' : 'Boarding starten'; go.classList.toggle('stop', !viaGsx && p.boarding);
      $('#pStations').innerHTML = p.seats.map((x) => `<div class="station"><span>${esc(x.name)}</span><div class="sbar"><div class="cur" style="width:${(x.cur / x.cap) * 100}%"></div><div class="des" style="left:${(x.des / x.cap) * 100}%"></div></div><span class="num">${x.cur}/${x.des} <small>von ${x.cap}</small></span></div>`).join('') +
        p.cargo.map((x) => `<div class="station cargo"><span>${esc(x.name)}</span><div class="sbar"><div class="cur" style="width:${(x.cur / x.max) * 100}%"></div><div class="des" style="left:${(x.des / x.max) * 100}%"></div></div><span class="num">${fmt(x.cur)}/${fmt(x.des)} kg</span></div>`).join('');
    } else if (rtab === 'presets') {
      const loading = Math.round(s.preset.loading);
      app.defs.presets.forEach((p) => setTile($(`[data-preset="${p.id}"]`), false, loading === p.id ? 'Wird geladen …' : 'Antippen', loading === p.id ? 'st-4' : null));
      $('#prExp').classList.toggle('on', s.preset.expedite);
      const w = $('#prWarn'); w.hidden = app.sim.onGround !== false; w.textContent = 'Presets gehen nur am Boden.';
    } else if (rtab === 'failures') {
      const active = new Set(s.fbwFailures || []);
      $$('[data-fbwfail]').forEach((b) => b.classList.toggle('on', active.has(Number(b.dataset.fbwfail))));
      if ($('#fbBridge')) $('#fbBridge').hidden = !!(app.sim.lido && app.sim.lido.connected);
    }
  }

  // ---------- Störungsliste ----------
  const ATA = { 21: 'Klima/Druck', 22: 'Autoflug', 24: 'Elektrik', 26: 'Feuerschutz', 27: 'Flugsteuerung', 28: 'Treibstoff', 29: 'Hydraulik', 30: 'Eis/Regen', 31: 'Anzeigen', 32: 'Fahrwerk', 34: 'Navigation', 36: 'Zapfluft', 38: 'Wasser', 46: 'Information', 49: 'APU', 70: 'Triebwerke', 23: 'Kommunikation', 33: 'Licht', 35: 'Sauerstoff', 42: 'Avionik-Netz', 52: 'Türen', 73: 'Triebwerks-Kraftstoff', 77: 'Triebwerks-Anzeigen', 79: 'Öl', 80: 'Anlasser' };
  async function loadFailures() {
    if (!failuresDb) failuresDb = await fetch('data/fbw-failures.json').then((r) => r.json()).catch(() => ({}));
    renderFailures();
  }
  function renderFailures() {
    const list = (failuresDb && failuresDb[(kindDef() || {}).failures]) || [];
    const q = ($('#fbSearch') && $('#fbSearch').value.trim().toLowerCase()) || '';
    const active = new Set(st().fbwFailures || []);
    const groups = {};
    list.filter(([ata, , name]) => !q || name.toLowerCase().includes(q) || (ATA[ata] || '').toLowerCase().includes(q))
      .forEach((f) => { (groups[f[0]] = groups[f[0]] || []).push(f); });
    const el = $('#fbList'); if (!el) return;
    el.innerHTML = Object.keys(groups).map((ata) => `<h4>ATA ${ata} · ${ATA[ata] || ''}</h4><div class="fail-grid">${groups[ata].map(([, id, name]) =>
      `<button class="fail ${active.has(id) ? 'on' : ''}" data-fbwfail="${id}">${esc(name)}</button>`).join('')}</div>`).join('') || '<p class="empty">Nichts gefunden.</p>';
  }

  // ---------- Bedienung ----------
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !t.closest('#tab-efb')) return;
    const s = st();
    if (t.dataset.rtab) { rtab = t.dataset.rtab; store.set('rtab', rtab); skeleton(); return; }
    if (t.id === 'resetDoors') { act('doorReset').then(() => flash('Türzuordnung zurückgesetzt. Tippe die Türen neu an, dann lernt die EFB sie wieder.')); return; }
    if (t.id === 'moreDoors') { const box = $('#gDoors'); if (box) { for (let i = 6; i < 12; i++) if (!box.querySelector(`[data-door="${i}"]`)) box.insertAdjacentHTML('beforeend', `<button class="tile" data-door="${i}"><span class="t-name">Tür ${i + 1}</span><span class="t-state" data-door-st="${i}"></span></button>`); t.hidden = true; update(); } return; }
    if (t.dataset.door !== undefined) act('door', Number(t.dataset.door));
    if (t.dataset.ract) act(t.dataset.ract);
    if (t.id === 'fSet') { const v = Number($('#fIn').value); if (v >= 0) act('fuelTarget', v).then((r) => r.ok && flash(`Ziel ${fmt(v)} kg gesetzt.`)); }
    if (t.id === 'fOfp') {
      const ramp = app.ofp && Number(app.ofp.fuel && app.ofp.fuel.plan_ramp);
      if (!ramp) return flash('Kein OFP geladen.', true);
      const unitLb = app.ofp.params && app.ofp.params.units === 'lbs';
      $('#fIn').value = Math.ceil((unitLb ? ramp * 0.45359237 : ramp) / 100) * 100;
    }
    if (t.dataset.rate !== undefined) act('refuelRate', Number(t.dataset.rate));
    if (t.dataset.via !== undefined) { viaGsx = t.dataset.via === '1'; store.set('viaGsx', viaGsx); update(); return; }
    if (t.id === 'fGo') { if (viaGsx) { const v = Number($('#fIn').value); (v > 0 ? act('fuelTarget', v) : Promise.resolve({ ok: true })).then(() => gsxLoad('refueling', 'Betanken')); } else act('refuel', !s.fuel.refueling); }
    if (t.id === 'pSet') {
      const pax = Number($('#pIn').value), cargo = Number($('#cIn').value || 0);
      if (pax >= 0) act('payloadTarget', { pax, cargo }).then((r) => r.ok && flash(`Ziel: ${pax} PAX, ${fmt(cargo)} kg Zusatzfracht.`));
    }
    if (t.id === 'pSetStd') {
      act('payloadStd', { pax: Number($('#pIn').value || 0), cargo: Number($('#cIn').value || 0), paxW: Number($('#pW').value) || 84, bagW: Number($('#bW').value) || 20, crew: Number($('#crewIn').value) })
        .then((x) => x.ok && flash('Beladung gesetzt.'));
    }
    if (t.id === 'pOfp') {
      const w = app.ofp && app.ofp.weights;
      if (!w) return flash('Kein OFP geladen.', true);
      const unitLb = app.ofp.params && app.ofp.params.units === 'lbs';
      $('#pIn').value = Number(w.pax_count) || 0;
      const freight = Number(w.freight_added) || 0;
      $('#cIn').value = Math.round(unitLb ? freight * 0.45359237 : freight);
    }
    if (t.id === 'wSet') { act('paxWeight', Number($('#pW').value)); act('bagWeight', Number($('#bW').value)); flash('Gewichte gesetzt.'); }
    if (t.dataset.brate !== undefined) act('boardingRate', Number(t.dataset.brate));
    if (t.id === 'pGo') { if (viaGsx) { const pax = $('#pIn').value === '' ? -1 : Number($('#pIn').value); (pax >= 0 ? act('payloadTarget', { pax, cargo: Number($('#cIn').value || 0) }) : Promise.resolve({ ok: true })).then(() => gsxLoad('boarding', 'Boarding')); } else act('boarding', !s.payload.boarding); }
    if (t.dataset.preset) {
      if (confirm('Preset laden? Das Cockpit wird dabei umgeschaltet.')) act('preset', Number(t.dataset.preset));
    }
    if (t.id === 'prExp') act('presetExpedite', !s.preset.expedite);
    if (t.id === 'prCancel') act('preset', 0);
    if (t.dataset.simfail) act('simFailure', t.dataset.simfail).then((r) => r.ok && flash('Störung umgeschaltet.'));
    if (t.dataset.fbwfail) {
      const id = Number(t.dataset.fbwfail);
      act('fbwFailure', { id, active: !(s.fbwFailures || []).includes(id) });
    }
    if (t.id === 'fbClear') act('fbwFailuresClear');
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'fbSearch') renderFailures(); });

  hooks.sim.push(() => {
    const kind = st().kind || null;
    if (kind !== lastKind) { lastKind = kind; if (app.tab === 'efb') skeleton(); return; }
    if (app.tab === 'efb' && kind) {
      if (rtab === 'failures' && !st().std) { const n = (st().fbwFailures || []).length; if (n !== update.n) { update.n = n; renderFailures(); } }
      update();
    }
  });
  hooks.tab.push((name) => { if (name === 'efb') skeleton(); });
  hooks.profile.push(() => { lastKind = undefined; });

  return { skeleton };
})();
