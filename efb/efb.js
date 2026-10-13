// Remote-EFB für FBW A32NX, FBW A380X und Headwind A339X sowie ein einfaches Standard-EFB (Boeing & Co.)
//
// Steuert die Flieger über dieselben Variablen, die auch das flyPad benutzt
// (Quellen: FlyByWire-Repository flybywiresim/aircraft und headwindsim/aircraft).

const fs = require('fs');
const path = require('path');

const DEFS = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'aircraft.json'), 'utf8'));

const TANKS = {
  center: 'FUEL TANK CENTER QUANTITY',
  lMain: 'FUEL TANK LEFT MAIN QUANTITY',
  rMain: 'FUEL TANK RIGHT MAIN QUANTITY',
  lAux: 'FUEL TANK LEFT AUX QUANTITY',
  rAux: 'FUEL TANK RIGHT AUX QUANTITY',
};

// ---------- Sitz-Belegung: so codiert das flyPad die Sitze ----------
// Pro Station eine Zahl; Sitz n liegt in Wort floor(n/31), Bit n%31.
// Wert = hohesWort * 2^32 + niedrigesWort
function decodeSeats(value) {
  const v = Math.max(0, Number(value) || 0);
  const high = Math.floor(v / 2 ** 32);
  const low = v - high * 2 ** 32;
  return [low >>> 0, high >>> 0];
}
function encodeSeats([low, high]) { return (high >>> 0) * 2 ** 32 + (low >>> 0); }
function seatIsSet(words, i) { return ((words[Math.floor(i / 31)] >>> (i % 31)) & 1) === 1; }
function seatToggle(words, i) { words[Math.floor(i / 31)] = (words[Math.floor(i / 31)] ^ (1 << (i % 31))) >>> 0; }
function countSeats(value, cap) {
  const w = decodeSeats(value);
  let n = 0;
  for (let i = 0; i < cap; i++) if (seatIsSet(w, i)) n++;
  return n;
}
// Füllt/leert zufällig Sitze, bis "target" erreicht ist (wie das flyPad)
function adjustSeats(value, cap, target) {
  const w = decodeSeats(value);
  const filled = [], empty = [];
  for (let i = 0; i < cap; i++) (seatIsSet(w, i) ? filled : empty).push(i);
  const pick = (arr, n) => { for (let k = 0; k < n && arr.length; k++) seatToggle(w, arr.splice(Math.floor(Math.random() * arr.length), 1)[0]); };
  if (target > filled.length) pick(empty, target - filled.length);
  else if (target < filled.length) pick(filled, filled.length - target);
  return encodeSeats(w);
}

class Efb {
  constructor(sim) {
    this.sim = sim;
    this.kind = null;
    this.failureQueue = null; // wird vom In-Sim-Modul abgeholt (FBW-Störungen)
    this.activeFbwFailures = new Set();
    this.stdCrew = 2;      // Stationen, die als Besatzung gelten (werden bei der Beladung nicht angefasst)
    this.stdTarget = null;
    this.doorMsg = null;
    this.extra = [];   // zusätzliche Variablen (z. B. Lichter in der privaten Version)
    this.doorFile = path.join(__dirname, 'cache', 'doormap.json');
    try { this.doorMaps = JSON.parse(fs.readFileSync(this.doorFile, 'utf8')); } catch { this.doorMaps = {}; }
  }

  // Welche Tür (EXIT OPEN:n) öffnet sich wirklich, wenn man „Tür k“ auslöst? Wird beim ersten Antippen gelernt.
  _doorKey() { return `${this.kind}|${this.sim.state.title || ''}`; }
  _doorMap() { return this.doorMaps[this._doorKey()] || {}; }
  _doorIdx(i) { return this._doorMap()[i] || (i + 1); }
  _doorToggle(i) {
    const s = this.sim, v = () => s.state.vars || {};
    const snap = Array.from({ length: 8 }, (_, n) => Number(v()[`EXIT OPEN:${n + 1}`]) || 0);
    const ok = s.sendEvent('TOGGLE_AIRCRAFT_EXIT', i + 1);
    const check = (final) => {
      let best = 0, at = 0;
      snap.forEach((b, n) => { const dlt = Math.abs((Number(v()[`EXIT OPEN:${n + 1}`]) || 0) - b); if (dlt > best) { best = dlt; at = n + 1; } });
      if (best > 0.02) {
        const m = { ...this._doorMap() }; m[i] = at; this.doorMaps[this._doorKey()] = m;
        try { fs.mkdirSync(path.dirname(this.doorFile), { recursive: true }); fs.writeFileSync(this.doorFile, JSON.stringify(this.doorMaps)); } catch { /* egal */ }
        return true;
      }
      if (final) this.doorMsg = { text: `Tür ${i + 1}: keine Reaktion im Sim. Manche Add-ons steuern Türen nur im Cockpit oder per GSX.`, until: Date.now() + 9000 };
      return false;
    };
    setTimeout(() => { if (!check(false)) setTimeout(() => check(true), 2500); }, 1200);
    return ok;
  }

  def() { return this.kind ? DEFS.kinds[this.kind] : null; }

  setKind(kind) {
    this.kind = DEFS.kinds[kind] ? kind : null;
    this._applyWatch();
    return this.kind;
  }

  _applyWatch() {
    const w = this.kind ? this.watchList() : [];
    for (const x of this.extra || []) if (!w.some((y) => y.name === x.name)) w.push(x);
    this.sim.setWatch(w);
  }

  watchList() {
    const d = this.def();
    const w = [];
    const add = (name, unit = 'number') => { if (!w.some((x) => x.name === name)) w.push({ name, unit }); };
    // Fuel
    add('FUEL WEIGHT PER GALLON', 'kilograms');
    if (d.std) {
      Object.values(TANKS).forEach((t) => { add(t, 'gallons'); add(t.replace('QUANTITY', 'CAPACITY'), 'gallons'); });
      for (let i = 1; i <= 8; i++) add(`EXIT OPEN:${i}`, 'percent over 100');
      add('PAYLOAD STATION COUNT'); add('MAX GROSS WEIGHT', 'kilograms'); add('EMPTY WEIGHT', 'kilograms'); add('TOTAL WEIGHT', 'kilograms');
      for (let i = 1; i <= 24; i++) add(`PAYLOAD STATION WEIGHT:${i}`, 'kilograms');
      add('PUSHBACK ATTACHED', 'bool');
      for (let i = 1; i <= 4; i++) add(`ENG COMBUSTION:${i}`, 'bool');
      return w;
    }
    if (d.fuel.mode === 'tanks5') {
      Object.values(TANKS).forEach((t) => add(t, 'gallons'));
      ['CENTER', 'LEFT_MAIN', 'RIGHT_MAIN', 'LEFT_AUX', 'RIGHT_AUX'].forEach((t) => add(`L:A32NX_FUEL_${t}_DESIRED`));
      add('L:A32NX_FUEL_TOTAL_DESIRED');
      if (!d.fuel.fixed) {
        add('FUEL TANK CENTER CAPACITY', 'gallons'); add('FUEL TANK LEFT MAIN CAPACITY', 'gallons'); add('FUEL TANK LEFT AUX CAPACITY', 'gallons');
      }
    } else {
      add('L:A32NX_TOTAL_FUEL_QUANTITY'); add('L:A32NX_FUEL_DESIRED');
    }
    add('L:A32NX_REFUEL_STARTED_BY_USR'); add('L:A32NX_EFB_REFUEL_RATE_SETTING');
    // Payload
    d.seats.forEach((s) => { add(`L:${s.var}`); add(`L:${s.var}_DESIRED`); });
    d.cargo.forEach((c) => { add(`L:${c.var}`); add(`L:${c.var}_DESIRED`); });
    ['L:A32NX_WB_PER_PAX_WEIGHT', 'L:A32NX_WB_PER_BAG_WEIGHT', 'L:A32NX_BOARDING_STARTED_BY_USR', 'L:A32NX_BOARDING_RATE',
      'L:A32NX_AIRFRAME_ZFW', 'L:A32NX_AIRFRAME_GW', 'L:A32NX_AIRFRAME_ZFW_CG_PERCENT_MAC', 'L:A32NX_AIRFRAME_GW_CG_PERCENT_MAC',
      'L:A32NX_AIRFRAME_ZFW_DESIRED', 'L:A32NX_AIRFRAME_GW_DESIRED'].forEach((v) => add(v));
    // Boden
    d.doors.forEach((door) => add(`INTERACTIVE POINT OPEN:${door.point}`, 'percent over 100'));
    if (d.fuelPoint !== null) add(`INTERACTIVE POINT OPEN:${d.fuelPoint}`, 'percent over 100');
    for (let i = 1; i <= d.gpus; i++) add(`L:A32NX_EXT_PWR_AVAIL:${i}`);
    add('EXTERNAL POWER AVAILABLE:1', 'bool'); // Standardvariable: Rückfall, falls der Flieger (z. B. Headwind) die A32NX-Variable nicht pflegt
    if (d.asu) add('L:A32NX_ASU_TURNED_ON');
    ['L:A32NX_GND_EQP_IS_VISIBLE', 'L:A32NX_MODEL_WHEELCHOCKS_ENABLED', 'L:A32NX_MODEL_CONES_ENABLED',
      'L:A32NX_AIRCRAFT_PRESET_LOAD', 'L:A32NX_AIRCRAFT_PRESET_LOAD_EXPEDITE', 'L:A32NX_IS_STATIONARY'].forEach((v) => add(v));
    add('PUSHBACK ATTACHED', 'bool');
    add('ENG COMBUSTION:1', 'bool'); add('ENG COMBUSTION:2', 'bool');
    return w;
  }

  // Aufbereiteter Zustand für das iPad
  status() {
    const d = this.def();
    if (!d) return { kind: null };
    const v = this.sim.state.vars || {};
    const g = (n, def = 0) => (v[n] === undefined ? def : Number(v[n]));
    const kgPerGal = g('FUEL WEIGHT PER GALLON', 3.039) || 3.039;
    if (d.std) return this._stdStatus(d, g, kgPerGal);

    let fuel;
    if (d.fuel.mode === 'tanks5') {
      const cap = this._caps();
      const curGal = Object.values(TANKS).reduce((s, t) => s + g(t), 0);
      const desGal = ['CENTER', 'LEFT_MAIN', 'RIGHT_MAIN', 'LEFT_AUX', 'RIGHT_AUX'].reduce((s, t) => s + g(`L:A32NX_FUEL_${t}_DESIRED`), 0);
      fuel = {
        currentKg: curGal * kgPerGal, desiredKg: desGal * kgPerGal,
        maxKg: (cap.center + 2 * cap.inner + 2 * cap.outer) * kgPerGal,
        tanks: [
          { name: 'Links außen', cur: g(TANKS.lAux) * kgPerGal, max: cap.outer * kgPerGal },
          { name: 'Links innen', cur: g(TANKS.lMain) * kgPerGal, max: cap.inner * kgPerGal },
          { name: 'Center', cur: g(TANKS.center) * kgPerGal, max: cap.center * kgPerGal },
          { name: 'Rechts innen', cur: g(TANKS.rMain) * kgPerGal, max: cap.inner * kgPerGal },
          { name: 'Rechts außen', cur: g(TANKS.rAux) * kgPerGal, max: cap.outer * kgPerGal },
        ],
      };
    } else {
      fuel = { currentKg: g('L:A32NX_TOTAL_FUEL_QUANTITY'), desiredKg: g('L:A32NX_FUEL_DESIRED'), maxKg: d.fuel.maxKg, tanks: [] };
    }
    fuel.refueling = g('L:A32NX_REFUEL_STARTED_BY_USR') > 0;
    fuel.rate = g('L:A32NX_EFB_REFUEL_RATE_SETTING');

    const seats = d.seats.map((s) => ({ name: s.name, cap: s.cap, cur: countSeats(g(`L:${s.var}`), s.cap), des: countSeats(g(`L:${s.var}_DESIRED`), s.cap) }));
    const cargo = d.cargo.map((c) => ({ name: c.name, max: c.max, cur: g(`L:${c.var}`), des: g(`L:${c.var}_DESIRED`) }));
    const payload = {
      seats, cargo,
      paxCur: seats.reduce((s, x) => s + x.cur, 0), paxDes: seats.reduce((s, x) => s + x.des, 0),
      paxMax: seats.reduce((s, x) => s + x.cap, 0),
      cargoCur: cargo.reduce((s, x) => s + x.cur, 0), cargoDes: cargo.reduce((s, x) => s + x.des, 0),
      cargoMax: cargo.reduce((s, x) => s + x.max, 0),
      paxWeight: g('L:A32NX_WB_PER_PAX_WEIGHT', 84), bagWeight: g('L:A32NX_WB_PER_BAG_WEIGHT', 20),
      boarding: g('L:A32NX_BOARDING_STARTED_BY_USR') > 0, rate: g('L:A32NX_BOARDING_RATE'),
      zfw: g('L:A32NX_AIRFRAME_ZFW'), gw: g('L:A32NX_AIRFRAME_GW'),
      zfwDes: g('L:A32NX_AIRFRAME_ZFW_DESIRED'), gwDes: g('L:A32NX_AIRFRAME_GW_DESIRED'),
      zfwCg: g('L:A32NX_AIRFRAME_ZFW_CG_PERCENT_MAC'), gwCg: g('L:A32NX_AIRFRAME_GW_CG_PERCENT_MAC'),
    };

    const ground = {
      doors: d.doors.map((door, i) => ({ i, name: door.name, open: g(`INTERACTIVE POINT OPEN:${door.point}`) })),
      fuelTruck: d.fuelPoint !== null ? g(`INTERACTIVE POINT OPEN:${d.fuelPoint}`) : null,
      gpu: Array.from({ length: d.gpus }, (_, i) => g(`L:A32NX_EXT_PWR_AVAIL:${i + 1}`) > 0).some(Boolean) || g('EXTERNAL POWER AVAILABLE:1') > 0,
      asu: d.asu ? g('L:A32NX_ASU_TURNED_ON') > 0 : null,
      chocks: g('L:A32NX_MODEL_WHEELCHOCKS_ENABLED') > 0,
      cones: g('L:A32NX_MODEL_CONES_ENABLED') > 0,
      eqpVisible: g('L:A32NX_GND_EQP_IS_VISIBLE') > 0,
      pushback: g('PUSHBACK ATTACHED') > 0,
      enginesRunning: g('ENG COMBUSTION:1') > 0 || g('ENG COMBUSTION:2') > 0,
    };

    return {
      kind: this.kind, name: d.name, fuel, payload, ground,
      preset: { loading: g('L:A32NX_AIRCRAFT_PRESET_LOAD'), expedite: g('L:A32NX_AIRCRAFT_PRESET_LOAD_EXPEDITE') > 0 },
      fbwFailures: [...this.activeFbwFailures],
    };
  }

  // Einfaches EFB für Flieger ohne eigene Schnittstelle: nur Standard-Variablen des Sims
  _stdStatus(d, g, kgPerGal) {
    const names = { center: 'Center', lMain: 'Links', rMain: 'Rechts', lAux: 'Links außen', rAux: 'Rechts außen' };
    const order = ['lAux', 'lMain', 'center', 'rMain', 'rAux'];
    const tanks = order.map((k) => ({ name: names[k], cur: g(TANKS[k]) * kgPerGal, max: g(TANKS[k].replace('QUANTITY', 'CAPACITY')) * kgPerGal }))
      .filter((t) => t.max > 1);
    const cur = tanks.reduce((a, t) => a + t.cur, 0), max = tanks.reduce((a, t) => a + t.max, 0);
    const ground = {
      doors: d.doors.map((door, i) => ({ i, name: door.name, open: g(`EXIT OPEN:${this._doorIdx(i)}`) })),
      doorRaw: Array.from({ length: 8 }, (_, i) => Math.round(g(`EXIT OPEN:${i + 1}`) * 100)),
      doorMsg: this.doorMsg && Date.now() < this.doorMsg.until ? this.doorMsg.text : '',
      fuelTruck: null, gpu: null, asu: null, chocks: null, cones: null, eqpVisible: null,
      pushback: g('PUSHBACK ATTACHED') > 0,
      enginesRunning: [1, 2, 3, 4].some((i) => g(`ENG COMBUSTION:${i}`) > 0),
    };
    const n = Math.min(24, Math.round(g('PAYLOAD STATION COUNT')));
    const stations = Array.from({ length: n }, (_, i) => ({ i: i + 1, kg: g(`PAYLOAD STATION WEIGHT:${i + 1}`) }));
    const crew = Math.min(n, this.stdCrew);
    const payKg = stations.slice(crew).reduce((a, x) => a + x.kg, 0);
    const maxPay = Math.max(0, g('MAX GROSS WEIGHT') - g('EMPTY WEIGHT') - cur - stations.slice(0, crew).reduce((a, x) => a + x.kg, 0));
    return {
      kind: this.kind, name: d.name, std: true,
      stdPayload: { stations, crew, payKg, maxPay, zfw: g('TOTAL WEIGHT') - cur, gw: g('TOTAL WEIGHT') },
      fuel: { currentKg: cur, desiredKg: this.stdTarget == null ? cur : this.stdTarget, maxKg: max, tanks, direct: true, refueling: false, rate: 0 },
      payload: null, ground, preset: { loading: 0, expedite: false }, fbwFailures: [],
    };
  }

  // Beladung ohne Herstellerwerte: Ziel-Nutzlast auf die Fracht-/Passagierstationen verteilen.
  // Verteilung wie bisher (bei leerem Flieger gleichmäßig); die ersten "crew" Stationen bleiben unberührt.
  _setPayloadStd(val) {
    const v = this.sim.state.vars || {};
    const n = Math.min(24, Math.round(Number(v['PAYLOAD STATION COUNT']) || 0));
    if (n < 1) return { ok: false, error: 'Der Flieger meldet keine Beladungsstationen.' };
    this.stdCrew = Math.max(0, Math.min(n - 1, Math.round(Number(val.crew)) || 0));
    const paxW = Number(val.paxW) || 84, bagW = Number(val.bagW) || 20;
    const target = Math.max(0, Math.round(Number(val.pax) || 0) * (paxW + bagW) + Math.max(0, Number(val.cargo) || 0));
    const idx = []; for (let i = this.stdCrew + 1; i <= n; i++) idx.push(i);
    const cur = idx.map((i) => Math.max(0, Number(v[`PAYLOAD STATION WEIGHT:${i}`]) || 0));
    const sum = cur.reduce((a, b) => a + b, 0);
    let ok = true;
    idx.forEach((i, k) => { ok = this.sim.setLVar(`PAYLOAD STATION WEIGHT:${i}`, sum > 0 ? (cur[k] / sum) * target : target / idx.length, 'kilograms') && ok; });
    return { ok };
  }

  // Tankinhalt direkt setzen: erst die Hauptflächen, dann Center, dann außen (Menge wird sofort geladen)
  _setFuelStd(kg) {
    const v = this.sim.state.vars || {};
    const g = (n) => Number(v[n]) || 0;
    const kgPerGal = g('FUEL WEIGHT PER GALLON') || 3.039;
    const cap = (k) => g(TANKS[k].replace('QUANTITY', 'CAPACITY'));
    let gal = Math.max(0, kg) / kgPerGal;
    const put = { lMain: 0, rMain: 0, center: 0, lAux: 0, rAux: 0 };
    const pair = (a, b) => { const c = Math.min(cap(a), cap(b)); const x = Math.min(c, gal / 2); put[a] = put[b] = x; gal -= 2 * x; };
    if (cap('lMain') > 0) pair('lMain', 'rMain');
    if (gal > 0 && cap('center') > 0) { put.center = Math.min(cap('center'), gal); gal -= put.center; }
    if (gal > 0 && cap('lAux') > 0) pair('lAux', 'rAux');
    this.stdTarget = Math.max(0, kg);
    let ok = true;
    for (const k of Object.keys(put)) if (cap(k) > 0) ok = this.sim.setLVar(TANKS[k], put[k], 'gallons') && ok;
    return ok;
  }

  _caps() {
    const d = this.def();
    if (d.fuel.fixed) return d.fuel.fixed;
    const v = this.sim.state.vars || {};
    return {
      center: Number(v['FUEL TANK CENTER CAPACITY']) || 12625,
      inner: Number(v['FUEL TANK LEFT MAIN CAPACITY']) || 11095,
      outer: Number(v['FUEL TANK LEFT AUX CAPACITY']) || 964,
    };
  }

  // ---------- Aktionen ----------
  action(name, value) {
    const d = this.def();
    if (!d) return { ok: false, error: 'Für diesen Flieger gibt es kein Remote-EFB.' };
    const s = this.sim;
    const v = s.state.vars || {};
    const L = (n, val) => s.setLVar(n, val);
    if (d.std) {
      if (name === 'fuelTarget') return { ok: this._setFuelStd(Number(value)) };
      if (name === 'door') return { ok: this._doorToggle(Number(value)) };
      if (name === 'gpu') return { ok: s.sendEvent('REQUEST_POWER_SUPPLY', 1) };
      if (name === 'payloadStd') return this._setPayloadStd(value);
      if (!['door', 'jetway', 'stairs', 'catering', 'baggage', 'fuelTruck', 'simFailure'].includes(name)) return { ok: false, error: 'Das geht bei diesem Flieger nur direkt im Cockpit.' };
    }
    switch (name) {
      case 'door': {
        const door = d.doors[Number(value)];
        return { ok: !!door && s.sendEvent('TOGGLE_AIRCRAFT_EXIT', door.exit) };
      }
      case 'jetway': return { ok: s.sendEvent('TOGGLE_JETWAY') };
      case 'stairs': return { ok: s.sendEvent('TOGGLE_RAMPTRUCK') };
      case 'catering': return { ok: s.sendEvent('REQUEST_CATERING', 1) };
      case 'baggage': return { ok: s.sendEvent('REQUEST_LUGGAGE', 1) };
      case 'fuelTruck': return { ok: s.sendEvent('REQUEST_FUEL_KEY', 1) };
      case 'gpu': return { ok: this._toggleGpu() };
      case 'asu': return { ok: L('L:A32NX_ASU_TURNED_ON', Number(v['L:A32NX_ASU_TURNED_ON']) ? 0 : 1) };
      case 'chocks': return { ok: L('L:A32NX_MODEL_WHEELCHOCKS_ENABLED', Number(v['L:A32NX_MODEL_WHEELCHOCKS_ENABLED']) ? 0 : 1) };
      case 'cones': return { ok: L('L:A32NX_MODEL_CONES_ENABLED', Number(v['L:A32NX_MODEL_CONES_ENABLED']) ? 0 : 1) };

      case 'fuelTarget': return { ok: this._setFuel(Number(value)) };
      case 'refuel': return { ok: L('L:A32NX_REFUEL_STARTED_BY_USR', value ? 1 : 0) };
      case 'refuelRate': return { ok: L('L:A32NX_EFB_REFUEL_RATE_SETTING', Number(value)) };

      case 'payloadTarget': return { ok: this._setPayload(Number(value.pax), Number(value.cargo || 0)) };
      case 'boarding': return { ok: L('L:A32NX_BOARDING_STARTED_BY_USR', value ? 1 : 0) };
      case 'boardingRate': return { ok: L('L:A32NX_BOARDING_RATE', Number(value)) };
      case 'paxWeight': return { ok: L('L:A32NX_WB_PER_PAX_WEIGHT', Number(value)) };
      case 'bagWeight': return { ok: L('L:A32NX_WB_PER_BAG_WEIGHT', Number(value)) };

      case 'preset': return { ok: L('L:A32NX_AIRCRAFT_PRESET_LOAD', Number(value)) };
      case 'presetExpedite': return { ok: L('L:A32NX_AIRCRAFT_PRESET_LOAD_EXPEDITE', value ? 1 : 0) };
      case 'lightPreset': return { ok: L('L:A32NX_LIGHTING_PRESET_LOAD', Number(value)) };

      case 'simFailure': {
        const f = DEFS.simFailures.find((x) => x.id === value);
        return { ok: !!f && s.sendEvent(f.event) };
      }
      case 'fbwFailure': {
        const id = Number(value.id);
        if (value.active) this.activeFbwFailures.add(id); else this.activeFbwFailures.delete(id);
        this.failureQueue = [...this.activeFbwFailures];
        return { ok: true, needsBridge: true };
      }
      case 'fbwFailuresClear':
        this.activeFbwFailures.clear();
        this.failureQueue = [];
        return { ok: true, needsBridge: true };
      default:
        return { ok: false, error: 'Unbekannte Aktion' };
    }
  }

  // GPU wie im flyPad: steht schon Strom am Gate bereit, nur zuschalten, sonst Wagen anfordern
  _toggleGpu() {
    const d = this.def();
    const v = this.sim.state.vars || {};
    const avail = Array.from({ length: d.gpus }, (_, i) => Number(v[`L:A32NX_EXT_PWR_AVAIL:${i + 1}`]) > 0).some(Boolean) || Number(v['EXTERNAL POWER AVAILABLE:1']) > 0;
    if (avail) {
      for (let i = 1; i <= d.gpus; i++) this.sim.setLVar(`L:A32NX_EXT_PWR_AVAIL:${i}`, 0);
      this.sim.setLVar(d.gpus === 1 ? 'L:A32NX_OVHD_ELEC_EXT_PWR_PB_IS_ON' : 'L:A32NX_OVHD_ELEC_EXT_PWR_1_PB_IS_ON', 0);
    }
    return this.sim.sendEvent('REQUEST_POWER_SUPPLY', 1);
  }

  _setFuel(kg) {
    const d = this.def();
    const s = this.sim;
    const v = s.state.vars || {};
    const kgPerGal = Number(v['FUEL WEIGHT PER GALLON']) || 3.039;
    if (d.fuel.mode === 'total') {
      return s.setLVar('L:A32NX_FUEL_DESIRED', Math.max(0, Math.min(kg, d.fuel.maxKg)));
    }
    const cap = this._caps();
    const total = 2 * cap.outer + 2 * cap.inner + cap.center;
    let gal = Math.max(0, Math.min(kg / kgPerGal, total));
    const totalGal = gal;
    let outer = 0, inner = 0, center = 0;
    if (d.fuel.order === 'a330') {
      // A330: erst innen bis 1480 gal, dann außen, dann innen voll, dann Center
      const first = Math.min(1480, gal / 2); inner = first; gal -= first * 2;
      if (gal > 0) { outer = Math.min(cap.outer, gal / 2); gal -= outer * 2; }
      if (gal > 0) { const second = Math.min(cap.inner - 1480, gal / 2); inner += second; gal -= second * 2; }
      if (gal > 0) center = Math.min(cap.center, gal);
    } else {
      // A320: erst außen, dann innen, dann Center
      outer = Math.min(cap.outer, gal / 2); gal -= outer * 2;
      if (gal > 0) { inner = Math.min(cap.inner, gal / 2); gal -= inner * 2; }
      if (gal > 0) center = Math.min(cap.center, gal);
    }
    s.setLVar('L:A32NX_FUEL_LEFT_AUX_DESIRED', outer);
    s.setLVar('L:A32NX_FUEL_RIGHT_AUX_DESIRED', outer);
    s.setLVar('L:A32NX_FUEL_LEFT_MAIN_DESIRED', inner);
    s.setLVar('L:A32NX_FUEL_RIGHT_MAIN_DESIRED', inner);
    s.setLVar('L:A32NX_FUEL_CENTER_DESIRED', center);
    s.setLVar('L:A32NX_FUEL_TOTAL_DESIRED', totalGal);
    s.setLVar('L:A32NX_FUEL_DESIRED', Math.round(totalGal * kgPerGal));
    s.setLVar('L:A32NX_FUEL_DESIRED_PERCENT', Math.round((totalGal / total) * 100));
    return true;
  }

  // Verteilung wie im flyPad: hintere Stationen anteilig, Rest in Station 1
  _setPayload(pax, freightKg) {
    const d = this.def();
    const s = this.sim;
    const v = s.state.vars || {};
    const maxPax = d.seats.reduce((a, x) => a + x.cap, 0);
    pax = Math.max(0, Math.min(Math.round(pax), maxPax));
    let remaining = pax;
    const targets = new Array(d.seats.length).fill(0);
    for (let i = d.seats.length - 1; i > 0; i--) {
      const pct = Math.ceil((d.seats[i].cap / maxPax) * 100) / 100;
      targets[i] = Math.min(Math.trunc(pct * pax), d.seats[i].cap, remaining);
      remaining -= targets[i];
    }
    targets[0] = Math.min(remaining, d.seats[0].cap);
    d.seats.forEach((st, i) => {
      const name = `L:${st.var}_DESIRED`;
      s.setLVar(name, adjustSeats(v[name], st.cap, targets[i]));
    });
    const bag = Number(v['L:A32NX_WB_PER_BAG_WEIGHT']) || 20;
    const maxCargo = d.cargo.reduce((a, x) => a + x.max, 0);
    const loadable = Math.min(pax * bag + Math.max(0, freightKg), maxCargo);
    let rest = loadable;
    for (let i = d.cargo.length - 1; i > 0; i--) {
      const c = Math.round((d.cargo[i].max / maxCargo) * loadable);
      rest -= c;
      s.setLVar(`L:${d.cargo[i].var}_DESIRED`, c);
    }
    s.setLVar(`L:${d.cargo[0].var}_DESIRED`, Math.max(0, rest));
    s.setLVar('L:FSDT_GSX_NUMPASSENGERS', pax);
    return true;
  }
}

module.exports = { Efb, DEFS, decodeSeats, encodeSeats, countSeats, adjustSeats };
