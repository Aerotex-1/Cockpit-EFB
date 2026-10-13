// Cockpit EFB – PC-Brücke
// Startet einen kleinen Webserver, den das iPad im WLAN aufruft.
// Start: "npm start" (mit MSFS) oder "npm run demo" (Testdaten)

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SimLink } = require('./sim');
const { Gsx } = require('./gsx');
const { Efb } = require('./efb');
const { Lido } = require('./lido');
const vatsim = require('./vatsim');
const metar = require('./metar');
let lights = null;
try { lights = require('./lights'); } catch { /* öffentliche Version ohne Lichter */ }
const atc = require('./atc');
const wx = require('./wx');
const { Settings, BG_DIR } = require('./settings');
const { Logbook } = require('./logbook');
const { Auth, isLoopback } = require('./auth');
const VERSION = require('./package.json').version;
const { Spotify } = require('./spotify');
const updater = require('./updater');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const CHARTS = path.join(ROOT, 'charts');
const CONFIG_FILE = path.join(ROOT, 'config.json');

let config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
let lastOfp = null;
const OFP_FILE = path.join(ROOT, 'cache', 'last-ofp.json');
try { lastOfp = JSON.parse(fs.readFileSync(OFP_FILE, 'utf8')); } catch { /* noch keiner */ }

const { PROFILES: NEW_PROFILES } = require('./profiles');
// Umstellung von Version 0.1: SimBridge hat keine Remote-EFB, nur die MCDU.
// Die alte (falsche) EFB-Adresse wird deshalb geleert.
let migrated = false;
for (const a of config.aircraft || []) {
  if (a.efbUrl === 'http://{host}:8380/') { a.efbUrl = ''; migrated = true; }
}
// Umstellung von Version 0.2: Remote-EFB und Rechner je Flieger
const KIND_BY_ID = { 'fbw-a32nx': ['fbw-a320', 'fbw-a320'], 'headwind-a339x': ['hdw-a339', 'hdw-a339'], 'fbw-a380x': ['fbw-a380', 'fbw-a380'], 'fenix-a320': ['', 'fbw-a320'] };
for (const a of config.aircraft || []) {
  if (a.remote === undefined) {
    const k = KIND_BY_ID[a.id] || ['', ''];
    a.remote = k[0]; a.perf = k[1];
    if (k[0]) a.notes = '';
    migrated = true;
  }
}
// Umstellung von Version 1.1.5: Flieger nach Hersteller und Entwickler getrennt; Boeing-/iniBuilds-/Standard-Profile neu
if ((config.profilesV || 0) < 2) {
  const meta = { 'fbw-a32nx': ['Airbus', 'FlyByWire', 'A320neo'], 'fenix-a320': ['Airbus', 'Fenix', 'A320'], 'headwind-a339x': ['Airbus', 'Headwind', 'A330-900neo'], 'fbw-a380x': ['Airbus', 'FlyByWire', 'A380-800'] };
  config.aircraft = (config.aircraft || []).filter((a) => !/^(boeing|inibuilds|msfs)-/.test(a.id));
  for (const a of config.aircraft) if (meta[a.id]) { [a.maker, a.dev, a.name] = meta[a.id]; }
  config.profilesV = 2; migrated = true;
}
for (const a of NEW_PROFILES) {
  if (!(config.aircraft = config.aircraft || []).some((x) => x.id === a.id)) { config.aircraft.push(JSON.parse(JSON.stringify(a))); migrated = true; }
}
if (config.chartfoxToken !== undefined) { delete config.chartfoxToken; migrated = true; }
if (config.gsxMenuFile === undefined) { config.gsxMenuFile = ''; migrated = true; }
if (config.spotifyClientId === undefined) { config.spotifyClientId = ''; migrated = true; }
if (config.gsxChoiceOffset === undefined) { config.gsxChoiceOffset = 0; migrated = true; }
if (migrated) fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
const auth = new Auth(() => config, saveConfig);
const spotify = new Spotify(() => config, config.port, process.argv.includes('--demo'));
const sim = new SimLink({ demo: process.argv.includes('--demo') });
sim.start();
const gsx = new Gsx(sim, () => config);
const efb = new Efb(sim);
if (lights) { efb.extra = lights.watch(); efb._applyWatch(); }
const lido = new Lido(efb, sim.demo);
const settings = new Settings();
let airportList = [];
try { airportList = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'airports.json'), 'utf8')); } catch { /* ohne Liste */ }
const logbook = new Logbook({ sim, getOfp: () => lastOfp, getSettings: () => settings.get(), airports: airportList });
const liveState = () => ({ ...sim.state, gsxInfo: gsx.status(), efb: efb.status(), lido: lido.status(), lights: lights ? lights.status(sim.state.vars) : null });

// ---------- Live-Daten per Server-Sent Events (max. 4x pro Sekunde) ----------
const clients = new Set();
let dirty = true;
sim.on('update', () => { dirty = true; });
setInterval(() => {
  if (!dirty || !clients.size) return;
  dirty = false;
  const msg = `data: ${JSON.stringify(liveState())}\n\n`;
  for (const res of clients) res.write(msg);
}, 250);
setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000);

// ---------- Hilfsfunktionen ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json',
};

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 40e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

function serveFile(res, baseDir, relPath) {
  const file = path.normalize(path.join(baseDir, relPath));
  if (file !== baseDir && !file.startsWith(baseDir + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

function listCharts() {
  const out = {};
  if (!fs.existsSync(CHARTS)) return out;
  for (const icao of fs.readdirSync(CHARTS)) {
    const dir = path.join(CHARTS, icao);
    if (!fs.statSync(dir).isDirectory()) continue;
    out[icao.toUpperCase()] = fs.readdirSync(dir)
      .filter((f) => /\.(pdf|png|jpe?g)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
  }
  return out;
}

function localIps() {
  return Object.values(os.networkInterfaces()).flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}


// ---------- Kartenkacheln (OpenStreetMap, kostenlos, über die Brücke zwischengespeichert) ----------
const TILE_CACHE = path.join(ROOT, 'cache', 'tiles');
const tileQueue = new Map();
async function serveTile(res, z, x, y) {
  if (![z, x, y].every((n) => Number.isInteger(n) && n >= 0) || z > 19) { res.writeHead(400); return res.end(); }
  const file = path.join(TILE_CACHE, String(z), String(x), `${y}.png`);
  const send = () => { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=604800' }); fs.createReadStream(file).pipe(res); };
  try {
    const st = fs.statSync(file);
    if (Date.now() - st.mtimeMs < 30 * 86400000) return send();
  } catch { /* noch nicht im Speicher */ }
  const key = `${z}/${x}/${y}`;
  try {
    if (!tileQueue.has(key)) {
      tileQueue.set(key, (async () => {
        const tpl = config.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
        const r = await fetch(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y).replace('{key}', encodeURIComponent(config.tileKey || '')), { headers: { 'User-Agent': `CockpitEFB/${VERSION} (+https://github.com/cockpit-efb)` } });
        if (!r.ok) throw new Error(`Kartenserver ${r.status}`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      })().finally(() => tileQueue.delete(key)));
    }
    await tileQueue.get(key);
    send();
  } catch {
    if (fs.existsSync(file)) return send(); // alte Kachel ist besser als keine
    res.writeHead(502); res.end();
  }
}

// ---------- Routen ----------
const server = http.createServer(async (req, res) => {
  let url, p;
  try { url = new URL(req.url, 'http://x'); p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  if (auth.gate(req, res, p, readBody)) return;
  const local = isLoopback(req.socket.remoteAddress);
  const cfgFor = () => { if (local) return config; const { pin, ...rest } = config; return rest; };

  try {
    if (p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(liveState())}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p === '/api/state') return sendJson(res, 200, liveState());
    if (p === '/api/copilot') {
      const f = path.join(__dirname, 'copilot.json');
      const read = () => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };
      if (req.method === 'GET') return sendJson(res, 200, read());
      if (req.method === 'POST') {
        const b = await readBody(req), o = read();
        if (['de', 'en'].includes(b.lang)) o.lang = b.lang;
        if (typeof b.rate === 'number' && b.rate >= 0.5 && b.rate <= 2) o.rate = b.rate;
        if (typeof b.mic === 'boolean') o.mic = b.mic;
        if (typeof b.autostart === 'boolean') o.autostart = b.autostart;
        if (b.voice && typeof b.voice === 'object') { o.voice = o.voice || {}; for (const k of ['de', 'en']) if (typeof b.voice[k] === 'string') o.voice[k] = b.voice[k].slice(0, 200); }
        fs.writeFileSync(f, JSON.stringify(o, null, 2));
        return sendJson(res, 200, o);
      }
    }
    if (p === '/api/update/install' && req.method === 'POST') {
      if (!local) return sendJson(res, 403, { error: 'Updates nur am PC möglich.' });
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > 150e6) return sendJson(res, 413, { error: 'Datei zu groß.' }); chunks.push(c); }
      try { return sendJson(res, 200, updater.install(Buffer.concat(chunks))); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    }
    if (p === '/api/update/restart' && req.method === 'POST') {
      if (!local) return sendJson(res, 403, { error: 'Nur am PC möglich.' });
      const managed = ['bat', 'app'].includes(process.env.EFB_LAUNCHER);
      sendJson(res, 200, { managed });
      if (managed) setTimeout(() => process.exit(42), 400);
      return;
    }
    if (p === '/api/info') return sendJson(res, 200, { ips: localIps(), port: config.port, version: VERSION });

    if (p === '/api/config' && req.method === 'GET') return sendJson(res, 200, cfgFor());
    if (p === '/api/auth/status') return sendJson(res, 200, local ? { local: true, requirePin: !!config.requirePin, pin: auth.hasPin() ? config.pin : '', hasPin: auth.hasPin(), devices: auth.sessions.length } : { local: false, requirePin: !!config.requirePin, paired: true });
    if (p === '/api/pair/state') return sendJson(res, 200, { needsPin: !auth.hasPin() });
    if (p === '/api/auth/setpin' && req.method === 'POST') { if (!local) return sendJson(res, 403, { error: 'Nur am PC möglich.' }); try { return sendJson(res, 200, { pin: auth.setPin((await readBody(req)).pin) }); } catch (e) { return sendJson(res, 400, { error: e.message }); } }
    if (p === '/api/auth/reset' && req.method === 'POST') { if (!local) return sendJson(res, 403, { error: 'Nur am PC möglich.' }); const pin = auth.reset(); return sendJson(res, 200, { pin, devices: 0 }); }
    if (p === '/api/config' && req.method === 'POST') {
      const body = await readBody(req);
      if (typeof body.simbriefUser === 'string') config.simbriefUser = body.simbriefUser.trim();
      if (Array.isArray(body.aircraft)) config.aircraft = body.aircraft;
      if (typeof body.spotifyClientId === 'string') config.spotifyClientId = body.spotifyClientId.trim();
      if (typeof body.gsxMenuFile === 'string' && body.gsxMenuFile.trim() !== (config.gsxMenuFile || '')) {
        config.gsxMenuFile = body.gsxMenuFile.trim();
        if (!sim.demo) gsx.locate();
      }
      saveConfig();
      return sendJson(res, 200, cfgFor());
    }

    if (p === '/api/simbrief') {
      const user = (url.searchParams.get('user') || config.simbriefUser || '').trim();
      if (url.searchParams.get('cached') && lastOfp) return sendJson(res, 200, lastOfp);
      if (!user) return sendJson(res, 400, { error: 'Kein SimBrief-Benutzername eingetragen (Einstellungen).' });
      const param = /^\d+$/.test(user) ? 'userid' : 'username';
      const r = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?${param}=${encodeURIComponent(user)}&json=1`, { headers: { 'User-Agent': `CockpitEFB/${VERSION}` } });
      const data = await r.json();
      if (data.fetch && data.fetch.status && data.fetch.status !== 'Success') {
        return sendJson(res, 404, { error: `SimBrief: ${data.fetch.status}` });
      }
      lastOfp = data;
      try { fs.mkdirSync(path.dirname(OFP_FILE), { recursive: true }); fs.writeFileSync(OFP_FILE, JSON.stringify(data)); } catch { /* egal */ }
      return sendJson(res, 200, data);
    }

    const tm = /^\/tiles\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(p);
    if (tm) return serveTile(res, Number(tm[1]), Number(tm[2]), Number(tm[3]));
    if (p === '/api/charts') return sendJson(res, 200, listCharts());
    if (p === '/api/charts/upload' && req.method === 'POST') {
      const q = url.searchParams, icao = String(q.get('icao') || '').toUpperCase();
      if (!/^[A-Z0-9]{3,4}$/.test(icao)) return sendJson(res, 400, { error: 'ICAO fehlt oder ist ungültig' });
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > 30e6) return sendJson(res, 413, { error: 'Bild zu groß (max. 30 MB)' }); chunks.push(c); }
      const buf = Buffer.concat(chunks);
      const ext = buf.slice(0, 4).toString('hex') === '89504e47' ? 'png' : buf.slice(0, 3).toString('hex') === 'ffd8ff' ? 'jpg' : buf.slice(0, 4).toString() === '%PDF' ? 'pdf' : null;
      if (!ext) return sendJson(res, 400, { error: 'Nur PNG, JPG oder PDF' });
      let name = String(q.get('name') || '').replace(/[^\wäöüÄÖÜß .+()-]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60) || `ChartFox ${new Date().toISOString().slice(0, 16).replace('T', ' ').replace(':', '-')}`;
      const dir = path.join(CHARTS, icao); fs.mkdirSync(dir, { recursive: true });
      let file = `${name}.${ext}`, n = 2;
      while (fs.existsSync(path.join(dir, file))) file = `${name} (${n++}).${ext}`;
      fs.writeFileSync(path.join(dir, file), buf);
      return sendJson(res, 200, { ok: true, icao, file });
    }
    if (p === '/api/charts/delete' && req.method === 'POST') {
      const { icao, file } = await readBody(req);
      if (!/^[A-Z0-9]{3,4}$/.test(String(icao)) || !/^[^\\/]+\.(png|jpe?g|pdf)$/i.test(String(file))) return sendJson(res, 400, { error: 'Ungültig' });
      fs.rmSync(path.join(CHARTS, icao, file), { force: true });
      return sendJson(res, 200, { ok: true });
    }
    if (p.startsWith('/charts/')) return serveFile(res, CHARTS, p.slice('/charts/'.length));

    if (p === '/api/gsx/service' && req.method === 'POST') {
      const { service } = await readBody(req);
      return sendJson(res, 200, await gsx.requestService(service));
    }
    if (p === '/api/gsx/refresh' && req.method === 'POST') return sendJson(res, 200, await gsx.refresh());
    if (p === '/api/gsx/choose' && req.method === 'POST') {
      const { index } = await readBody(req);
      return sendJson(res, 200, { ok: gsx.choose(Number(index)) });
    }
    if (p === '/api/gsx/locate' && req.method === 'POST') return sendJson(res, 200, { menuFile: gsx.locate() });

    // ---------- Remote-EFB ----------
    if (p === '/api/efb/kind' && req.method === 'POST') {
      const { kind } = await readBody(req);
      return sendJson(res, 200, { kind: efb.setKind(kind) });
    }
    if (p === '/api/efb/action' && req.method === 'POST') {
      const { action, value } = await readBody(req);
      return sendJson(res, 200, efb.action(action, value));
    }

    // ---------- Lido: Seite des Sim-Moduls ----------
    if (p === '/api/lido/poll') return sendJson(res, 200, lido.poll(url.searchParams.get('v')));
    if (p === '/api/lido/result' && req.method === 'POST') { lido.result(await readBody(req)); return sendJson(res, 200, { ok: true }); }
    if (p === '/api/lido/stripe' && req.method === 'POST') {
      const q = url.searchParams, chunks = [];
      for await (const c of req) chunks.push(c);
      lido.stripe(Number(q.get('job')), Number(q.get('y')), Number(q.get('w')), Number(q.get('rows')), Number(q.get('h')), Buffer.concat(chunks));
      return sendJson(res, 200, { ok: true });
    }
    if (p === '/api/lido/log' && req.method === 'POST') { const b = await readBody(req); lido.log(b.msg, b.v); return sendJson(res, 200, { ok: true }); }
    // Einfacher Weg für Meldungen aus dem Sim (als Bild-Anfrage, funktioniert auch, wenn fetch gesperrt ist)
    if (p === '/api/lido/log' && req.method === 'GET') {
      lido.log(`${url.searchParams.get('msg') || ''}${url.searchParams.get('via') ? ' [über ' + url.searchParams.get('via') + ']' : ''}`, url.searchParams.get('v'));
      res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' });
      return res.end(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'));
    }

    // ---------- Lido: Seite des iPads ----------
    if (p === '/api/lido/index') return sendJson(res, 200, await lido.index(url.searchParams.get('icao') || ''));
    if (p === '/api/lido/pages') return sendJson(res, 200, await lido.pages(url.searchParams.get('guid') || ''));
    if (p === '/api/lido/image') {
      const guid = url.searchParams.get('guid') || '', page = Number(url.searchParams.get('page') || 0);
      const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
      if (sim.demo) { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end(lido.demoSvg(guid, theme)); }
      const file = await lido.image(guid, page, theme);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=86400' });
      return fs.createReadStream(file).pipe(res);
    }

    // ---------- VATSIM ----------
    if (p === '/api/vatsim') {
      const bbox = (url.searchParams.get('bbox') || '').split(',').map(Number);
      const airports = (url.searchParams.get('airports') || '').split(',');
      return sendJson(res, 200, await vatsim.query({ bbox: bbox.length === 4 && bbox.every(isFinite) ? bbox : null, airports }));
    }

    // ---------- Außenlichter (nur private Version) ----------
    if (lights && p === '/api/lights/action' && req.method === 'POST') {
      const b = await readBody(req);
      return sendJson(res, 200, { ok: b.scene ? lights.scene(sim, String(b.scene)) : lights.toggle(sim, String(b.key)) });
    }

    // ---------- Live-Wetter am Flughafen (METAR, ATIS) ----------
    if (p === '/api/metar') {
      const q = { icaos: (url.searchParams.get('icao') || '').split(','), lat: parseFloat(url.searchParams.get('lat')), lon: parseFloat(url.searchParams.get('lon')) };
      return sendJson(res, 200, process.argv.includes('--demo') ? metar.demo(q) : await metar.query(q));
    }

    // ---------- Wetter (Höhenwind, Wolken) und Bodenkarte ----------
    if (p === '/api/wx/grid' || p === '/api/wx/profile' || p === '/api/ground') {
      const demo = process.argv.includes('--demo');
      const bb = (url.searchParams.get('bbox') || '').split(',').map(Number);
      try {
        if (p === '/api/wx/grid') return sendJson(res, 200, demo ? wx.demoGrid(bb) : await wx.grid(bb));
        if (p === '/api/wx/profile') { const la = url.searchParams.get('lat'), lo = url.searchParams.get('lon'); return sendJson(res, 200, demo ? wx.demoProfile(la, lo) : await wx.profile(la, lo)); }
        return sendJson(res, 200, demo ? wx.demoGround(bb) : await wx.ground(bb, config.overpassUrl));
      } catch (e) { return sendJson(res, 502, { error: e.message }); }
    }

    // ---------- Einstellungen, Hintergründe, Logbuch ----------
    if (p === '/api/settings' && req.method === 'GET') return sendJson(res, 200, settings.get());
    if (p === '/api/settings' && req.method === 'POST') return sendJson(res, 200, settings.set(await readBody(req)));
    if (p === '/api/bg' && req.method === 'POST') {
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > 8e6) return sendJson(res, 413, { error: 'Bild zu groß (max. 8 MB)' }); chunks.push(c); }
      try { return sendJson(res, 200, { file: settings.saveBg(url.searchParams.get('name') || 'bg', Buffer.concat(chunks)) }); }
      catch (e) { return sendJson(res, 400, { error: e.message }); }
    }
    if (p.startsWith('/bg/')) return serveFile(res, BG_DIR, p.slice(4));
    if (p === '/api/logbook' && req.method === 'GET') return sendJson(res, 200, { entries: logbook.list(), active: logbook.active(), size: logbook.size() });
    if (p === '/api/logbook.csv') { res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="logbuch.csv"' }); return res.end(logbook.csv()); }
    if (p === '/api/logbook/add' && req.method === 'POST') return sendJson(res, 200, { entry: logbook.add(await readBody(req)) });
    if (p === '/api/logbook/update' && req.method === 'POST') { const b = await readBody(req); return sendJson(res, 200, { entry: logbook.update(String(b.id), b.patch || {}) }); }
    if (p === '/api/logbook/delete' && req.method === 'POST') { const b = await readBody(req); return sendJson(res, 200, { removed: logbook.remove(Array.isArray(b.ids) ? b.ids : []) }); }
    if (p === '/api/logbook/prune' && req.method === 'POST') { const b = await readBody(req); return sendJson(res, 200, { removed: logbook.prune({ olderThanDays: Number(b.olderThanDays) || 0, airline: b.airline, all: b.all === true }) }); }

    if (await spotify.handle(req, res, url, p, readBody, sendJson)) return;
    if (p === '/api/atc' && req.method === 'POST') return sendJson(res, 200, process.argv.includes('--demo') ? atc.demo(await readBody(req)) : await atc.query(await readBody(req)));

    if (p.startsWith('/api/')) return sendJson(res, 404, { error: 'Unbekannt' });
    return serveFile(res, PUBLIC, p === '/' ? 'index.html' : p);
  } catch (e) {
    console.error('[HTTP]', e);
    return sendJson(res, 500, { error: e.message });
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('');
    console.log(`  Die PC-Brücke läuft schon (Port ${config.port} ist belegt).`);
    console.log('  Bitte das andere start.bat-Fenster benutzen oder es schließen und dieses neu starten.');
    console.log('');
    process.exit(1);
  }
  throw e;
});

server.listen(config.port, '0.0.0.0', () => {
  console.log('');
  console.log('  Cockpit EFB läuft.');
  console.log('  Auf dem iPad in Safari öffnen:');
  for (const ip of localIps()) console.log(`    http://${ip}:${config.port}`);
  if (config.requirePin) {
    console.log('');
    if (auth.hasPin()) { console.log(`  Kopplungs-PIN fürs iPad: ${config.pin}`); console.log('  (steht auch im EFB unter Setup → Zugang, wenn du es am PC öffnest)'); }
    else { console.log('  Noch keine PIN festgelegt. Öffne die Adresse am iPad und lege dort deine PIN fest'); console.log('  (oder am PC unter Setup → Zugang). Bis dahin kann das erste Gerät im WLAN sie festlegen.'); }
  }
  console.log('');
});
