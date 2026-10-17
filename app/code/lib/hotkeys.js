// Globale Tastenkürzel (auch bei laufendem Simulator im Vordergrund): schalten Mikrofon bzw. alles stumm.
// Der Server kennt den Zustand (/api/cp/host) und verteilt den Befehl an das Copilot-Fenster und alle Geräte.
'use strict';
const http = require('http');

const KEY = /^(?:(?:Ctrl|Alt|Shift|Super)\+)*(?:[A-Z0-9]|F(?:[1-9]|1\d|2[0-4])|num(?:[0-9]|add|sub|mult|div|dec)|Up|Down|Left|Right|Space|Tab|Enter|Backspace|Insert|Delete|Home|End|PageUp|PageDown|Plus|-|=|,|\.|;|\/|\\)$/;
// Tasten, die man ohne Strg/Alt gar nicht belegen darf: sonst wären sie im ganzen System blockiert (z. B. Enter, Leertaste, Buchstaben).
const FREE = /^(F(?:[1-9]|1\d|2[0-4])|num(?:[0-9]|add|sub|mult|div|dec)|Insert|Home|End|PageUp|PageDown)$/;
const valid = (a) => {
  if (typeof a !== 'string' || a.length > 40 || !KEY.test(a) || /^(Ctrl|Alt|Shift|Super)\+?$/.test(a)) return false;
  const parts = a.split('+'), key = parts[parts.length - 1];
  return FREE.test(key) || parts.slice(0, -1).some((m) => m === 'Ctrl' || m === 'Alt' || m === 'Super');
};

function req(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ host: '127.0.0.1', port, path, method, timeout: 3000, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} }, (res) => {
      let t = ''; res.on('data', (c) => { t += c; }); res.on('end', () => { try { resolve(JSON.parse(t || '{}')); } catch { resolve({}); } });
    });
    r.on('timeout', () => r.destroy(new Error('Zeitüberschreitung'))); r.on('error', reject);
    if (data) r.write(data); r.end();
  });
}

// action: 'mute' (alles stumm) | 'micmute' (nur Mikrofon). Liefert den neuen Zustand (true = stumm).
async function toggle(port, action) {
  const st = await req(port, 'GET', '/api/cp/host');
  const now = action === 'mute' ? !!st.mute : !!st.micmute;
  await req(port, 'POST', '/api/cp/event', { type: 'cmd', action, id: now ? '0' : '1', from: 'app' });
  return !now;
}

// Registriert die Kürzel neu. Gibt je Kürzel zurück, ob es geklappt hat: { mic: 'ok'|'off'|'belegt'|'ungültig', mute: … }
function apply(globalShortcut, cfg, getPort, onToggle) {
  globalShortcut.unregisterAll();
  const res = {};
  for (const [k, accel, action] of [['mic', cfg.hotkeyMic, 'micmute'], ['mute', cfg.hotkeyMute, 'mute']]) {
    if (!accel) { res[k] = 'off'; continue; }
    if (!valid(accel)) { res[k] = 'ungültig'; continue; }
    let ok = false;
    try { ok = globalShortcut.register(accel, () => { const p = getPort(); if (!p) return; toggle(p, action).then((v) => onToggle && onToggle(action, v), () => {}); }); } catch { ok = false; }
    res[k] = ok ? 'ok' : 'belegt';
  }
  if (cfg.hotkeyMic && cfg.hotkeyMic === cfg.hotkeyMute) res.mute = 'doppelt';
  return res;
}
module.exports = { valid, toggle, apply };
