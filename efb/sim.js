// Verbindung zum MSFS 2024 über SimConnect (Bibliothek: node-simconnect)
// Liefert Live-Daten (Position, Flieger, Wetter, GSX-Status) und kann L:Vars setzen.

const EventEmitter = require('events');

// GSX-Zustände laut GSX-Doku: 1 verfügbar, 2 nicht verfügbar, 3 übersprungen,
// 4 angefordert, 5 läuft, 6 fertig
const GSX_VARS = {
  deboarding: 'L:FSDT_GSX_DEBOARDING_STATE',
  boarding: 'L:FSDT_GSX_BOARDING_STATE',
  refueling: 'L:FSDT_GSX_REFUELING_STATE',
  catering: 'L:FSDT_GSX_CATERING_STATE',
  departure: 'L:FSDT_GSX_DEPARTURE_STATE',
  paxBoarding: 'L:FSDT_GSX_NUMPASSENGERS_BOARDING_TOTAL',
  paxDeboarding: 'L:FSDT_GSX_NUMPASSENGERS_DEBOARDING_TOTAL',
  couatl: 'L:FSDT_GSX_COUATL_STARTED',
};

const DEF = { POS: 1, MISC: 2, WATCH: 3, SET_BASE: 100 };
const REQ = { POS: 1, MISC: 2, WATCH: 3 };
const EVENT_BASE = 1000;

class SimLink extends EventEmitter {
  constructor({ demo = false } = {}) {
    super();
    this.demo = demo;
    this.handle = null;
    this.lib = null;
    this.setDefs = new Map(); // L:Var-Name -> Definitions-ID
    this.eventIds = new Map(); // Sim-Event-Name -> Client-Event-ID
    this.watchList = []; // zusätzliche Variablen fürs Remote-EFB [{name, unit}]
    this.demoVars = {};
    this.state = {
      connected: false,
      demo,
      title: '',
      lat: null, lon: null, alt: 0, hdg: 0, gs: 0, ias: 0, vs: 0, onGround: true,
      weightKg: null, fuelKg: null, parkingBrake: null, brakeKnown: false, com1: null, com1s: null,
      oat: null, windDir: null, windSpd: null, qnh: null,
      gsx: { installed: false },
      vars: {},
      updated: 0,
    };
  }

  start() {
    if (this.demo) return this._startDemo();
    try {
      this.lib = require('node-simconnect');
    } catch (e) {
      console.log('[SIM] node-simconnect ist nicht installiert. Bitte "npm install" ausführen.');
      console.log('[SIM] Tipp: Mit "npm run demo" läuft die Oberfläche mit Testdaten.');
      return;
    }
    this._connect();
  }

  _connect() {
    const { open, Protocol } = this.lib;
    open('Cockpit EFB', Protocol.KittyHawk)
      .then(({ recvOpen, handle }) => {
        console.log('[SIM] Verbunden mit', recvOpen.applicationName);
        this.handle = handle;
        this.setDefs.clear();
        this.eventIds.clear();
        this.watchApplied = false;
        this._setup(handle);
        this._applyWatch();
        this._patch({ connected: true });
      })
      .catch(() => this._retry());
  }

  _retry() {
    if (this.state.connected) console.log('[SIM] Verbindung verloren');
    this.handle = null;
    this._patch({ connected: false });
    setTimeout(() => this._connect(), 5000);
  }

  _setup(h) {
    const { SimConnectDataType: T, SimConnectPeriod: P, SimConnectConstants: C } = this.lib;
    const F = T.FLOAT64;

    // Schnelle Daten (Position)
    h.addToDataDefinition(DEF.POS, 'PLANE LATITUDE', 'degrees', F);
    h.addToDataDefinition(DEF.POS, 'PLANE LONGITUDE', 'degrees', F);
    h.addToDataDefinition(DEF.POS, 'PLANE ALTITUDE', 'feet', F);
    h.addToDataDefinition(DEF.POS, 'PLANE HEADING DEGREES TRUE', 'degrees', F);
    h.addToDataDefinition(DEF.POS, 'GROUND VELOCITY', 'knots', F);
    h.addToDataDefinition(DEF.POS, 'AIRSPEED INDICATED', 'knots', F);
    h.addToDataDefinition(DEF.POS, 'VERTICAL SPEED', 'feet per minute', F);
    h.addToDataDefinition(DEF.POS, 'SIM ON GROUND', 'bool', F);
    h.addToDataDefinition(DEF.POS, 'PLANE ALT ABOVE GROUND', 'feet', F);

    // Langsame Daten (Flieger, Wetter, GSX)
    h.addToDataDefinition(DEF.MISC, 'TITLE', null, T.STRING256);
    h.addToDataDefinition(DEF.MISC, 'AMBIENT TEMPERATURE', 'celsius', F);
    h.addToDataDefinition(DEF.MISC, 'AMBIENT WIND DIRECTION', 'degrees', F);
    h.addToDataDefinition(DEF.MISC, 'AMBIENT WIND VELOCITY', 'knots', F);
    h.addToDataDefinition(DEF.MISC, 'SEA LEVEL PRESSURE', 'millibars', F);
    h.addToDataDefinition(DEF.MISC, 'TOTAL WEIGHT', 'kilograms', F);
    h.addToDataDefinition(DEF.MISC, 'FUEL TOTAL QUANTITY WEIGHT', 'kilograms', F);
    h.addToDataDefinition(DEF.MISC, 'BRAKE PARKING POSITION', 'bool', F);
    h.addToDataDefinition(DEF.MISC, 'COM ACTIVE FREQUENCY:1', 'hertz', F);
    h.addToDataDefinition(DEF.MISC, 'COM STANDBY FREQUENCY:1', 'hertz', F);
    h.addToDataDefinition(DEF.MISC, 'L:A32NX_PARK_BRAKE_LEVER_POS', 'number', F); // FBW A32NX/A380X: der Standard-Wert BRAKE PARKING POSITION bleibt dort oft 0
    const gsxKeys = Object.keys(GSX_VARS);
    for (const k of gsxKeys) h.addToDataDefinition(DEF.MISC, GSX_VARS[k], 'number', F);

    h.requestDataOnSimObject(REQ.POS, DEF.POS, C.OBJECT_ID_USER, P.VISUAL_FRAME, 0, 0, 15, 0);
    h.requestDataOnSimObject(REQ.MISC, DEF.MISC, C.OBJECT_ID_USER, P.SECOND);

    h.on('simObjectData', (recv) => {
      const d = recv.data;
      if (recv.requestID === REQ.POS) {
        this._patch({
          lat: d.readFloat64(), lon: d.readFloat64(), alt: d.readFloat64(),
          hdg: d.readFloat64(), gs: d.readFloat64(), ias: d.readFloat64(),
          vs: d.readFloat64(), onGround: d.readFloat64() > 0.5, agl: d.readFloat64(),
        });
      } else if (recv.requestID === REQ.WATCH) {
        const vars = {};
        for (const w of this.watchList) vars[w.name] = d.readFloat64();
        this._patch({ vars });
      } else if (recv.requestID === REQ.MISC) {
        const title = d.readString256();
        const oat = d.readFloat64(), windDir = d.readFloat64(), windSpd = d.readFloat64(), qnh = d.readFloat64();
        const weightKg = d.readFloat64(), fuelKg = d.readFloat64(), parkingBrake0 = d.readFloat64() > 0.5;
        const com1 = d.readFloat64(), com1s = d.readFloat64();
        const brakeL = d.readFloat64();
        const parkingBrake = parkingBrake0 || brakeL > 0.5;
        if (parkingBrake) this._brakeSeen = true; // erst wenn der Sim die Bremse einmal als gesetzt gemeldet hat, gilt „gelöst“ als verlässlich
        const gsx = {};
        for (const k of gsxKeys) gsx[k] = d.readFloat64();
        gsx.installed = gsx.couatl > 0 || gsxKeys.some((k) => k.endsWith('ing') && gsx[k] > 0);
        this._patch({ title, oat, windDir, windSpd, qnh, weightKg, fuelKg, parkingBrake, brakeKnown: !!this._brakeSeen, com1, com1s, gsx });
      }
    });
    h.on('exception', (ex) => console.log('[SIM] SimConnect-Ausnahme:', ex.exception, ex.sendId));
    h.on('quit', () => this._retry());
    h.on('close', () => this._retry());
    h.on('error', () => this._retry());
  }

  // Weitere Variablen beobachten (für das Remote-EFB). list: [{name, unit}]
  setWatch(list) {
    const key = JSON.stringify(list);
    if (key === JSON.stringify(this.watchList)) return;
    this.watchList = list;
    this.state.vars = {};
    if (this.demo) return;
    this._applyWatch();
  }

  _applyWatch() {
    if (!this.handle || !this.lib) return;
    const { SimConnectDataType: T, SimConnectPeriod: P, SimConnectConstants: C } = this.lib;
    try {
      // Nur aufräumen, wenn vorher schon etwas angemeldet war (sonst meldet SimConnect einen Fehler)
      if (this.watchApplied) {
        this.handle.requestDataOnSimObject(REQ.WATCH, DEF.WATCH, C.OBJECT_ID_USER, P.NEVER);
        this.handle.clearDataDefinition(DEF.WATCH);
        this.watchApplied = false;
      }
      if (!this.watchList.length) return;
      for (const w of this.watchList) {
        this.handle.addToDataDefinition(DEF.WATCH, w.name.replace(/^A:/, ''), w.unit || 'number', T.FLOAT64);
      }
      this.handle.requestDataOnSimObject(REQ.WATCH, DEF.WATCH, C.OBJECT_ID_USER, P.VISUAL_FRAME, 0, 0, 20, 0);
      this.watchApplied = true;
    } catch (e) {
      console.log('[SIM] Beobachtung der EFB-Variablen fehlgeschlagen:', e.message);
    }
  }

  // Löst ein Sim-Ereignis aus, z. B. TOGGLE_AIRCRAFT_EXIT mit Wert 1
  sendEvent(name, value = 0) {
    if (this.demo) return this._demoEvent(name, value);
    if (!this.handle || !this.lib) return false;
    try {
      let id = this.eventIds.get(name);
      if (!id) {
        id = EVENT_BASE + this.eventIds.size;
        this.handle.mapClientEventToSimEvent(id, name);
        this.eventIds.set(name, id);
      }
      const C = this.lib.SimConnectConstants;
      // Gruppe 1 = höchste Priorität, Flag 16 = "Gruppen-ID ist Priorität"
      this.handle.transmitClientEvent(C.OBJECT_ID_USER, id, Math.round(Number(value)) >>> 0, 1, 16);
      return true;
    } catch (e) {
      console.log('[SIM] Ereignis fehlgeschlagen:', name, e.message);
      return false;
    }
  }

  // Setzt eine L:Var (z. B. für GSX). Gibt false zurück, wenn nicht möglich.
  setLVar(name, value, unit = 'number') {
    if (this.demo) return this._demoLVar(name, value);
    if (!this.handle || !this.lib) return false;
    const { SimConnectDataType: T, SimConnectConstants: C, RawBuffer } = this.lib;
    try {
      const key = name + '|' + unit;
      let id = this.setDefs.get(key);
      if (id === undefined) {
        id = DEF.SET_BASE + this.setDefs.size;
        this.handle.addToDataDefinition(id, name, unit, T.FLOAT64);
        this.setDefs.set(key, id);
      }
      const buf = new RawBuffer(8);
      buf.writeFloat64(Number(value));
      this.handle.setDataOnSimObject(id, C.OBJECT_ID_USER, { buffer: buf, arrayCount: 0, tagged: false });
      return true;
    } catch (e) {
      console.log('[SIM] L:Var setzen fehlgeschlagen:', name, e.message);
      return false;
    }
  }

  _patch(p) {
    Object.assign(this.state, p, { updated: Date.now() });
    this.emit('update', this.state);
  }

  // ---------- Demo-Modus: geparkt in Leipzig, nach 4 Minuten Abflug 26R ----------
  _startDemo() {
    console.log('[SIM] Demo-Modus aktiv (Testdaten, kein MSFS nötig)');
    const start = { lat: 51.4236, lon: 12.2633 };
    let t = 0;
    const gsx = { installed: true, deboarding: 6, boarding: 5, refueling: 6, catering: 6, departure: 1, paxBoarding: 112, paxDeboarding: 0, couatl: 1 };
    const dv = this.demoVars;
    Object.assign(dv, {
      'FUEL WEIGHT PER GALLON': 3.04, 'FUEL TANK CENTER QUANTITY': 0, 'FUEL TANK LEFT MAIN QUANTITY': 900,
      'FUEL TANK RIGHT MAIN QUANTITY': 900, 'FUEL TANK LEFT AUX QUANTITY': 228, 'FUEL TANK RIGHT AUX QUANTITY': 228,
      'FUEL TANK CENTER CAPACITY': 12625, 'FUEL TANK LEFT MAIN CAPACITY': 11095, 'FUEL TANK LEFT AUX CAPACITY': 964,
      'L:A32NX_WB_PER_PAX_WEIGHT': 84, 'L:A32NX_WB_PER_BAG_WEIGHT': 20, 'L:A32NX_EFB_REFUEL_RATE_SETTING': 1,
      'L:A32NX_BOARDING_RATE': 1, 'L:A32NX_MODEL_WHEELCHOCKS_ENABLED': 1, 'L:A32NX_MODEL_CONES_ENABLED': 1,
      'L:A32NX_GND_EQP_IS_VISIBLE': 1, 'L:A32NX_AIRFRAME_ZFW': 44100, 'L:A32NX_AIRFRAME_GW': 51200,
      'L:A32NX_AIRFRAME_ZFW_CG_PERCENT_MAC': 27.4, 'L:A32NX_AIRFRAME_GW_CG_PERCENT_MAC': 26.9,
      'INTERACTIVE POINT OPEN:0': 1, 'L:A32NX_TOTAL_FUEL_QUANTITY': 21000,
    });
    this.state.connected = true;
    this.state.title = 'FlyByWire A320neo (Demo)';
    // Zeitraffer nur für Tests (DEMO_TIME_SCALE), Standard 1
    const scale = Number(process.env.DEMO_TIME_SCALE) || 1;
    const CYCLE = 600;
    setInterval(() => {
      t += 0.25 * scale;
      const p = t % CYCLE;
      // 0-240 s geparkt (Boarding 20-60 s), 240 Rollen/Start, ~300 Abflug, Platzrunde, ~420 Landung, ~470 Stillstand
      let gs = 0, alt = 430, vs = 0, onGround = true, dist = 0, hdg = 263, fuel = 5200, brake = true;
      if (p > 20 && p < 60) gsx.boarding = 5; else if (p >= 60) gsx.boarding = 6; else gsx.boarding = 1;
      if (p < 20) gsx.paxBoarding = 0; else gsx.paxBoarding = 112;
      if (p > 240 && p <= 300) { brake = false; gs = Math.min(150, (p - 240) * 3); dist = ((p - 240) * gs) / 3600 / 60 * 0.5; }
      if (p > 300 && p <= 360) { brake = false; onGround = false; vs = 2200; alt = 430 + (p - 300) * 60; gs = 200; dist = 0.02 + (p - 300) * 0.0255; fuel = 5200 - (p - 240) * 2; }
      if (p > 360 && p <= 420) { brake = false; onGround = false; vs = -1500; alt = Math.max(430, 4030 - (p - 360) * 60); gs = 160; hdg = 83; dist = Math.max(0.05, 1.55 - (p - 360) * 0.025); fuel = 5200 - (p - 240) * 2; }
      if (p > 420 && p <= 450) { brake = false; gs = Math.max(0, 140 - (p - 420) * 5); hdg = 83; dist = Math.max(0, 0.05 - (p - 420) * 0.0015); fuel = 5200 - 330; }
      if (p > 450) { hdg = 83; gs = 0; brake = p < 470 ? false : true; fuel = 5200 - 330; }
      if (p > 300 && p <= 420) { fuel = 5200 - (p - 240) * 2; }
      this._demoTick();
      const rad = (263 * Math.PI) / 180;
      const vars = {};
      for (const w of this.watchList) vars[w.name] = Number(dv[w.name] ?? 0);
      this._patch({
        lat: start.lat + Math.cos(rad) * dist * 0.6,
        lon: start.lon + Math.sin(rad) * dist,
        alt, agl: onGround ? 0 : Math.max(0, alt - 430), hdg, gs, ias: gs, vs, onGround,
        oat: 14, windDir: 250, windSpd: 9, qnh: 1018,
        weightKg: 62000 - (5200 - fuel) , fuelKg: fuel, parkingBrake: brake, brakeKnown: true,
        com1: this.state.com1 || 121700000, com1s: this.state.com1s || 118000000,
        gsx: { ...gsx }, vars,
      });
    }, 250);
  }

  // Betanken und Boarding im Demo-Modus langsam nachbilden
  _demoTick() {
    const dv = this.demoVars;
    if (dv['L:A32NX_REFUEL_STARTED_BY_USR']) {
      let done = true;
      for (const [tank, want] of [['CENTER', 'CENTER'], ['LEFT MAIN', 'LEFT_MAIN'], ['RIGHT MAIN', 'RIGHT_MAIN'], ['LEFT AUX', 'LEFT_AUX'], ['RIGHT AUX', 'RIGHT_AUX']]) {
        const cur = `FUEL TANK ${tank} QUANTITY`, target = Number(dv[`L:A32NX_FUEL_${want}_DESIRED`] ?? dv[cur]);
        const diff = target - (dv[cur] || 0);
        if (Math.abs(diff) > 1) { dv[cur] = (dv[cur] || 0) + Math.sign(diff) * Math.min(Math.abs(diff), 40); done = false; }
      }
      if (done) dv['L:A32NX_REFUEL_STARTED_BY_USR'] = 0;
    }
    if (dv['L:A32NX_BOARDING_STARTED_BY_USR']) {
      let done = true;
      for (const k of Object.keys(dv)) {
        if (!k.endsWith('_DESIRED') || !/PAX|CARGO/.test(k)) continue;
        const cur = k.replace('_DESIRED', '');
        if (/PAX/.test(k)) { if (dv[cur] !== dv[k]) { dv[cur] = dv[k]; } }
        else if (Math.abs((dv[cur] || 0) - dv[k]) > 1) { dv[cur] = (dv[cur] || 0) + Math.sign(dv[k] - (dv[cur] || 0)) * Math.min(Math.abs(dv[k] - (dv[cur] || 0)), 50); done = false; }
      }
      if (done) dv['L:A32NX_BOARDING_STARTED_BY_USR'] = 0;
    }
    if (dv['L:A32NX_AIRCRAFT_PRESET_LOAD']) {
      this._presetT = (this._presetT || 0) + 1;
      if (this._presetT > 20) { dv['L:A32NX_AIRCRAFT_PRESET_LOAD'] = 0; this._presetT = 0; }
    }
  }

  _demoLVar(name, value) {
    console.log(`[SIM] Demo: ${name} = ${value}`);
    this.demoVars[name] = Number(value);
    if (name === 'L:FSDT_GSX_MENU_CHOICE') this.emit('demoChoice', Number(value));
    if (name === 'L:FSDT_GSX_MENU_OPEN') this.emit('demoOpen');
    return true;
  }

  _demoEvent(name, value) {
    console.log(`[SIM] Demo-Ereignis: ${name} ${value}`);
    const dv = this.demoVars;
    if (name === 'TOGGLE_AIRCRAFT_EXIT') {
      const k = `INTERACTIVE POINT OPEN:${Number(value) - 1}`;
      dv[k] = dv[k] ? 0 : 1;
    }
    if (name === 'COM_STBY_RADIO_SET_HZ') this.state.com1s = Number(value);
    if (name === 'COM_RADIO_SET_HZ') this.state.com1 = Number(value);
    if (name === 'COM_RADIO_SWAP' || name === 'COM_STBY_RADIO_SWAP' || name === 'COM1_RADIO_SWAP') { const a = this.state.com1; this.state.com1 = this.state.com1s; this.state.com1s = a; }
    if (name === 'REQUEST_POWER_SUPPLY') dv['L:A32NX_EXT_PWR_AVAIL:1'] = dv['L:A32NX_EXT_PWR_AVAIL:1'] ? 0 : 1;
    return true;
  }
}

module.exports = { SimLink, GSX_VARS };
