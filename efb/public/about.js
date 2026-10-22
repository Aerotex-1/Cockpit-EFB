// Zugang (PIN), Hinweise beim ersten Start, Quellenangaben
'use strict';

const About = (() => {
  const NOTICE = 'Cockpit EFB ist ausschließlich für die Flugsimulation gedacht. Leistungsrechner, Flughafen- und Wetterdaten sind Näherungen und ersetzen weder Handbücher noch echte Flugvorbereitung. Die Nutzung erfolgt auf eigene Verantwortung, ohne Gewähr.';
  async function auth() {
    const t = $('#authText'); if (!t) return;
    let s = null;
    try { s = await fetch('/api/auth/status', { cache: 'no-store' }).then((r) => r.json()); } catch { /* offline */ }
    if (!s) { t.textContent = 'Nicht erreichbar.'; return; }
    if (!s.requirePin) { t.textContent = 'Die PIN-Abfrage ist ausgeschaltet (requirePin in config.json). Jedes Gerät im lokalen Netzwerk kann die EFB bedienen.'; return; }
    if (s.local) { $('#pinEveryRow').hidden = false; $('#pinEvery').checked = s.pinEvery !== false; }
    if (s.local && !s.hasPin) {
      t.textContent = 'Noch keine PIN festgelegt. Lege sie hier fest oder beim ersten Öffnen am Tablet.';
      $('#pinSet').hidden = false; $('#authActions').hidden = true;
    } else if (s.local) {
      $('#pinSet').hidden = false;
      t.innerHTML = `Zum Koppeln eines Tablets gibst du beim ersten Öffnen diese PIN ein: <b class="pin">${esc(s.pin)}</b><br>Gekoppelte Geräte: ${s.devices}. Die Brücke antwortet nur Geräten im eigenen Netzwerk.`;
      $('#authActions').hidden = false;
    } else {
      t.textContent = 'Dieses Gerät ist gekoppelt. Die PIN und das Abmelden aller Geräte siehst du, wenn du die EFB am PC öffnest (http://127.0.0.1:8090).';
    }
  }
  document.addEventListener('change', async (e) => {
    if (e.target.id !== 'pinEvery') return;
    const r = await fetch('/api/auth/every', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on: e.target.checked }) }).then((x) => x.json()).catch(() => null);
    if (r) Settings.toast(r.pinEvery ? 'PIN wird bei jedem Öffnen abgefragt' : 'PIN wird nur beim Koppeln abgefragt'); else Settings.toast('Das hat nicht geklappt', true);
  });
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'pinSave') {
      const r = await fetch('/api/auth/setpin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: $('#pinNew').value }) }).then((x) => x.json()).catch(() => null);
      if (r && r.pin) { $('#pinNew').value = ''; Settings.toast('PIN gespeichert'); auth(); } else Settings.toast((r && r.error) || 'PIN konnte nicht gespeichert werden', true);
      return;
    }
    if (e.target.id !== 'authReset') return;
    const r = await fetch('/api/auth/reset', { method: 'POST' }).then((x) => x.json()).catch(() => null);
    if (r && r.pin) auth();
  });
  function notice() {
    if (store.get('ack1', false)) return;
    const d = document.createElement('div'); d.className = 'ack-back';
    d.innerHTML = `<div class="ack"><h3>Hinweis</h3><p>${esc(NOTICE)}</p><button class="btn" id="ackOk">Verstanden</button></div>`;
    document.body.appendChild(d);
    d.querySelector('#ackOk').onclick = () => { store.set('ack1', true); d.remove(); };
  }
  function perfNote() {
    const p = document.getElementById('tab-perf');
    if (p && !p.querySelector('.perf-disc')) { const n = document.createElement('p'); n.className = 'note perf-disc'; n.textContent = 'Näherungswerte nur für die Simulation. Sie ersetzen weder das FCOM noch die Rechner der Flugzeugsoftware.'; p.appendChild(n); }
  }
  hooks.tab.push((n) => { if (n === 'setup') auth(); if (n === 'perf') perfNote(); });
  window.addEventListener('load', () => setTimeout(notice, 600));
  return {};
})();
