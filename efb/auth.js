// Zugangsschutz der PC-Brücke: nur lokales Netz, Kopplung der Geräte per PIN, Schutz vor fremden Webseiten
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, 'auth.json');
const IDLE_MS = 5 * 60 * 1000;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const norm = (a) => String(a || '').replace(/^::ffff:/, '');

function isLoopback(addr) { addr = norm(addr); return addr === '::1' || addr === '127.0.0.1' || /^127\./.test(addr); }
function isPrivate(addr) {
  addr = norm(addr);
  if (isLoopback(addr)) return true;
  if (/^10\./.test(addr) || /^192\.168\./.test(addr) || /^169\.254\./.test(addr)) return true;
  const m = /^172\.(\d+)\./.exec(addr); if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(addr)) return true; // Tailscale/CGNAT
  if (/^f[cd][0-9a-f]{2}:/i.test(addr) || /^fe80:/i.test(addr)) return true;
  return false;
}
// Schutz vor "DNS-Rebinding": der Host-Name muss eine IP, localhost oder ein lokaler Name sein
function hostOk(host) {
  const h = String(host || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  if (!h) return false;
  return /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || h === 'localhost' || h.endsWith('.local') || !h.includes('.');
}
// Fremde Webseiten im Browser dürfen die Brücke nicht ansprechen. Erlaubt: kein Origin, Sim-Modul (coui:/file:), gleicher oder lokaler Host
function originOk(origin, host) {
  if (!origin) return true;
  if (/^(coui|file):/i.test(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true; // nur Webseiten sind ein Risiko, Sim-Oberflächen nicht
    return u.host === host || ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch { return false; }
}

class Auth {
  constructor(getConfig, saveConfig) {
    this.cfg = getConfig; this.save = saveConfig;
    this.sessions = [];
    try { this.sessions = JSON.parse(fs.readFileSync(FILE, 'utf8')).sessions || []; } catch { /* neu */ }
    this.fails = new Map();
    const c = this.cfg();
    if (c.requirePin === undefined) { c.requirePin = true; this.save(); }
    // Standard: Die PIN wird bei jedem Öffnen der EFB abgefragt (am PC in der App oder unter Setup → Zugang abschaltbar)
    if (c.pinEvery === undefined) { c.pinEvery = true; this.save(); }
    // Ohne gültige PIN legt der Nutzer sie beim ersten Öffnen am iPad (oder am PC unter Setup) selbst fest
    if (c.pin !== undefined && !/^\d{4,8}$/.test(String(c.pin))) { delete c.pin; this.save(); }
  }
  hasPin() { return /^\d{4,8}$/.test(String(this.cfg().pin || '')); }
  issue(req, res, send) {
    const ip = norm(req.socket.remoteAddress), token = crypto.randomBytes(32).toString('hex');
    this.sessions.push({ h: sha(token), at: Date.now(), last: Date.now(), fresh: true, ip, ua: String(req.headers['user-agent'] || '').slice(0, 80) });
    if (this.sessions.length > 20) this.sessions.shift();
    this.persist();
    return send(200, { ok: true }, { 'Set-Cookie': `efb_auth=${token}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Strict` });
  }
  // Erste PIN vom iPad aus (nur solange noch keine gesetzt ist)
  setFirst(req, res, body) {
    const send = (code, o, headers) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(headers || {}) }); res.end(JSON.stringify(o)); };
    if (this.hasPin()) return send(403, { error: 'Es gibt schon eine PIN.' });
    const pin = String(body.pin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) return send(400, { error: 'Die PIN braucht 4 bis 8 Ziffern.' });
    this.cfg().pin = pin; this.save();
    return this.issue(req, res, send);
  }
  // PIN ändern (nur am PC); gekoppelte Geräte bleiben gekoppelt
  setPin(pin) {
    pin = String(pin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) throw new Error('Die PIN braucht 4 bis 8 Ziffern.');
    this.cfg().pin = pin; this.save(); return pin;
  }
  persist() { try { fs.writeFileSync(FILE, JSON.stringify({ sessions: this.sessions }), { mode: 0o600 }); } catch { /* egal */ } }
  findSession(req) {
    const m = /(?:^|;\s*)efb_auth=([a-f0-9]{64})/.exec(req.headers.cookie || '');
    if (!m) return null;
    const h = sha(m[1]);
    return this.sessions.find((x) => x.h === h) || null;
  }
  drop(s) { this.sessions = this.sessions.filter((x) => x !== s); this.persist(); }
  cookieValid(req) {
    const s = this.findSession(req);
    if (!s) return false;
    // Im Modus „PIN bei jedem Öffnen“ verfällt die Kopplung, wenn die EFB länger als 5 Minuten nichts angefragt hat (iPad im Hintergrund)
    if (this.cfg().pinEvery && Date.now() - s.last > IDLE_MS) { this.drop(s); return false; }
    s.last = Date.now(); return true;
  }
  pair(req, res, body) {
    const ip = norm(req.socket.remoteAddress), f = this.fails.get(ip) || { n: 0, until: 0 };
    const send = (code, o, headers) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(headers || {}) }); res.end(JSON.stringify(o)); };
    if (!this.hasPin()) return send(409, { error: 'Es ist noch keine PIN festgelegt.' });
    if (Date.now() < f.until) return send(429, { error: `Zu viele Versuche. Bitte in ${Math.ceil((f.until - Date.now()) / 1000)} Sekunden erneut versuchen.` });
    const a = Buffer.from(sha(String(body.pin || '').trim())), b = Buffer.from(sha(this.cfg().pin || ''));
    if (!crypto.timingSafeEqual(a, b)) {
      f.n++; if (f.n >= 5) { f.until = Date.now() + 5 * 60000; f.n = 0; }
      this.fails.set(ip, f);
      return send(401, { error: 'PIN falsch.' });
    }
    this.fails.delete(ip);
    return this.issue(req, res, send);
  }
  // Neue PIN, alle Geräte abmelden (nur am PC)
  reset() {
    this.sessions = []; this.persist();
    const c = this.cfg(); c.pin = String(crypto.randomInt(0, 1e6)).padStart(6, '0'); this.save();
    return c.pin;
  }
  // true = Anfrage wurde schon beantwortet
  gate(req, res, p, readBody) {
    const deny = (code, msg, headers) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', ...(headers || {}) }); res.end(JSON.stringify({ error: msg })); return true; };
    const addr = req.socket.remoteAddress;
    if (!isPrivate(addr)) return deny(403, 'Nur im lokalen Netzwerk erreichbar.');
    if (!hostOk(req.headers.host)) return deny(421, 'Ungültiger Host-Name.');
    const origin = req.headers.origin;
    if (!originOk(origin, req.headers.host)) return deny(403, 'Anfrage von fremder Webseite abgelehnt.');
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return true; }
    if (isLoopback(addr) || !this.cfg().requirePin) return false;
    if (p === '/api/pair/state') { res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ needsPin: !this.hasPin() })); return true; }
    if (p === '/api/pair/set' && req.method === 'POST') { readBody(req).then((b) => this.setFirst(req, res, b)).catch(() => deny(400, 'Ungültige Anfrage')); return true; }
    if (p === '/api/pair' && req.method === 'POST') { readBody(req).then((b) => this.pair(req, res, b)).catch(() => deny(400, 'Ungültige Anfrage')); return true; }
    if (this.cookieValid(req)) {
      // Jedes frische Öffnen der Startseite braucht eine neue PIN-Eingabe: die Kopplung gilt für genau ein Laden der Seite
      if (this.cfg().pinEvery && req.method === 'GET' && (p === '/' || p === '/index.html')) {
        const s = this.findSession(req);
        if (s && s.fresh) { s.fresh = false; this.persist(); return false; }
        if (s) this.drop(s);
        res.writeHead(302, { Location: '/pair.html', 'Cache-Control': 'no-store' }); res.end(); return true;
      }
      return false;
    }
    if (p === '/pair.html' || p === '/i18n.js' || p === '/i18n-en.js') return false;
    if (p.startsWith('/api/') || p.startsWith('/tiles/') || p.startsWith('/charts/') || p.startsWith('/bg/')) return deny(401, 'Nicht gekoppelt.');
    res.writeHead(302, { Location: '/pair.html' }); res.end(); return true;
  }
}
module.exports = { Auth, isLoopback, isPrivate, hostOk, originOk };
