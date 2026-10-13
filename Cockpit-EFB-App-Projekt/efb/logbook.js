// Logbuch: zeichnet Flüge automatisch auf dem PC auf (auch wenn das iPad aus ist)
'use strict';
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const FILE = path.join(__dirname, 'logbook.json');
const ACTIVE = path.join(__dirname, 'logbook-active.json');

const rad = (d) => (d * Math.PI) / 180;
function distNm(a, b, c, d) {
  const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.sqrt(x));
}
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

class Logbook extends EventEmitter {
  // opts: { sim, getOfp(), getSettings(), airports: [{icao,lat,lon}] }
  constructor(opts) {
    super();
    this.o = opts;
    this.entries = [];
    try { this.entries = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { /* neu */ }
    this.cur = null; this.board = {}; this.parkedSince = null; this.stillSince = null; this.firstSeen = true;
    this.recentVs = []; this.prev = null; this.lastSave = 0; this.lastId = null; this.lastIdAt = 0; this.gsxPrev = {};
    try { const a = JSON.parse(fs.readFileSync(ACTIVE, 'utf8')); if (a && a.t && a.t.off) { this.cur = a; this.cur.resumed = true; } } catch { /* nichts offen */ }
    if (opts.sim) opts.sim.on('update', (s) => { try { this._update(s); } catch (e) { console.log('[Logbuch]', e.message); } });
  }

  // ---------- Hilfen ----------
  nearest(lat, lon, maxNm = 15) {
    let best = null, bd = maxNm;
    for (const a of this.o.airports || []) {
      if (Math.abs(a.lat - lat) > 0.6 || Math.abs(a.lon - lon) > 1.2) continue;
      const d = distNm(lat, lon, a.lat, a.lon);
      if (d < bd) { bd = d; best = a.icao; }
    }
    return best;
  }
  persist(force) {
    const now = Date.now();
    if (!force && now - this.lastSave < 20000) return;
    this.lastSave = now;
    try { if (this.cur) fs.writeFileSync(ACTIVE, JSON.stringify(this.cur)); else fs.rmSync(ACTIVE, { force: true }); } catch { /* egal */ }
  }
  save() {
    const max = (this.o.getSettings().logbook || {}).max || 1000;
    this.entries.sort((a, b) => (b.t.off || 0) - (a.t.off || 0));
    if (this.entries.length > max) this.entries.length = max;
    try { fs.writeFileSync(FILE, JSON.stringify(this.entries)); } catch (e) { console.log('[Logbuch] Speichern fehlgeschlagen:', e.message); }
    this.emit('change');
  }

  // ---------- Verarbeitung der Sim-Daten ----------
  _gsxEdges(s, now) {
    const g = s.gsx || {}, v = s.vars || {};
    const edge = (key, cur) => { const was = this.gsxPrev[key]; this.gsxPrev[key] = cur; return { start: cur === 5 && was !== 5, end: cur === 6 && was === 5 }; };
    const b = edge('boarding', g.boarding);
    const rf = edge('refueling', g.refueling);
    const de = edge('deboarding', g.deboarding);
    const ca = edge('catering', g.catering);
    // ohne GSX: Boarding des Remote-EFB (FBW/Headwind)
    const ef = (v['L:A32NX_BOARDING_STARTED_BY_USR'] > 0) ? 5 : (this.gsxPrev.efbBoard === 5 ? 6 : undefined);
    const eb = edge('efbBoard', ef);
    const bs = b.start || eb.start, be = b.end || eb.end;
    const sv = this.board;
    if (bs) { sv.boardStart = now; sv.boardEnd = null; }
    if (be) { sv.boardEnd = now; if (g.paxBoarding > 0) sv.pax = g.paxBoarding; }
    if (rf.start) { sv.fuelStart = now; sv.fuelEnd = null; } if (rf.end) sv.fuelEnd = now;
    if (ca.start) sv.cateringStart = now; if (ca.end) sv.cateringEnd = now;
    if (de.start) sv.deboardStart = now;
    if (de.end) {
      sv.deboardEnd = now;
      // Deboarding nach dem Flug: dem gerade abgeschlossenen Eintrag zuordnen
      const e = this.entries.find((x) => x.id === this.lastId);
      if (e && now - this.lastIdAt < 45 * 60000 && sv.deboardStart) { e.t.deb0 = sv.deboardStart; e.t.deb1 = now; this.save(); }
    }
  }

  _update(s) {
    if (s.lat == null || !s.connected) return;
    const now = Date.now(), gs = s.gs || 0, air = !s.onGround;
    this._gsxEdges(s, now);

    if (!this.cur) {
      if (air && this.firstSeen) { this._start(s, now, true); }
      else if (!air) {
        if (gs < 1) { if (this.parkedSince === null) this.parkedSince = now; }
        else if (gs > 3 && (this.firstSeen || (this.parkedSince !== null && now - this.parkedSince > 8000))) this._start(s, now, false);
        else if (gs >= 1) { /* rollt, aber noch nicht klar */ }
      }
      this.firstSeen = false;
      if (!this.cur) { this.prev = { lat: s.lat, lon: s.lon, at: now }; return; }
    }
    this.firstSeen = false;
    const c = this.cur;

    // Strecke und Höhe
    if (this.prev && air) { const d = distNm(this.prev.lat, this.prev.lon, s.lat, s.lon); if (d < 5) c.dist = (c.dist || 0) + d; }
    this.prev = { lat: s.lat, lon: s.lon, at: now };
    if (air && s.alt > (c.maxAlt || 0)) c.maxAlt = Math.round(s.alt);
    if (air) { this.recentVs.push([now, s.vs]); while (this.recentVs.length && now - this.recentVs[0][0] > 2500) this.recentVs.shift(); }
    if (num(s.fuelKg) != null && air) c.fuelNow = Math.round(s.fuelKg);

    // Abheben
    if (air && !c.air && gs > 40) {
      if (c.t.ldg && now - c.t.ldg < 120000) { c.t.ldg = null; c.touchGo = (c.touchGo || 0) + 1; c.landed = false; } // Durchstarten / Touch and Go
      else { c.t.to = now; c.dep = c.dep || this.nearest(s.lat, s.lon); c.tow = num(s.weightKg) != null ? Math.round(s.weightKg) : c.tow; c.fuelTo = num(s.fuelKg) != null ? Math.round(s.fuelKg) : null; }
      c.air = true; this.persist(true);
    } else if (air && !c.air && c.partial && !c.t.to) { c.t.to = now; c.air = true; }

    // Landung
    if (!air && c.air) {
      c.air = false; c.landed = true; c.t.ldg = now;
      const v = this.recentVs.map((x) => x[1]).filter((x) => Number.isFinite(x));
      c.tdVs = v.length ? Math.round(Math.min(...v)) : null;
      c.arr = this.nearest(s.lat, s.lon, 20) || c.arr;
      c.ldw = num(s.weightKg) != null ? Math.round(s.weightKg) : null;
      this.persist(true);
    }

    // Stillstand nach der Landung -> On-Block
    if (!air && c.landed) {
      if (gs < 1) {
        if (this.stillSince === null) this.stillSince = now;
        const still = now - this.stillSince;
        if ((s.parkingBrake && still > 30000) || still > 180000) { this._finish(s, this.stillSince); return; }
      } else this.stillSince = null;
    }
    // Rollen ohne Flug: wieder geparkt -> Entwurf verwerfen
    if (!air && !c.t.to && !c.landed) {
      if (gs < 1) { if (this.stillSince === null) this.stillSince = now; if (now - this.stillSince > 180000) { this.cur = null; this.parkedSince = this.stillSince; this.stillSince = null; this.persist(true); } }
      else this.stillSince = null;
    }
    this.persist(false);
  }

  _start(s, now, partial) {
    const ofp = this.o.getOfp() || null, st = this.o.getSettings();
    const near = this.nearest(s.lat, s.lon, 20);
    let useOfp = !!ofp;
    // Passt der OFP zum Standort? Sonst nicht übernehmen
    if (ofp && ofp.origin && ofp.origin.pos_lat && !partial) {
      const d = distNm(s.lat, s.lon, Number(ofp.origin.pos_lat), Number(ofp.origin.pos_long));
      if (d > 40) useOfp = false;
    }
    const o = useOfp ? ofp : null;
    const airline = this._airline(o, st);
    this.cur = {
      id: now.toString(36), partial, airline: airline ? airline.id : '', airlineName: airline ? airline.name : '',
      callsign: o && o.atc ? o.atc.callsign || '' : '', reg: o && o.aircraft ? o.aircraft.reg || '' : '',
      type: o && o.aircraft ? o.aircraft.icaocode || '' : '', title: s.title || '',
      dep: (o && o.origin && o.origin.icao_code) || near || '', arr: (o && o.destination && o.destination.icao_code) || '',
      alt: (o && o.alternate && o.alternate.icao_code) || '', route: o && o.general ? o.general.route || '' : '',
      planBlock: o && o.times ? Math.round(Number(o.times.est_block) / 60) || null : null,
      planNm: o && o.general ? Number(o.general.air_distance) || null : null,
      cruise: o && o.general ? Number(o.general.initial_altitude) || null : null,
      pax: this.board.pax || (o && o.weights ? Number(o.weights.pax_count) || null : null),
      fuelStart: num(s.fuelKg) != null ? Math.round(s.fuelKg) : null, wOff: num(s.weightKg) != null ? Math.round(s.weightKg) : null,
      metarDep: o && o.weather ? o.weather.orig_metar || '' : '', metarArr: o && o.weather ? o.weather.dest_metar || '' : '',
      t: { off: now, board0: this.board.boardStart || null, board1: this.board.boardEnd || null, fuel0: this.board.fuelStart || null, fuel1: this.board.fuelEnd || null },
      dist: 0, maxAlt: 0, air: false, landed: false,
    };
    if (partial) { this.cur.t.off = now; this.cur.air = true; this.cur.t.to = now; }
    this.stillSince = null; this.parkedSince = null; this.recentVs = []; this.persist(true);
  }

  _airline(ofp, st) {
    const list = st.airlines || [];
    if (st.autoAirline && ofp && ofp.general && ofp.general.icao_airline) {
      const hit = list.find((a) => a.icao && a.icao === String(ofp.general.icao_airline).toUpperCase());
      if (hit) return hit;
    }
    return list.find((a) => a.id === st.activeAirline) || null;
  }

  _finish(s, still) {
    const c = this.cur; this.cur = null; this.stillSince = null; this.parkedSince = still; this.recentVs = [];
    c.t.on = still;
    const air = c.t.to && c.t.ldg ? (c.t.ldg - c.t.to) / 60000 : 0;
    if (!c.t.to || !c.t.ldg || air * (Number(process.env.DEMO_TIME_SCALE) || 1) < 1.5) { this.persist(true); return; } // zu kurz oder unvollständig: kein Eintrag
    c.fuelEnd = num(s.fuelKg) != null ? Math.round(s.fuelKg) : null;
    if (!c.arr) c.arr = this.nearest(s.lat, s.lon, 20) || '';
    const e = { ...c, dist: Math.round(c.dist || 0) }; delete e.air; delete e.landed; delete e.fuelNow; delete e.resumed;
    e.rating = 0; e.notes = ''; e.manual = false;
    this.entries.unshift(e); this.lastId = e.id; this.lastIdAt = Date.now();
    this.board = {}; this.persist(true); this.save();
  }

  // ---------- Schnittstelle ----------
  active() {
    const c = this.cur; if (!c) return null;
    return { dep: c.dep, arr: c.arr, callsign: c.callsign, phase: c.landed ? 'landed' : c.air ? 'air' : c.t.to ? 'ground' : 'taxi', off: c.t.off, dist: Math.round(c.dist || 0), airline: c.airlineName };
  }
  list() { return this.entries; }
  size() { try { return fs.statSync(FILE).size; } catch { return 0; } }
  add(e) {
    const t = e.t || {};
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const off = Number(t.off) || Date.now(), blk = Math.max(0, Number(e.blockMin) || 0) * 60000;
    const entry = {
      id, manual: true, partial: false, airline: String(e.airline || ''), airlineName: String(e.airlineName || '').slice(0, 40), callsign: String(e.callsign || '').slice(0, 12).toUpperCase(),
      reg: String(e.reg || '').slice(0, 10).toUpperCase(), type: String(e.type || '').slice(0, 8).toUpperCase(), title: '', dep: String(e.dep || '').slice(0, 4).toUpperCase(), arr: String(e.arr || '').slice(0, 4).toUpperCase(),
      alt: '', route: String(e.route || '').slice(0, 400), planBlock: null, planNm: null, cruise: null, pax: Number(e.pax) || null,
      t: { off, to: blk ? off + 10 * 60000 : null, ldg: blk ? off + blk - 8 * 60000 : null, on: blk ? off + blk : null },
      dist: Number(e.dist) || 0, maxAlt: 0, rating: Math.max(0, Math.min(5, Number(e.rating) || 0)), notes: String(e.notes || '').slice(0, 1000),
    };
    this.entries.unshift(entry); this.save(); return entry;
  }
  update(id, patch) {
    const e = this.entries.find((x) => x.id === id); if (!e) return null;
    if ('notes' in patch) e.notes = String(patch.notes || '').slice(0, 1000);
    if ('rating' in patch) e.rating = Math.max(0, Math.min(5, Number(patch.rating) || 0));
    if ('airline' in patch) { e.airline = String(patch.airline || ''); e.airlineName = String(patch.airlineName || '').slice(0, 40); }
    for (const k of ['type', 'reg', 'callsign']) if (k in patch) e[k] = String(patch[k] || '').slice(0, 10).toUpperCase();
    this.save(); return e;
  }
  remove(ids) {
    const set = new Set(ids.map(String)), n = this.entries.length;
    this.entries = this.entries.filter((e) => !set.has(e.id)); this.save(); return n - this.entries.length;
  }
  prune({ olderThanDays, airline, all }) {
    const n = this.entries.length, lim = olderThanDays ? Date.now() - olderThanDays * 86400000 : null;
    this.entries = this.entries.filter((e) => {
      if (all) return false;
      if (airline !== undefined && airline !== null && airline !== '__none') { if (e.airline !== airline) return true; return lim ? (e.t.off || 0) >= lim : false; }
      return lim ? (e.t.off || 0) >= lim : true;
    });
    this.save(); return n - this.entries.length;
  }
  csv() {
    const f = (ms) => (ms ? new Date(ms).toISOString() : '');
    const head = ['Datum', 'Airline', 'Flugnummer', 'Typ', 'Kennzeichen', 'Von', 'Nach', 'OffBlock', 'Start', 'Landung', 'OnBlock', 'Block_min', 'Luft_min', 'Distanz_nm', 'Max_ft', 'Pax', 'Treibstoff_kg', 'Landerate_fpm', 'TOW_kg', 'LDW_kg', 'Bewertung', 'Notiz'];
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const rows = this.entries.map((e) => [new Date(e.t.off).toISOString().slice(0, 10), e.airlineName, e.callsign, e.type, e.reg, e.dep, e.arr, f(e.t.off), f(e.t.to), f(e.t.ldg), f(e.t.on),
      e.t.on && e.t.off ? Math.round((e.t.on - e.t.off) / 60000) : '', e.t.ldg && e.t.to ? Math.round((e.t.ldg - e.t.to) / 60000) : '', e.dist, e.maxAlt, e.pax || '',
      e.fuelStart != null && e.fuelEnd != null ? e.fuelStart - e.fuelEnd : '', e.tdVs ?? '', e.tow || '', e.ldw || '', e.rating || '', e.notes]);
    return '﻿' + [head, ...rows].map((r) => r.map(q).join(';')).join('\r\n');
  }
}
module.exports = { Logbook, distNm };
