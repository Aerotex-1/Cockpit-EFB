// Einstellungen, die für alle Geräte gelten (Airlines, Design, Tabs, Presets). Liegen als settings.json auf dem PC.
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'settings.json');
const BG_DIR = path.join(__dirname, 'backgrounds');
const TABS = ['flight', 'efb', 'ofp', 'perf', 'finder', 'atc', 'map', 'charts', 'check', 'copilot', 'wx', 'gsx', 'logbook', 'music', 'setup'];
// „Lichter“ gibt es nur in der privaten Version (Datei lights.js)
if (fs.existsSync(path.join(__dirname, 'lights.js'))) TABS.splice(TABS.indexOf('gsx') + 1, 0, 'lights');
const THEMES = ['cockpit', 'glass', 'day', 'night', 'contrast'];

const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const id = (v) => str(v, 40).replace(/[^\w-]/g, '');
const color = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : d);
const bgFile = (v) => (/^[\w-]+\.(jpe?g|png|webp)$/i.test(String(v)) ? String(v) : '');

function defaults() {
  return {
    v: 1, airlines: [], activeAirline: '', autoAirline: true, useAirlineColor: true,
    theme: 'cockpit', bgDefault: '', screenOpacity: 78, glassBlur: 22,
    tabs: { order: TABS.slice(), hidden: [] },
    presets: [],
    logbook: { max: 1000, filter: 'airline', sort: 'date', type: '' },
  };
}

function tabsOf(t) {
  const hidden = [...new Set((Array.isArray(t && t.hidden) ? t.hidden : []).filter((x) => TABS.includes(x) && x !== 'setup'))];
  const given = (Array.isArray(t && t.order) ? t.order : []).filter((x) => TABS.includes(x));
  const order = [...new Set([...given, ...TABS])].filter((x) => x !== 'setup');
  order.push('setup');
  return { order, hidden };
}

function clean(inp) {
  const d = defaults(), o = inp && typeof inp === 'object' ? inp : {};
  const airlines = (Array.isArray(o.airlines) ? o.airlines : []).slice(0, 30).map((a) => ({
    id: id(a.id) || ('a' + Math.random().toString(36).slice(2, 8)),
    name: str(a.name, 40), short: str(a.short, 12), icao: str(a.icao, 3).toUpperCase(), callsign: str(a.callsign, 20),
    accent: color(a.accent, '#38c8f5'), accent2: color(a.accent2, '#ffb020'), bg: bgFile(a.bg), theme: THEMES.includes(a.theme) ? a.theme : '',
  })).filter((a) => a.name);
  const ids = new Set(airlines.map((a) => a.id));
  const presets = (Array.isArray(o.presets) ? o.presets : []).slice(0, 20).map((p) => ({
    id: id(p.id) || ('p' + Math.random().toString(36).slice(2, 8)), name: str(p.name, 40),
    theme: THEMES.includes(p.theme) ? p.theme : '', airline: ids.has(p.airline) ? p.airline : '', tabs: tabsOf(p.tabs),
  })).filter((p) => p.name);
  const lb = o.logbook || {};
  return {
    v: 1, airlines, presets,
    activeAirline: ids.has(o.activeAirline) ? o.activeAirline : '',
    autoAirline: o.autoAirline !== false, useAirlineColor: o.useAirlineColor !== false,
    theme: THEMES.includes(o.theme) ? o.theme : d.theme,
    bgDefault: bgFile(o.bgDefault),
    screenOpacity: Math.max(20, Math.min(100, Math.round(Number(o.screenOpacity)) || d.screenOpacity)),
    glassBlur: Math.max(0, Math.min(40, Math.round(Number(o.glassBlur) || 0) || (o.glassBlur === 0 ? 0 : d.glassBlur))),
    tabs: tabsOf(o.tabs),
    logbook: {
      max: Math.max(20, Math.min(5000, Math.round(Number(lb.max)) || d.logbook.max)),
      filter: lb.filter === 'all' ? 'all' : 'airline', sort: ['date', 'type', 'time', 'airline'].includes(lb.sort) ? lb.sort : 'date', type: str(lb.type, 8),
    },
  };
}

class Settings {
  constructor() {
    this.data = defaults();
    try { this.data = clean(JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch { /* neu */ }
  }
  get() { return this.data; }
  set(inp) {
    this.data = clean(inp);
    try { fs.writeFileSync(FILE, JSON.stringify(this.data, null, 2)); } catch { /* egal */ }
    this.gc();
    return this.data;
  }
  // Nicht mehr genutzte Hintergrundbilder löschen
  gc() {
    try {
      const used = new Set([this.data.bgDefault, ...this.data.airlines.map((a) => a.bg)].filter(Boolean));
      for (const f of fs.readdirSync(BG_DIR)) if (!used.has(f) && Date.now() - fs.statSync(path.join(BG_DIR, f)).mtimeMs > 10 * 60000) fs.rmSync(path.join(BG_DIR, f), { force: true });
    } catch { /* kein Ordner */ }
  }
  saveBg(name, buf) {
    const ext = buf.slice(0, 3).toString('hex') === 'ffd8ff' ? 'jpg' : buf.slice(0, 4).toString('hex') === '89504e47' ? 'png' : (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') ? 'webp' : null;
    if (!ext) throw new Error('Nur JPG, PNG oder WebP');
    fs.mkdirSync(BG_DIR, { recursive: true });
    const file = `${id(name) || 'bg'}-${Date.now().toString(36)}.${ext}`;
    fs.writeFileSync(path.join(BG_DIR, file), buf);
    return file;
  }
}
module.exports = { Settings, clean, defaults, TABS, THEMES, BG_DIR };
