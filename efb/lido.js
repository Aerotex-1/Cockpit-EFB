// Lido-Charts aus dem MSFS 2024
//
// Die Charts gibt es nur innerhalb des Sims (SDK-Schnittstelle "JS_LISTENER_CHARTS").
// Ein kleines EFB-Modul im Sim (Ordner efb-app/) fragt diese Brücke regelmäßig nach Aufträgen,
// ruft Chart-Liste, Seiten und Bilder im Sim ab und schickt sie hierher. Die Brücke speichert
// alles zwischen und liefert es ans Tablet.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CACHE = path.join(__dirname, 'cache', 'lido');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Einteilung wie im FBW-flyPad
const CATEGORY = {
  AFC: 'ARPT', AGC: 'ARPT', AOI: 'ARPT', APC: 'ARPT', LVC: 'ARPT', MRC: 'ARPT', UNKNOWN: 'ARPT',
  IAC: 'APPR', VAC: 'APPR', SID: 'SID', SIDPT: 'SID', 'SID Initial Climb': 'SID', ObstDep: 'SID', STAR: 'STAR',
};

class Lido {
  constructor(efb, demo) {
    this.efb = efb;
    this.demo = demo;
    this.jobs = [];
    this.waiting = new Map(); // job-id -> {resolve, reject, timer}
    this.nextId = 1;
    this.lastPoll = 0;
    this.appVersion = null;
    this.indexCache = new Map();
    this.pagesCache = new Map();
    this.raws = new Map(); // job-id -> {w,h,buf}
    fs.mkdirSync(CACHE, { recursive: true });
  }

  log(msg, v) {
    const line = `[SIM-MODUL${v ? ' ' + v : ''}] ${msg}`;
    console.log(line);
    this.lastLog = { t: Date.now(), msg: String(msg) };
  }

  connected() { return this.demo || Date.now() - this.lastPoll < 5000; }
  status() { return { connected: this.connected(), demo: this.demo, appVersion: this.demo ? 'Demo' : this.appVersion, lastLog: this.lastLog || null }; }

  // ---------- Seite des Sim-Moduls ----------
  poll(version) {
    if (!this.connected() && !this.demo) console.log('[SIM-MODUL] verbunden' + (version ? ` (Version ${version})` : ''));
    this.lastPoll = Date.now();
    if (version) this.appVersion = version;
    const jobs = this.jobs.splice(0, this.jobs.length);
    const out = { jobs };
    if (this.efb.failureQueue) { out.fbwFailures = this.efb.failureQueue; this.efb.failureQueue = null; }
    return out;
  }

  result({ id, ok, data, error, dataUrl }) {
    const w = this.waiting.get(id);
    if (!w) return;
    this.waiting.delete(id);
    clearTimeout(w.timer);
    if (ok && data && data.rawDone) {
      const raw = this.raws.get(id); this.raws.delete(id);
      if (!raw) return w.reject(new Error('Keine Bilddaten empfangen'));
      try { return w.resolve({ dataUrl: 'data:image/png;base64,' + encodePng(raw.w, raw.h, raw.buf).toString('base64') }); } catch (e) { return w.reject(e); }
    }
    if (ok) w.resolve(dataUrl !== undefined ? { dataUrl, ...data } : data);
    else w.reject(new Error(error || 'Fehler im Sim'));
  }

  // Ein Streifen des Bildes (RGB, roh) aus dem Sim
  stripe(id, y, w, rows, h, buf) {
    let r = this.raws.get(id);
    if (!r || r.w !== w || r.h !== h) { r = { w, h, buf: Buffer.alloc(w * h * 3, 255) }; this.raws.set(id, r); }
    buf.copy(r.buf, y * w * 3, 0, Math.min(buf.length, rows * w * 3));
  }

  _job(type, args, timeoutMs = 20000) {
    if (!this.connected()) return Promise.reject(new Error('Das Lido-Modul im Sim ist nicht verbunden.'));
    const id = this.nextId++;
    this.jobs.push({ id, type, ...args });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiting.delete(id); reject(new Error('Zeitüberschreitung beim Sim')); }, timeoutMs);
      this.waiting.set(id, { resolve, reject, timer });
    });
  }

  // ---------- Seite des Tablets ----------
  async index(icao) {
    icao = icao.toUpperCase();
    const c = this.indexCache.get(icao);
    if (c && Date.now() - c.t < 30 * 60 * 1000) return c.data;
    const raw = this.demo ? this._demoIndex(icao) : await this._job('index', { icao });
    const groups = { SID: [], STAR: [], APPR: [], ARPT: [] };
    for (const cat of raw.charts || []) {
      for (const ch of cat.charts || []) {
        const g = CATEGORY[ch.type] || 'ARPT';
        groups[g].push({
          guid: ch.guid, name: ch.name, type: ch.type, geo: !!ch.geoReferenced,
          runways: (ch.runways || []).map((r) => `${r.number}${r.designator || ''}`),
        });
      }
    }
    for (const g of Object.keys(groups)) groups[g].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
    const data = { icao, groups };
    this.indexCache.set(icao, { t: Date.now(), data });
    return data;
  }

  async pages(guid) {
    if (this.pagesCache.has(guid)) return this.pagesCache.get(guid);
    const raw = this.demo ? this._demoPages(guid) : await this._job('pages', { guid });
    const pages = (raw.pages || []).map((p) => ({
      width: p.width, height: p.height, geo: !!p.geoReferenced,
      areas: (p.areas || []).filter((a) => a.geoReferenced).map((a) => ({
        chartRectangle: a.chartRectangle, worldRectangle: a.worldRectangle, projection: a.projection, layer: a.layer,
      })),
      urls: Object.fromEntries((p.urls || []).map((u) => [u.name, u.url])),
    }));
    const data = { guid, pages };
    this.pagesCache.set(guid, data);
    return data;
  }

  // Liefert den Pfad zur Bilddatei (PNG oder im Demo SVG)
  async image(guid, page, theme) {
    const safe = guid.replace(/[^a-zA-Z0-9_-]/g, '_');
    const file = path.join(CACHE, `${safe}_${page}_${theme}.png`);
    if (fs.existsSync(file)) return file;
    if (this.demo) return null;
    const p = (await this.pages(guid)).pages[page];
    if (!p) throw new Error('Seite nicht vorhanden');
    const url = (theme === 'dark' && p.urls.dark_png) || p.urls.light_png || p.urls.dark_png;
    if (!url) throw new Error('Keine Bildadresse für diese Seite');

    // 1. Versuch: Adresse direkt laden (falls öffentlich erreichbar)
    if (/^https?:/i.test(url)) {
      try {
        const r = await fetch(url);
        if (r.ok && /image/.test(r.headers.get('content-type') || '')) {
          fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
          return file;
        }
      } catch { /* weiter mit dem Sim */ }
    }
    // 2. Versuch: Das Sim-Modul rendert das Bild und schickt es als PNG
    const res = await this._job('image', { guid, page, url }, 30000);
    const m = /^data:image\/\w+;base64,(.+)$/.exec(res.dataUrl || '');
    if (!m) throw new Error(`Das Sim-Modul hat kein Bild geliefert (${res.error || String(res.dataUrl || '').slice(0, 40) || 'leer'})`);
    fs.writeFileSync(file, Buffer.from(m[1], 'base64'));
    return file;
  }

  // ---------- Demo-Daten (nur zum Testen der Oberfläche) ----------
  _demoIndex(icao) {
    const mk = (guid, name, type, geo) => ({ guid: `${icao}-${guid}`, name, type, geoReferenced: geo, runways: [{ number: '26', designator: 'R' }] });
    return { charts: [{ name: 'all', charts: [
      mk('AGC', `${icao} Airport Ground Chart (Demo)`, 'AGC', true),
      mk('SID1', 'SID RWY 26R – Demo', 'SID', true),
      mk('STAR1', 'STAR RWY 08L/26R – Demo', 'STAR', false),
      mk('IAC1', 'ILS Z RWY 26R – Demo', 'IAC', true),
    ] }] };
  }

  _demoPages(guid) {
    // Bereich rund um Leipzig/Halle, damit der Flieger auf der Karte erscheint
    return { pages: [{
      width: 1000, height: 1400, geoReferenced: true,
      areas: [{ geoReferenced: true, layer: 'main',
        chartRectangle: { upperLeft: [50, 150], lowerRight: [950, 1250], orientation: 0 },
        worldRectangle: { upperLeft: [12.12, 51.50], lowerRight: [12.36, 51.36], orientation: 0 },
        projection: { standardParallel1: 49, standardParallel2: 53, centralMeridian: 12 } }],
      urls: [{ name: 'light_png', url: `demo:${guid}` }],
    }] };
  }

  demoSvg(guid, theme) {
    const bg = theme === 'dark' ? '#111' : '#fff', fg = theme === 'dark' ? '#ddd' : '#111';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400" viewBox="0 0 1000 1400">
<rect width="1000" height="1400" fill="${bg}"/><rect x="50" y="150" width="900" height="1100" fill="none" stroke="${fg}" stroke-width="3"/>
<text x="50" y="80" font-family="sans-serif" font-size="34" fill="${fg}">${guid.replace(/[<&>]/g, '')} – Demo-Chart</text>
<text x="50" y="120" font-family="sans-serif" font-size="20" fill="${fg}">Platzhalter. Echte Lido-Charts kommen über das Sim-Modul.</text>
<line x1="320" y1="640" x2="760" y2="710" stroke="${fg}" stroke-width="14"/><text x="770" y="720" font-family="sans-serif" font-size="22" fill="${fg}">26R</text>
<line x1="290" y1="760" x2="730" y2="830" stroke="${fg}" stroke-width="14"/><text x="740" y="840" font-family="sans-serif" font-size="22" fill="${fg}">26L</text>
</svg>`;
  }
}

// Minimaler PNG-Schreiber (RGB, 8 Bit)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgb) {
  const stride = w * 3, raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

module.exports = { Lido, sleep, encodePng };
