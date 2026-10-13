// Einstellungen für alle Geräte: Airlines, Design, Hintergrund, Tabs, Presets.
// Liegen auf dem PC (settings.json); das Aussehen wird hier auf die Oberfläche angewendet.
'use strict';

const TAB_LABELS = {
  flight: 'Flug', efb: 'EFB', ofp: 'OFP', perf: 'Perf', finder: 'Finder', atc: 'ATC', map: 'Karte', charts: 'Charts',
  check: 'Checklisten', wx: 'Wetter', gsx: 'GSX', lights: 'Lichter', logbook: 'Logbuch', music: 'Musik', setup: 'Setup',
};
const THEME_INFO = {
  cockpit: { name: 'Cockpit', desc: 'Dunkel wie ein Airbus-Display' },
  glass: { name: 'Glas', desc: 'Durchscheinende, weiche Flächen' },
  day: { name: 'Tageslicht', desc: 'Hell, gut lesbar bei Sonne' },
  night: { name: 'Nachtrot', desc: 'Nur Rottöne, schont die Augen' },
  contrast: { name: 'Hoher Kontrast', desc: 'Schwarz-weiß mit kräftigen Rändern' },
};
const AIRLINE_TEMPLATES = [
  { name: 'Lufthansa', short: 'LH', icao: 'DLH', accent: '#ffb400', accent2: '#7fa8ff' },
  { name: 'Condor', short: 'DE', icao: 'CFG', accent: '#ffd21a', accent2: '#ffffff' },
  { name: 'DHL', short: 'DHL', icao: 'DHK', accent: '#ffcc00', accent2: '#ff4a55' },
  { name: 'Eurowings', short: 'EW', icao: 'EWG', accent: '#ff4fa3', accent2: '#ffffff' },
  { name: 'Discover Airlines', short: '4Y', icao: 'OCN', accent: '#27d0c9', accent2: '#ffffff' },
  { name: 'Swiss', short: 'LX', icao: 'SWR', accent: '#ff5a5a', accent2: '#ffffff' },
  { name: 'Austrian', short: 'OS', icao: 'AUA', accent: '#ff6b6b', accent2: '#ffffff' },
  { name: 'KLM', short: 'KL', icao: 'KLM', accent: '#35b8ff', accent2: '#ffffff' },
  { name: 'Air France', short: 'AF', icao: 'AFR', accent: '#4f7dff', accent2: '#ff4a55' },
  { name: 'British Airways', short: 'BA', icao: 'BAW', accent: '#6f9bff', accent2: '#ff4a55' },
  { name: 'Emirates', short: 'EK', icao: 'UAE', accent: '#ff4b4b', accent2: '#e0c070' },
  { name: 'Qatar Airways', short: 'QR', icao: 'QTR', accent: '#c25a8d', accent2: '#ffffff' },
  { name: 'Turkish Airlines', short: 'TK', icao: 'THY', accent: '#ff3b3b', accent2: '#ffffff' },
  { name: 'Ryanair', short: 'FR', icao: 'RYR', accent: '#ffd21a', accent2: '#4f7dff' },
  { name: 'easyJet', short: 'U2', icao: 'EZY', accent: '#ff7a1a', accent2: '#ffffff' },
  { name: 'Delta', short: 'DL', icao: 'DAL', accent: '#ff4a55', accent2: '#4f7dff' },
  { name: 'United', short: 'UA', icao: 'UAL', accent: '#4f9bff', accent2: '#ffffff' },
];
const ACCENT_THEMES = ['cockpit', 'glass', 'day'];   // Nachtrot und Kontrast behalten ihre Farben

const Settings = (() => {
  let data = null, saveTimer = null, ready = false;
  const subs = [];
  const posting = { busy: false, again: false };

  const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
  const get = () => data;
  const airlines = () => (data ? data.airlines : []);
  const current = () => (data ? data.airlines.find((a) => a.id === data.activeAirline) || null : null);
  const themeOf = () => { const a = current(); return (a && a.theme) || (data && data.theme) || 'cockpit'; };

  function toast(msg, bad) {
    let n = $('#toast');
    if (!n) { n = document.createElement('div'); n.id = 'toast'; document.body.appendChild(n); }
    n.textContent = msg; n.classList.toggle('bad', !!bad); n.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => n.classList.remove('on'), 2200);
  }

  // ---------- Aussehen anwenden ----------
  function applyLook() {
    if (!data) return;
    const root = document.documentElement, st = root.style, a = current(), th = themeOf();
    root.dataset.theme = th;
    store.set('settingsCache', { t: th });
    // Akzentfarbe der Airline
    if (a && data.useAirlineColor && ACCENT_THEMES.includes(th)) {
      st.setProperty('--cyan', a.accent); st.setProperty('--cyan-rgb', hex2rgb(a.accent));
      st.setProperty('--accent2', a.accent2);
    } else { st.removeProperty('--cyan'); st.removeProperty('--cyan-rgb'); st.removeProperty('--accent2'); }
    // Hintergrundbild
    const bg = (a && a.bg) || data.bgDefault;
    document.body.classList.toggle('has-bg', !!bg);
    if (bg) st.setProperty('--bg-url', `url("/bg/${encodeURIComponent(bg)}")`); else st.removeProperty('--bg-url');
    st.setProperty('--screen-a', bg || th === 'glass' ? String(data.screenOpacity / 100) : '1');
    st.setProperty('--glass-blur', data.glassBlur + 'px');
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--panel').trim() || '#0b1016';
    applyTabs(); applyChip();
  }

  // ---------- Tabs ----------
  function visibleTabs() { return data ? data.tabs.order.filter((t) => !data.tabs.hidden.includes(t)) : Object.keys(TAB_LABELS); }
  function applyTabs() {
    const { order, hidden } = data.tabs;
    $$('#rail .pb').forEach((b) => {
      const i = order.indexOf(b.dataset.tab);
      b.hidden = hidden.includes(b.dataset.tab);
      b.style.order = String((i < 0 ? 99 : i) * 10);
    });
    // Abstandhalter vor die ersten „unteren“ Tabs setzen
    const lower = ['logbook', 'music'].filter((t) => !hidden.includes(t)).map((t) => order.indexOf(t));
    const gap = $('#rail .rail-gap');
    if (gap) gap.style.order = String((lower.length ? Math.min(...lower) : order.indexOf('setup')) * 10 - 5);
    if (hidden.includes(app.tab)) showTab(visibleTabs()[0] || 'setup');
  }

  // ---------- Airline-Schalter in der Statusleiste ----------
  function applyChip() {
    let c = $('#stripAirline');
    const list = airlines();
    if (!c) {
      c = document.createElement('button'); c.id = 'stripAirline'; c.type = 'button'; c.className = 'strip-airline';
      $('.strip').insertBefore(c, $('#stripFlight'));
      c.addEventListener('click', () => {
        const l = airlines(); if (l.length < 2) return showTab('setup');
        const i = l.findIndex((x) => x.id === data.activeAirline);
        setAirline(l[(i + 1) % l.length].id);
        toast(`Airline: ${current().name}`);
      });
    }
    const a = current();
    c.hidden = !list.length;
    c.innerHTML = a ? `<i style="background:${esc(a.accent)}"></i>${esc(a.short || a.name)}` : '<i></i>Airline';
    c.title = a ? `Airline: ${a.name} (antippen zum Wechseln)` : 'Keine Airline gewählt';
  }

  // ---------- Speichern ----------
  async function flush() {
    if (posting.busy) { posting.again = true; return; }
    posting.busy = true;
    try {
      const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const fresh = await r.json();
      // nur ungültige Werte korrigieren lassen, Bearbeitung nicht überschreiben
      if (!posting.again) { data = fresh; }
    } catch (e) { toast('Speichern fehlgeschlagen', true); }
    posting.busy = false;
    if (posting.again) { posting.again = false; flush(); }
  }
  function save(quiet) {
    applyLook();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { flush(); if (!quiet) toast('Gespeichert'); }, 350);
    subs.forEach((f) => { try { f(data); } catch (e) { showError(e.message); } });
  }
  function change(fn, quiet) { fn(data); save(quiet); }

  function setAirline(id) {
    data.activeAirline = data.airlines.some((a) => a.id === id) ? id : '';
    save(true);
  }

  // ---------- Hintergrundbild hochladen (vorher verkleinern) ----------
  function uploadBg(file, name) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Bitte ein Bild wählen (JPG, PNG, WebP).'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = async () => {
        try {
          const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
          const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.84));
          URL.revokeObjectURL(url);
          const r = await fetch('/api/bg?name=' + encodeURIComponent(name || 'bg'), { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || 'Hochladen fehlgeschlagen');
          resolve(j.file);
        } catch (e) { reject(e); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden.')); };
      img.src = url;
    });
  }

  // ---------- Presets ----------
  function applyPreset(p) {
    change((d) => {
      if (p.theme) d.theme = p.theme;
      if (p.airline !== undefined && d.airlines.some((a) => a.id === p.airline)) d.activeAirline = p.airline;
      if (p.tabs) d.tabs = JSON.parse(JSON.stringify(p.tabs));
    }, true);
    toast(`Preset „${p.name}“ geladen`);
  }

  // ---------- Start ----------
  async function load() {
    try {
      const r = await fetch('/api/settings', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json();
    } catch { data = null; return; }
    ready = true; applyLook();
    subs.forEach((f) => { try { f(data); } catch (e) { showError(e.message); } });
  }
  // Airline automatisch passend zum geladenen Flugplan wählen
  hooks.ofp.push((o) => {
    if (!data || !data.autoAirline || !o || !o.general || !o.general.icao_airline) return;
    const hit = data.airlines.find((a) => a.icao && a.icao === String(o.general.icao_airline).toUpperCase());
    if (hit && hit.id !== data.activeAirline) { setAirline(hit.id); toast(`Airline: ${hit.name}`); }
  });
  document.addEventListener('DOMContentLoaded', load);

  return { get, airlines, current, themeOf, save, change, setAirline, uploadBg, applyPreset, visibleTabs, onChange: (f) => subs.push(f), reload: load, toast, isReady: () => ready };
})();
