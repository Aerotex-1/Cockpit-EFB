// Eigenes Näherungsmodell für Takeoff und Landung (Airbus-Familie).
// Kein FCOM und kein Ersatz für das Flugzeugmodell im Sim – die Zahlen sind auf
// typische Werte kalibriert, damit man Pistenlänge, Gewicht und Wetter schnell einschätzen kann.
'use strict';

const PerfModel = (() => {
  // wref: Referenzgewicht; s0: nötige Startstrecke bei wref (Meeresspiegel, ISA, CONF 2, volle Leistung, trocken, windstill)
  // vs2: Überziehgeschwindigkeit (CAS) bei wref in CONF 2; vsFull: dto. bei MLW in Landekonfiguration
  // ldg: nötige Landestrecke bei MLW, trocken, Meeresspiegel (Autobrake LO / MED / MAX)
  // [Code, Name, Gruppe, Familie, MTOW, MLW, OEW, wref, s0, vs2, vsFull, v1min, tref, ldgLo, minRwy, Reichweite NM, Reise-GS kt]
  const ROWS = [
    ['A318', 'A318', 'Airbus', 'airbus', 68000, 57500, 39500, 58000, 1650, 112, 104, 110, 45, 1950, 1500, 3100, 440],
    ['A319', 'A319', 'Airbus', 'airbus', 75500, 62500, 41000, 62000, 1700, 115, 106, 112, 45, 2000, 1600, 3700, 440],
    ['A19N', 'A319neo', 'Airbus', 'airbus', 75500, 62500, 43000, 62000, 1650, 115, 106, 112, 45, 1980, 1600, 3750, 445],
    ['A320', 'A320-200', 'Airbus', 'airbus', 78000, 66000, 42500, 64000, 2000, 118, 109, 114, 45, 2150, 1800, 3300, 440],
    ['A20N', 'A320neo', 'Airbus', 'airbus', 79000, 67400, 44000, 64000, 1900, 118, 110, 114, 45, 2100, 1800, 3400, 445],
    ['A321', 'A321-200', 'Airbus', 'airbus', 93500, 77800, 48500, 80000, 2500, 124, 114, 118, 45, 2300, 2200, 3200, 440],
    ['A21N', 'A321neo', 'Airbus', 'airbus', 97000, 79200, 50000, 85000, 2450, 124, 115, 118, 45, 2300, 2200, 3900, 445],
    ['A400', 'A400M', 'Airbus', 'airbus', 141000, 122000, 76500, 120000, 1000, 105, 100, 100, 40, 1100, 1000, 3300, 400],
    ['A306', 'A300-600R', 'Airbus', 'airbus', 171700, 140000, 90000, 150000, 2400, 124, 114, 120, 40, 2100, 2200, 4050, 450],
    ['A310', 'A310-300', 'Airbus', 'airbus', 164000, 124000, 82000, 140000, 2400, 122, 112, 118, 40, 2000, 2100, 5150, 450],
    ['A332', 'A330-200', 'Airbus', 'airbus', 242000, 182000, 120000, 205000, 2500, 125, 114, 120, 40, 2400, 2400, 7250, 470],
    ['A333', 'A330-300', 'Airbus', 'airbus', 242000, 187000, 124000, 205000, 2650, 125, 114, 120, 40, 2400, 2500, 6350, 470],
    ['A338', 'A330-800neo', 'Airbus', 'airbus', 251000, 191000, 132000, 225000, 2550, 128, 114, 120, 40, 2400, 2500, 8150, 475],
    ['A339', 'A330-900neo', 'Airbus', 'airbus', 251000, 191000, 137000, 230000, 2600, 129, 114, 120, 40, 2400, 2500, 6600, 470],
    ['A343', 'A340-300', 'Airbus', 'airbus', 276500, 190000, 130000, 235000, 3100, 126, 113, 120, 40, 2500, 2800, 7400, 470],
    ['A346', 'A340-600', 'Airbus', 'airbus', 380000, 254000, 177000, 330000, 3300, 131, 117, 122, 40, 2600, 3000, 7900, 480],
    ['A359', 'A350-900', 'Airbus', 'airbus', 280000, 205000, 142000, 245000, 2500, 127, 114, 120, 40, 2400, 2400, 8100, 488],
    ['A35K', 'A350-1000', 'Airbus', 'airbus', 322000, 233000, 156000, 285000, 2800, 130, 116, 122, 40, 2450, 2600, 8700, 488],
    ['A388', 'A380-800', 'Airbus', 'airbus', 575000, 391000, 277000, 500000, 2950, 133, 119, 120, 40, 2500, 2800, 8000, 490],
    ['BCS1', 'A220-100', 'Airbus', 'airbus', 60800, 51700, 35200, 52000, 1600, 108, 100, 108, 45, 1900, 1400, 3000, 440],
    ['BCS3', 'A220-300', 'Airbus', 'airbus', 70900, 58740, 37000, 62000, 1750, 112, 103, 110, 45, 1950, 1500, 3350, 440],
    ['B737', '737-700', 'Boeing', 'b737', 70080, 58060, 38150, 60000, 1750, 114, 104, 110, 45, 2000, 1500, 3400, 440],
    ['B738', '737-800', 'Boeing', 'b737', 79015, 65317, 41400, 68000, 2100, 117, 108, 112, 45, 2150, 1800, 3100, 440],
    ['B739', '737-900', 'Boeing', 'b737', 85130, 66361, 44500, 72000, 2350, 119, 111, 114, 45, 2300, 2000, 3200, 440],
    ['B38M', '737 MAX 8', 'Boeing', 'b737', 82190, 66360, 45070, 70000, 2000, 117, 108, 112, 45, 2150, 1800, 3500, 445],
    ['B39M', '737 MAX 9', 'Boeing', 'b737', 88314, 69308, 46000, 75000, 2250, 119, 111, 114, 45, 2250, 2000, 3500, 445],
    ['B752', '757-200', 'Boeing', 'boeing', 115660, 89810, 58400, 98000, 2300, 120, 109, 114, 45, 2200, 2000, 3900, 450],
    ['B753', '757-300', 'Boeing', 'boeing', 123600, 95254, 64000, 105000, 2600, 122, 111, 116, 45, 2300, 2300, 3400, 450],
    ['B763', '767-300ER', 'Boeing', 'boeing', 186880, 145150, 86000, 160000, 2500, 120, 108, 116, 40, 2300, 2300, 6000, 460],
    ['B764', '767-400ER', 'Boeing', 'boeing', 204570, 158750, 103000, 175000, 2700, 122, 110, 118, 40, 2400, 2500, 5600, 460],
    ['B772', '777-200', 'Boeing', 'boeing', 297550, 213000, 143000, 255000, 2700, 127, 113, 120, 40, 2400, 2500, 5200, 480],
    ['B77L', '777-200LR', 'Boeing', 'boeing', 347450, 223000, 145000, 300000, 3100, 130, 115, 122, 40, 2450, 2800, 7700, 480],
    ['B77W', '777-300ER', 'Boeing', 'boeing', 351530, 251300, 167800, 300000, 3100, 130, 116, 122, 40, 2500, 2800, 7500, 480],
    ['B788', '787-8', 'Boeing', 'boeing', 227930, 172365, 119950, 195000, 2500, 125, 112, 120, 40, 2350, 2400, 7300, 485],
    ['B789', '787-9', 'Boeing', 'boeing', 254011, 192776, 128850, 220000, 2600, 126, 113, 120, 40, 2400, 2500, 7000, 485],
    ['B78X', '787-10', 'Boeing', 'boeing', 254011, 201849, 135500, 225000, 2800, 127, 114, 120, 40, 2450, 2700, 6400, 485],
    ['B744', '747-400', 'Boeing', 'boeing', 396890, 285760, 178750, 340000, 3000, 128, 114, 122, 40, 2500, 2800, 7260, 480],
    ['B748', '747-8', 'Boeing', 'boeing', 447700, 312000, 197100, 380000, 3000, 130, 116, 122, 40, 2550, 2800, 7700, 485],
    ['E170', 'E170', 'Embraer', 'reg', 37200, 32800, 21000, 32000, 1500, 105, 98, 105, 45, 1800, 1300, 2100, 400],
    ['E190', 'E190', 'Embraer', 'reg', 51800, 43000, 28000, 44000, 1700, 108, 101, 106, 45, 1850, 1500, 2400, 420],
    ['E195', 'E195', 'Embraer', 'reg', 52290, 45000, 29000, 45000, 1800, 109, 102, 106, 45, 1900, 1600, 2300, 420],
    ['E290', 'E190-E2', 'Embraer', 'reg', 56400, 49050, 33000, 48000, 1700, 108, 101, 106, 45, 1850, 1500, 2850, 430],
    ['E295', 'E195-E2', 'Embraer', 'reg', 61500, 52000, 34000, 52000, 1800, 110, 103, 108, 45, 1900, 1600, 2600, 430],
    ['CRJ7', 'CRJ-700', 'Bombardier', 'reg', 34019, 30800, 20000, 30000, 1600, 108, 100, 106, 45, 1850, 1400, 1500, 410],
    ['CRJ9', 'CRJ-900', 'Bombardier', 'reg', 38330, 34500, 21800, 34000, 1700, 109, 102, 106, 45, 1900, 1500, 1550, 410],
    ['AT76', 'ATR 72-600', 'Turboprop', 'reg', 23000, 22350, 13300, 20500, 1100, 88, 80, 90, 45, 1300, 1100, 800, 260],
    ['DH8D', 'Dash 8 Q400', 'Turboprop', 'reg', 29260, 28009, 17000, 26000, 1200, 90, 82, 92, 45, 1300, 1200, 1100, 310],
  ];
  const FAMILIES = {
    airbus: { to: ['CONF 1+F', 'CONF 2', 'CONF 3'], ldg: ['CONF FULL', 'CONF 3'], atm: 'FLEX' },
    b737: { to: ['Flaps 1', 'Flaps 5', 'Flaps 15'], ldg: ['Flaps 40', 'Flaps 30'], atm: 'ATM' },
    boeing: { to: ['Flaps 5', 'Flaps 15', 'Flaps 20'], ldg: ['Flaps 30', 'Flaps 25'], atm: 'ATM' },
    reg: { to: ['Flaps klein', 'Flaps mittel', 'Flaps groß'], ldg: ['Flaps voll', 'Flaps reduziert'], atm: 'Red. Schub' },
  };
  const TYPES = {};
  for (const [code, name, grp, fam, mtow, mlw, oew, wref, s0, vs2, vsFull, v1min, tref, lo, minRwy, rangeNm, gs] of ROWS) {
    TYPES[code] = { code, name, grp, fam, mtow, mlw, oew, wref, s0, vs2, vsFull, v1min, tref, ldg: { lo, med: Math.round((lo * 0.77) / 10) * 10, max: Math.round((lo * 0.63) / 10) * 10 }, minRwy, rangeNm, gs };
  }
  const label = (code) => (TYPES[code] ? `${code} · ${TYPES[code].name}` : code);
  const TO_CONF = { '1+F': { vs: 1.03, s: 1.06 }, '2': { vs: 1.0, s: 1.0 }, '3': { vs: 0.965, s: 0.93 } };
  const LDG_CONF = { FULL: { vs: 1.0, s: 1.0 }, '3': { vs: 1.04, s: 1.12 } };
  const COND_TO = { dry: 1.0, wet: 1.1, contam: 1.35 };
  const COND_LDG = { dry: 1.0, wet: 1.3, contam: 1.8 };
  const KT_PER_MS = 1.9438;

  const rad = (d) => (d * Math.PI) / 180;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // Dichteverhältnis aus Platzhöhe, QNH und Temperatur
  function density(elevFt, qnh, oatC) {
    const pa = elevFt + (1013.25 - qnh) * 27;
    const p = Math.pow(1 - 6.8756e-6 * pa, 5.2559);
    return { pa, sigma: clamp((p * 288.15) / (oatC + 273.15), 0.5, 1.3), isaDev: oatC - (15 - 1.98 * (pa / 1000)) };
  }
  function wind(rwyHdg, dir, spd) {
    const d = rad(dir - rwyHdg);
    return { head: spd * Math.cos(d), cross: spd * Math.sin(d) };
  }
  // Gegenwind zählt nur zur Hälfte, Rückenwind zu eineinhalb – wie in den Betriebsverfahren
  const effWind = (hw) => (hw >= 0 ? 0.5 * hw : 1.5 * hw);
  function windFactor(vCasKt, sigma, hw) {
    const v = vCasKt / Math.sqrt(sigma);
    return Math.pow(Math.max(0.35, (v - effWind(hw)) / v), 2);
  }

  function toDistance(T, p, W, f) {
    const conf = TO_CONF[p.conf] || TO_CONF['2'];
    const d = density(p.elev, p.qnh, p.oat);
    const vlof = 1.18 * T.vs2 * conf.vs * Math.sqrt(W / T.wref);
    const w = wind(p.rwyHdg, p.windDir, p.windSpd);
    return (T.s0 * conf.s * Math.pow(W / T.wref, 2) * (COND_TO[p.cond] || 1) * windFactor(vlof, d.sigma, w.head)) / (d.sigma * f);
  }

  // p: { type, conf, tow, tora, elev, qnh, oat, windDir, windSpd, rwyHdg, cond }
  function takeoff(p) {
    const T = TYPES[p.type];
    if (!T) return { error: 'Unbekannter Flugzeugtyp.' };
    if (!(p.tow > 0) || !(p.tora > 0)) return { error: 'Gewicht und Pistenlänge fehlen.' };
    if (p.tow < T.oew) return { error: 'Gewicht liegt unter dem Leergewicht.' };
    const conf = TO_CONF[p.conf] || TO_CONF['2'];
    const d = density(p.elev, p.qnh, p.oat);
    const w = wind(p.rwyHdg, p.windDir, p.windSpd);
    const out = { pa: d.pa, isaDev: d.isaDev, head: w.head, cross: w.cross, warnings: [] };
    if (p.tow > T.mtow) out.warnings.push(`Über dem maximalen Startgewicht (${Math.round(T.mtow)} kg).`);
    if (w.head < -10) out.warnings.push('Rückenwind über 10 kt.');
    if (Math.abs(w.cross) > 33) out.warnings.push('Seitenwind über 33 kt.');

    const sToga = toDistance(T, p, p.tow, 1);
    out.reqToga = sToga;
    out.fits = sToga <= p.tora;
    // größtes Gewicht für diese Piste (volle Leistung)
    let lo = T.oew, hi = T.mtow * 1.3;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (toDistance(T, p, m, 1) <= p.tora) lo = m; else hi = m; }
    out.maxTow = Math.min(lo, T.mtow);
    out.limitedBy = lo < T.mtow ? 'Pistenlänge' : 'MTOW';

    // Reduzierte Leistung (FLEX): größte Reduktion, die noch mit 3 % Reserve passt
    const fMin = 1 - (68 - T.tref) / 100;
    let flex = null, f = 1, req = sToga;
    if (out.fits) {
      const target = p.tora * 0.97;
      if (toDistance(T, p, p.tow, fMin) <= target) f = fMin;
      else if (toDistance(T, p, p.tow, 1) <= target) {
        let a = fMin, b = 1;
        for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (toDistance(T, p, p.tow, m) <= target) b = m; else a = m; }
        f = b;
      }
      const t = Math.floor(T.tref + (1 - f) * 100);
      if (f < 0.995 && t > p.oat) { flex = Math.min(68, t); f = 1 - (flex - T.tref) / 100; } else f = 1;
      req = toDistance(T, p, p.tow, f);
    }
    out.flex = flex; out.req = req; out.thrust = f;

    // Geschwindigkeiten
    // Großraumflugzeuge: höheres V2 (FMS-Mindestwerte), Gewichtsabhängigkeit nach unten begrenzt (VMC-Grenze)
    const wide = T.mtow > 150000;
    const wr = Math.max(p.tow / T.wref, 0.88);
    const v2 = Math.round((wide ? 1.26 : 1.2) * T.vs2 * conf.vs * Math.sqrt(wr));
    const vr = v2 - (wide ? 2 : 3);
    const tight = clamp((req / p.tora - 0.7) / 0.3, 0, 1);
    const v1 = Math.round(Math.max(T.v1min, vr - Math.round(8 * tight) - (p.cond === 'dry' ? 0 : p.cond === 'wet' ? 2 : 5)));
    out.v1 = Math.min(v1, vr); out.vr = vr; out.v2 = v2;
    return out;
  }

  function ldgBase(T, key, conf, cond) { return T.ldg[key] * conf.s * (COND_LDG[cond] || 1); }
  function ldgDistance(T, p, W, key) {
    const conf = LDG_CONF[p.conf] || LDG_CONF.FULL;
    const d = density(p.elev, p.qnh, p.oat);
    const w = wind(p.rwyHdg, p.windDir, p.windSpd);
    const vls = 1.23 * T.vsFull * conf.vs * Math.sqrt(W / T.mlw);
    const vapp = vls + approachAdd(p, w.head);
    const vapp0 = 1.23 * T.vsFull * conf.vs + 5;
    return (ldgBase(T, key, conf, p.cond) * Math.pow(vapp / vapp0, 2) * windFactor(vapp, d.sigma, w.head)) / d.sigma;
  }
  function approachAdd(p, head) {
    const gust = Math.max(0, (p.gust || 0) - p.windSpd);
    return clamp(Math.max(0, head) / 3 + gust, 5, 15);
  }

  // p: { type, conf, lw, lda, elev, qnh, oat, windDir, windSpd, gust, rwyHdg, cond }
  function landing(p) {
    const T = TYPES[p.type];
    if (!T) return { error: 'Unbekannter Flugzeugtyp.' };
    if (!(p.lw > 0) || !(p.lda > 0)) return { error: 'Gewicht und Pistenlänge fehlen.' };
    if (p.lw < T.oew) return { error: 'Gewicht liegt unter dem Leergewicht.' };
    const conf = LDG_CONF[p.conf] || LDG_CONF.FULL;
    const d = density(p.elev, p.qnh, p.oat);
    const w = wind(p.rwyHdg, p.windDir, p.windSpd);
    const out = { pa: d.pa, head: w.head, cross: w.cross, warnings: [] };
    out.vls = Math.round(1.23 * T.vsFull * conf.vs * Math.sqrt(p.lw / T.mlw));
    out.add = Math.round(approachAdd(p, w.head));
    out.vapp = out.vls + out.add;
    out.dist = { lo: ldgDistance(T, p, p.lw, 'lo'), med: ldgDistance(T, p, p.lw, 'med'), max: ldgDistance(T, p, p.lw, 'max') };
    out.rec = out.dist.lo <= p.lda ? 'lo' : out.dist.med <= p.lda ? 'med' : out.dist.max <= p.lda ? 'max' : null;
    let lo = T.oew, hi = T.mlw * 1.3;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (ldgDistance(T, p, m, 'med') <= p.lda) lo = m; else hi = m; }
    out.maxLw = Math.min(lo, T.mlw);
    if (p.lw > T.mlw) out.warnings.push(`Über dem maximalen Landegewicht (${Math.round(T.mlw)} kg).`);
    if (w.head < -10) out.warnings.push('Rückenwind über 10 kt.');
    if (Math.abs(w.cross) > 33) out.warnings.push('Seitenwind über 33 kt.');
    if (!out.rec) out.warnings.push('Piste zu kurz für diese Bedingungen – Gewicht oder Piste ändern.');
    return out;
  }

  // METAR → Wind, Temperatur, QNH
  function parseMetar(m) {
    const out = {};
    if (!m) return out;
    const w = String(m).match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\b/);
    if (w) {
      const k = w[4] === 'MPS' ? KT_PER_MS : 1;
      if (w[1] !== 'VRB') out.windDir = Number(w[1]);
      out.windSpd = Math.round(Number(w[2]) * k);
      if (w[3]) out.gust = Math.round(Number(w[3]) * k);
    }
    const t = String(m).match(/\s(M?\d{2})\/(M?\d{2})\s/);
    if (t) out.oat = Number(t[1].replace('M', '-'));
    const q = String(m).match(/\bQ(\d{4})\b/), a = String(m).match(/\bA(\d{4})\b/);
    if (q) out.qnh = Number(q[1]); else if (a) out.qnh = Math.round((Number(a[1]) / 100) * 33.8639);
    return out;
  }
  function rwyHeading(rwy) {
    const m = String(rwy || '').match(/^(\d{1,2})/);
    return m ? (Number(m[1]) * 10) % 360 || 360 : null;
  }

  return { TYPES, FAMILIES, label, density, wind, takeoff, landing, parseMetar, rwyHeading };
})();
if (typeof module !== 'undefined') module.exports = PerfModel;
