// Mehr Leben im Flug: Rollweg-Ansagen, Verkehrshinweise (VATSIM) und Callouts beim Start und Sinkflug.
// Läuft nur im Copilot-Fenster am PC, nur wenn der Copilot an und nicht stumm ist.
(function () {
  const HOST = /[?&]host=1\b/.test(location.search);
  if (!HOST) return;
  const core = () => window.Copilot && window.Copilot._core;
  const on = (k) => { const c = core(); return !!c && (!c.pref.life || c.pref.life[k] !== false); }; // Standard: alles an
  const ready = () => { const c = core(); return !!c && c.S.on && !c.isMuted() && !c.S.speaking && c.S.mode !== 'gsxMenu'; };
  // Verkehrshinweise schweigen bei Checklisten und solange die Bodencrew spricht (Pushback, GSX-Menü)
  const crewBusy = () => { const c = core(); if (!c) return false; const m = String(c.S.mode || ''); return m === 'run' || m.startsWith('ask') || m === 'gsxMenu' || !!c.pbOn() || !!c.pushBusy(); };
  const sim = () => app.sim || {};
  const de = () => (core() ? core().pref.lang === 'de' : true);
  const say = (t, l) => core().say(t, l);
  const done = new Set();       // schon angesagt (pro Rollweg-Abschnitt usw.)
  let lastTalk = 0;             // letzte Ansage dieses Moduls
  const quiet = (ms) => Date.now() - lastTalk > ms;
  const talk = (t, l) => { lastTalk = Date.now(); return say(t, l); };
  // Callouts nacheinander sprechen; Veraltetes (älter als 5 s) verwerfen
  let chain = Promise.resolve();
  const callout = (t, l) => { const t0 = Date.now(); chain = chain.then(() => (Date.now() - t0 < 5000 && core() && !core().isMuted() ? say(t, l) : null)).catch(() => {}); };

  // ---------- Rollweg-Ansagen ----------
  const nameSay = (ref) => '{{' + core().spoken(ref) + '}}'; // englische Aussprache auch im deutschen Satz
  let offSince = 0, offSaid = 0;
  async function taxiTick() {
    const s = sim(); if (!on('taxi') || !s.connected || !s.onGround || !TaxiNav) return;
    const plan = TaxiNav.activePlan(); if (!plan || !plan.route.length) return;
    if (!isFinite(plan.lat) || !isFinite(plan.lon)) return;
    if (!TaxiNav.data[plan.icao]) { TaxiNav.ensure(plan.icao, plan.lat, plan.lon); return; }
    const gs = s.gs || 0; if (gs < 1.5 || gs > 40) return;
    const st = TaxiNav.compute(plan, { lat: s.lat, lon: s.lon, hdg: s.hdg, gs });
    if (!st || st.missing) { if (st && st.missing && !done.has(plan.key + ':miss') && ready()) { done.add(plan.key + ':miss'); talk(de() ? `Den Rollweg ${st.missing.join(', ')} finde ich in den Kartendaten nicht.` : `I cannot find taxiway ${st.missing.join(', ')} in the map data.`); } return; }
    if (!ready()) return;
    const c = core(), rw = plan.rwy ? (c.rwyTxt(plan.rwy.match(/^(\d{1,2})([LRC]?)/) ? { n: parseInt(plan.rwy, 10), side: (plan.rwy.match(/[LRC]$/) || [''])[0] } : { n: 0, side: '' })) : '';
    // Beginn des Rollens: ganze Route einmal nennen
    if (!done.has(plan.key + ':start')) {
      done.add(plan.key + ':start');
      const list = st.toks.map(nameSay).join(', ');
      return talk(de() ? `Rollweg über ${list}${plan.mode === 'dep' && rw ? `, Piste ${rw}` : ''}.` : `Taxi via ${list}${plan.mode === 'dep' && rw ? `, runway ${rw}` : ''}.`);
    }
    // Abseits der Route?
    if (!st.onRoute && st.cur >= 0 && gs > 3) { offSince = offSince || Date.now(); if (Date.now() - offSince > 15000 && Date.now() - offSaid > 90000) { offSaid = Date.now(); return talk(de() ? 'Achtung, wir sind nicht mehr auf dem geplanten Rollweg.' : 'Careful, we are off the planned taxi route.'); } } else offSince = 0;
    if (st.cur < 0 || st.distToJ == null) return;
    const k = plan.key + ':' + st.cur;
    // Vorlauf: Sprachausgabe braucht Zeit (Berechnung + Sprechen) – früher ansagen, je schneller wir rollen; Satz vorher schon berechnen lassen
    const lead = Math.min(320, Math.max(130, 45 + 12 * gs * 0.514));
    const turnTxt = () => { const dir = st.turn === 'straight' ? (de() ? 'geradeaus weiter auf' : 'continue straight onto') : st.turn === 'left' ? (de() ? (st.sharp ? 'scharf links auf' : 'links auf') : (st.sharp ? 'sharp left onto' : 'turn left onto')) : (de() ? (st.sharp ? 'scharf rechts auf' : 'rechts auf') : (st.sharp ? 'sharp right onto' : 'turn right onto')); return de() ? `Gleich ${dir} Taxiway ${nameSay(st.next)}.` : `Next, ${dir} taxiway ${nameSay(st.next)}.`; };
    if (!st.atEnd && st.next && st.turn && !done.has(k + ':pf') && st.distToJ < lead + 250) { done.add(k + ':pf'); try { c.prefetch(turnTxt(), undefined); } catch (e) { /* egal */ } }
    if (st.holdAhead && !st.holdAhead.rwy && st.holdAhead.dist < lead && !done.has(k + ':th' + st.holdAhead.ref)) { done.add(k + ':th' + st.holdAhead.ref); return talk(de() ? `Gleich Halt vor Taxiway ${nameSay(st.holdAhead.ref)}.` : `Hold short of taxiway ${nameSay(st.holdAhead.ref)}.`); }
    if (st.atEnd) {
      if (st.hold && st.holdKind !== 'twy' && st.distToJ < Math.max(90, lead * 0.8) && !done.has(k + ':hold')) { done.add(k + ':hold'); return talk(de() ? `Gleich Halt vor Piste ${rw || ''}.` : `Hold short of runway ${rw || ''}.`); }
      return;
    }
    if (st.distToJ < lead && st.next && !done.has(k)) { done.add(k); return talk(turnTxt()); }
  }

  // ---------- Verkehr (VATSIM) ----------
  const seenTraffic = {}; let trafficAt = 0, vats = [], vatsAt = 0, vatsBusy = false;
  const rel = (s, p) => { const dy = (p.lat - s.lat) * 110540, dx = (p.lon - s.lon) * 111320 * Math.cos(s.lat * Math.PI / 180); return { d: Math.hypot(dx, dy), b: ((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360 }; };
  async function loadVats() {
    const s = sim(); if (vatsBusy || Date.now() - vatsAt < 20000 || !s.connected || !isFinite(s.lat)) return;
    vatsBusy = true; vatsAt = Date.now();
    try { const r = await fetch(`/api/vatsim?bbox=${[s.lat - 0.15, s.lon - 0.25, s.lat + 0.15, s.lon + 0.25].map((x) => x.toFixed(3)).join(',')}`); const j = await r.json(); vats = j.pilots || []; } catch { vats = []; }
    vatsBusy = false;
  }
  const me = () => (app.ofp && app.ofp.atc && app.ofp.atc.callsign) || '';
  function csSay(cs) { return String(cs).replace(/^([A-Z]{3})(\d)/, '$1 $2').replace(/(\d)/g, ' $1').replace(/\s+/g, ' ').trim(); }
  const dest = (p) => (p.arr ? (de() ? ` nach ${p.arr}` : ` to ${p.arr}`) : '');
  // Verlauf des Fremdflugzeugs relativ zu uns: gleiche Richtung, entgegen, kreuzend
  const course = (s, p) => { if (p.hdg == null || (p.gs || 0) < 30) return ''; const d = Math.abs(((p.hdg - s.hdg + 540) % 360) - 180); return d < 30 ? (de() ? 'ähnlicher Kurs' : 'same direction') : d > 150 ? (de() ? 'entgegenkommend' : 'opposite direction') : (de() ? 'kreuzend' : 'crossing'); };
  const fl = (a) => (a >= 5000 ? 'FL' + String(Math.round(a / 100)).padStart(3, '0') : Math.round(a / 100) * 100 + ' ft');
  async function trafficTick() {
    const s = sim(); if (!on('traffic') || !s.connected || !isFinite(s.lat)) return;
    loadVats();
    if (!ready() || crewBusy() || !quiet(30000) || Date.now() - trafficAt < 75000 || !vats.length) return;
    const myCs = me(), nowT = Date.now();
    const fresh = (p) => !seenTraffic[p.cs] || nowT - seenTraffic[p.cs] > 10 * 60000;
    if (s.onGround && (s.gs || 0) < 45) { // am Boden: Flugzeug vor uns, auf gleicher Höhe, wenige hundert Meter
      const c = vats.filter((p) => p.cs !== myCs && fresh(p) && Math.abs(p.alt - s.alt) < 150).map((p) => ({ p, r: rel(s, p) }))
        .filter((x) => x.r.d < 600 && x.r.d > 25 && Math.abs(((x.r.b - s.hdg + 540) % 360) - 180) < 70).sort((a, b) => a.r.d - b.r.d)[0];
      if (c && Math.random() < 0.6) { seenTraffic[c.p.cs] = nowT; trafficAt = nowT; const dm = Math.round(c.r.d / 10) * 10, mv = (c.p.gs || 0) > 3 ? (de() ? `, rollt mit ${Math.round(c.p.gs)} Knoten` : `, taxiing at ${Math.round(c.p.gs)} knots`) : (de() ? ', steht' : ', holding');
        return talk(de() ? `Vor uns, ${dm} Meter: ${csSay(c.p.cs)}${c.p.type ? ', ' + c.p.type : ''}${dest(c.p)}${mv}.` : `Ahead of us, ${dm} meters: ${csSay(c.p.cs)}${c.p.type ? ', ' + c.p.type : ''}${dest(c.p)}${mv}.`); }
    } else if (!s.onGround) { // in der Luft: Verkehr in der Nähe
      const c = vats.filter((p) => p.cs !== myCs && fresh(p) && Math.abs(p.alt - s.alt) < 1200).map((p) => ({ p, r: rel(s, p) })).filter((x) => x.r.d < 11000 && x.r.d > 500).sort((a, b) => a.r.d - b.r.d)[0];
      if (c && Math.random() < 0.5) {
        seenTraffic[c.p.cs] = nowT; trafficAt = nowT;
        const oc = Math.round((((c.r.b - s.hdg + 360) % 360)) / 30) % 12 || 12, dh = c.p.alt - s.alt, vh = Math.abs(dh) < 300 ? (de() ? 'gleiche Höhe' : 'same altitude') : dh > 0 ? (de() ? `${Math.round(dh / 100) * 100} Fuß höher` : `${Math.round(dh / 100) * 100} feet above`) : (de() ? `${Math.round(-dh / 100) * 100} Fuß tiefer` : `${Math.round(-dh / 100) * 100} feet below`);
        const cr = course(s, c.p), nm = Math.max(1, Math.round(c.r.d / 1852));
        return talk(de() ? `Verkehr, ${oc} Uhr, ${nm} Meilen, ${vh}${cr ? ', ' + cr : ''}. ${csSay(c.p.cs)}${c.p.type ? ', ' + c.p.type : ''}${dest(c.p)}, ${fl(c.p.alt)}.` : `Traffic, ${oc} o'clock, ${nm} miles, ${vh}${cr ? ', ' + cr : ''}. ${csSay(c.p.cs)}${c.p.type ? ', ' + c.p.type : ''}${dest(c.p)}, ${fl(c.p.alt)}.`);
      }
    }
  }

  // ---------- Callouts: Start und Sinkflug ----------
  const call = { eighty: false, v1: false, rot: false, pos: false, up10: false, dn10: false, lastAlt: null };
  function callTick() {
    const s = sim(); if (!on('calls') || !s.connected) return;
    const c = core(); if (!c || !c.S.on || c.isMuted()) return;
    const P = window.PerfLast || {}, ias = s.ias || 0;
    if (s.onGround && (s.gs || 0) < 5) { call.eighty = call.v1 = call.rot = call.pos = false; }
    if (s.onGround && (s.gs || 0) > 40 && ias > 20) { // Startlauf
      if (!call.eighty && ias >= 80) { call.eighty = true; callout(de() ? 'Achtzig Knoten.' : 'Eighty knots.'); }
      else if (!call.v1 && P.v1 && ias >= P.v1) { call.v1 = true; callout('V1.', 'en'); }
      else if (!call.rot && P.vr && ias >= P.vr) { call.rot = true; callout('Rotate.', 'en'); }
    }
    if (!s.onGround && call.rot && !call.pos && (s.vs || 0) > 300) { call.pos = true; callout(de() ? 'Positive Steigrate.' : 'Positive rate.'); }
    // 10.000 Fuß
    const a = s.alt || 0;
    if (call.lastAlt !== null && !s.onGround) {
      if (call.lastAlt < 10000 && a >= 10000 && !call.up10) { call.up10 = true; call.dn10 = false; callout(de() ? 'Zehntausend Fuß. Landescheinwerfer aus.' : 'Ten thousand feet. Landing lights off.'); }
      if (call.lastAlt > 10000 && a <= 10000 && (s.vs || 0) < -300 && !call.dn10) { call.dn10 = true; call.up10 = false; callout(de() ? 'Zehntausend Fuß. Landescheinwerfer an.' : 'Ten thousand feet. Landing lights on.'); }
    }
    call.lastAlt = a;
  }

  setInterval(() => { try { taxiTick(); trafficTick(); } catch (e) { /* weiter */ } }, 1500);
  setInterval(() => { try { callTick(); } catch (e) { /* weiter */ } }, 500);
  window.CopilotLife = { done, taxiTick, trafficTick };
})();
