'use strict';
window.addEventListener('error', (e) => { const b = document.getElementById('err'); if (b) { b.hidden = false; b.textContent += 'Fehler: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')\n'; } });
window.addEventListener('unhandledrejection', (e) => { const b = document.getElementById('err'); if (b) { b.hidden = false; b.textContent += 'Fehler: ' + (e.reason && e.reason.message || e.reason) + '\n'; } });
if (!window.api) { const b = document.getElementById('err'); b.hidden = false; b.textContent = 'Die Verbindung zur App fehlt (preload.js wurde nicht geladen).';  }
const $ = (s) => document.querySelector(s);
const bridge = window.api || { invoke: async () => ({ settings: {}, logs: [], update: {} }), on() {} };
let st = null;
const ST = { stopped: 'Server gestoppt', starting: 'Server startet …', running: 'Server läuft', crashed: 'Server abgestürzt', error: 'Fehler' };

document.querySelectorAll('nav button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x === b));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('on', p.id === 'p-' + b.dataset.p));
});

function renderStatus(s) {
  $('#dot').className = 'dot ' + s; $('#stText').textContent = ST[s] || s;
  $('#bStart').disabled = s === 'running' || s === 'starting'; $('#bStop').disabled = s === 'stopped'; $('#bRestart').disabled = s === 'stopped';
  $('#bBrowser').disabled = $('#bWindow').disabled = s !== 'running';
}
function renderUpdate(u) {
  const efb = $('#uEfb'), app = $('#uApp');
  $('#badge').hidden = !(u.efb || u.app);
  efb.hidden = !u.efb; app.hidden = !u.app;
  if (u.efb) { efb.querySelector('b').textContent = `EFB ${u.efb.version} verfügbar (installiert: ${st.efbVersion})`; efb.querySelector('pre').textContent = u.efb.notes || ''; }
  if (u.app) { app.querySelector('b').textContent = `App ${u.app.version} verfügbar (installiert: ${st.appVersion})`; app.querySelector('pre').textContent = u.app.notes || ''; }
  $('#uState').textContent = u.error ? u.error : !u.checkedAt ? 'Noch nicht gesucht.' : (u.efb || u.app) ? 'Neue Version gefunden.' : `Alles aktuell${u.latestEfb ? ' (neueste EFB: ' + u.latestEfb + ')' : ''}.`;
}
function render(s) {
  st = s;
  renderStatus(s.status);
  $('#stSub').textContent = s.status === 'running' ? `Port ${s.port} · EFB ${s.efbVersion}` : s.status === 'crashed' ? `Beendet mit Code ${s.lastExit} – siehe Protokoll` : '';
  $('#addr').textContent = `http://<PC-IP>:${s.port}`;
  $('#ver').textContent = `App ${s.appVersion} · EFB ${s.efbVersion}`;
  const c = s.settings;
  $('#sAutoStart').checked = c.autoStartServer; $('#sBrowser').checked = c.openBrowserOnStart; $('#sLogin').checked = c.startWithWindows; $('#sClose').checked = c.closeStopsServer;
  $('#sOpenIn').value = c.openIn; $('#sPort').value = s.port;
  $('#uRepo').value = c.repo; $('#uToken').value = c.token; $('#uEdition').value = c.edition; $('#uCheck').checked = c.checkOnStart;
  $('#logBox').textContent = s.logs.join('\n');
  renderUpdate(s.update);
}

// ---- Server
$('#bStart').onclick = () => bridge.invoke('server:start');
$('#bStop').onclick = () => bridge.invoke('server:stop');
$('#bRestart').onclick = () => bridge.invoke('server:restart');
$('#bBrowser').onclick = () => bridge.invoke('efb:open', 'browser');
$('#bWindow').onclick = () => bridge.invoke('efb:open', 'window');
$('#bFolder').onclick = () => bridge.invoke('folder:open');
bridge.on('status', (s) => { if (st) { st.status = s; renderStatus(s); bridge.invoke('state').then(render); } });
bridge.on('log', (l) => { const b = $('#logBox'); b.textContent += (b.textContent ? '\n' : '') + l; b.scrollTop = b.scrollHeight; });

// ---- Einstellungen
$('#sSave').onclick = async () => {
  const s = await bridge.invoke('settings:set', { autoStartServer: $('#sAutoStart').checked, openBrowserOnStart: $('#sBrowser').checked, startWithWindows: $('#sLogin').checked, closeStopsServer: $('#sClose').checked, openIn: $('#sOpenIn').value, port: $('#sPort').value });
  render(s); $('#sMsg').textContent = 'Gespeichert.'; setTimeout(() => ($('#sMsg').textContent = ''), 2500);
};

// ---- Copilot
let cp = {};
const voices = () => speechSynthesis.getVoices();
function fillVoices() {
  const lang = $('#cLang').value, list = voices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  const cur = (cp.voice && cp.voice[lang]) || '';
  $('#cVoice').innerHTML = '<option value="">Standardstimme</option>' + list.map((v) => `<option ${v.name === cur ? 'selected' : ''}>${v.name.replace(/</g, '&lt;')}</option>`).join('');
}
async function loadCopilot() {
  cp = await bridge.invoke('copilot:get');
  $('#cLang').value = cp.lang || 'de'; $('#cRate').value = cp.rate || 1.05; $('#cRateV').textContent = (+$('#cRate').value).toFixed(2);
  $('#cMic').checked = cp.mic !== false; $('#cAuto').checked = !!cp.autostart; fillVoices();
}
speechSynthesis.onvoiceschanged = fillVoices;
const saveCp = (patch) => bridge.invoke('copilot:set', patch).then((o) => { cp = o; });
$('#cLang').onchange = () => { saveCp({ lang: $('#cLang').value }); fillVoices(); };
$('#cVoice').onchange = () => saveCp({ voice: { [$('#cLang').value]: $('#cVoice').value } });
$('#cRate').oninput = () => { $('#cRateV').textContent = (+$('#cRate').value).toFixed(2); saveCp({ rate: +$('#cRate').value }); };
$('#cMic').onchange = () => saveCp({ mic: $('#cMic').checked });
$('#cAuto').onchange = () => saveCp({ autostart: $('#cAuto').checked });
$('#cTest').onclick = () => {
  const lang = $('#cLang').value, u = new SpeechSynthesisUtterance(lang === 'de' ? 'Before Start Checkliste ist jetzt dran.' : 'Before start checklist is due now.');
  u.lang = lang === 'de' ? 'de-DE' : 'en-US'; u.rate = +$('#cRate').value;
  const v = voices().find((x) => x.name === $('#cVoice').value); if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
};

// ---- Updates
const saveUp = () => bridge.invoke('settings:set', { repo: $('#uRepo').value.trim(), token: $('#uToken').value, edition: $('#uEdition').value, checkOnStart: $('#uCheck').checked });
$('#uSave').onclick = async () => { render(await saveUp()); $('#uState').textContent = 'Gespeichert.'; };
$('#uGo').onclick = async () => { await saveUp(); $('#uState').textContent = 'Suche …'; const u = await bridge.invoke('update:check'); st.update = u; renderUpdate(u); };
$('#uInstEfb').onclick = async () => {
  $('#uInstEfb').disabled = true;
  try { const r = await bridge.invoke('update:efb'); $('#uProg').textContent = `Installiert: ${r.from} → ${r.to} (${r.changed} Dateien). Der Server startet neu.`; } catch (e) { $('#uProg').textContent = 'Fehler: ' + e.message; }
  $('#uInstEfb').disabled = false; $('#uBar').hidden = true; render(await bridge.invoke('state'));
};
$('#uInstApp').onclick = () => bridge.invoke('update:app').catch((e) => { $('#uProg').textContent = 'Fehler: ' + e.message; });
bridge.on('update:info', (u) => { st.update = u; renderUpdate(u); });
bridge.on('update:progress', (p) => { $('#uBar').hidden = false; $('#uBar div').style.width = Math.round(p.p * 100) + '%'; $('#uProg').textContent = p.text; });

bridge.invoke('state').then((s) => { render(s); loadCopilot(); });
