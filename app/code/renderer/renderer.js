'use strict';
window.addEventListener('error', (e) => { const b = document.getElementById('err'); if (b) { b.hidden = false; b.textContent += 'Fehler: ' + e.message + ' (' + (e.filename || '').split('/').pop() + ':' + e.lineno + ')\n'; } });
window.addEventListener('unhandledrejection', (e) => { const b = document.getElementById('err'); if (b) { b.hidden = false; b.textContent += 'Fehler: ' + (e.reason && e.reason.message || e.reason) + '\n'; } });
if (!window.api) { const b = document.getElementById('err'); b.hidden = false; b.textContent = 'Die Verbindung zur App fehlt (preload.js wurde nicht geladen).';  }
const $ = (s) => document.querySelector(s);
const bridge = window.api || { invoke: async () => ({ settings: {}, logs: [], update: {} }), on() {} };
let st = null;
const ST = { stopped: 'Server gestoppt', starting: 'Server startet …', running: 'Server läuft', crashed: 'Server abgestürzt', error: 'Fehler' };

const goPage = (name) => {
  document.querySelectorAll('nav button').forEach((x) => x.classList.toggle('on', x.dataset.p === name));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('on', p.id === 'p-' + name));
};
document.querySelectorAll('nav button').forEach((b) => b.onclick = () => goPage(b.dataset.p));

function renderStatus(s) {
  $('#dot').className = 'dot ' + s; $('#stText').textContent = ST[s] || s;
  $('#bStart').disabled = s === 'running' || s === 'starting'; $('#bStop').disabled = s === 'stopped'; $('#bRestart').disabled = s === 'stopped';
  $('#bBrowser').disabled = $('#bWindow').disabled = s !== 'running';
}
function renderUpdate(u) {
  const efb = $('#uEfb'), code = $('#uCode'), shell = $('#uShell');
  $('#badge').hidden = !(u.efb || u.code || u.shell);
  efb.hidden = !u.efb; code.hidden = !u.code; shell.hidden = !u.shell;
  if (u.efb) { efb.querySelector('b').textContent = `EFB ${u.efb.version} verfügbar (installiert: ${st.efbVersion})`; efb.querySelector('pre').textContent = u.efb.notes || ''; }
  if (u.code) { code.querySelector('b').textContent = `App ${u.code.version} verfügbar (installiert: ${st.appVersion})`; code.querySelector('pre').textContent = u.code.notes || ''; }
  if (u.shell) { shell.querySelector('b').textContent = `Installer ${u.shell.version} verfügbar (installiert: ${st.shellVersion})`; shell.querySelector('pre').textContent = u.shell.notes || ''; }
  $('#uState').textContent = u.error ? u.error : !u.checkedAt ? 'Noch nicht gesucht.' : (u.efb || u.code || u.shell) ? 'Neue Version gefunden.' : `Alles aktuell${u.latestEfb ? ' (neueste EFB: ' + u.latestEfb + ')' : ''}.`;
}
// ---- Version (Ausgaben)
let edShown = false;
const TABN = {};
function renderEdition(s) {
  const e = s.edition || { supported: false, editions: [], tabs: [], current: { id: 'full', name: 'Voll', tabs: [] } };
  (e.tabs || []).forEach((t) => { TABN[t.id] = t.label; });
  const cur = e.current || {}, tabs = cur.tabs || [];
  $('#navCopilot').hidden = !!tabs.length && !tabs.includes('copilot'); // ohne Copilot in der gewählten Version keine Copilot-Seite
  $('#grpVoice').hidden = $('#navCopilot').hidden; // Sprachpakete nur mit Copilot
  $('#edHome').textContent = e.supported ? `Aktiv: ${cur.name}${cur.id === 'custom' ? '' : ''} (${tabs.length} Tabs). ${cur.id === 'voice' ? 'Die Einstellungen steuerst du auch im Sim-EFB unter „Cockpit EFB Link“.' : ''}` : 'Die installierte EFB kennt noch keine Versionen (Updates → EFB aktualisieren).';
  const chosen = !!(s.settings && s.settings.editionChosen);
  $('#edBadge').hidden = chosen || !e.supported; $('#edFirst').hidden = chosen;
  $('#edList').innerHTML = !e.supported ? '<p class="note">Die installierte EFB kennt noch keine Versionen. Bitte unter „Updates“ die EFB aktualisieren.</p>' : e.editions.map((x) => `<div class="ed ${cur.id === x.id ? 'on' : ''}"><div class="top"><div><b>${esc(x.name)}</b> ${cur.id === x.id ? '<span class="sub">aktiv</span>' : ''}</div>${cur.id === x.id ? '' : `<button class="primary" data-ed="${esc(x.id)}">Verwenden</button>`}</div><span class="sub">${esc(x.desc)}</span><div class="chips">${x.tabs.map((t) => `<span>${esc(TABN[t] || t)}</span>`).join('')}</div></div>`).join('');
  const sel = new Set(cur.id === 'custom' ? tabs : []);
  $('#edTabs').innerHTML = (e.tabs || []).filter((t) => t.id !== 'setup').map((t) => `<label class="chk"><input type="checkbox" data-et="${esc(t.id)}" ${(cur.id === 'custom' ? sel.has(t.id) : tabs.includes(t.id)) ? 'checked' : ''}> ${esc(t.label)}</label>`).join('');
  $('#edCustom').disabled = !e.supported;
  if (!chosen && e.supported && !edShown) { edShown = true; goPage('edition'); }
}
async function setEdition(sel) {
  $('#edMsg').textContent = 'Wird gesetzt …';
  try { const r = await bridge.invoke('edition:set', sel); st.edition = r; st.settings.editionChosen = true; renderEdition(st); $('#edMsg').textContent = `Aktiv: ${r.current.name}. Lade die EFB im Browser bzw. auf dem iPad neu (F5).`; }
  catch (er) { $('#edMsg').textContent = 'Fehler: ' + String(er.message || er).replace(/^Error invoking remote method[^:]*: /, ''); }
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-ed]'); if (b) setEdition({ id: b.dataset.ed }); });
$('#edCustom').onclick = () => setEdition({ id: 'custom', tabs: [...document.querySelectorAll('[data-et]:checked')].map((x) => x.dataset.et) });
$('#edGo').onclick = () => goPage('edition');

function render(s) {
  st = s;
  if (window.I18N && !render._i18n) { render._i18n = true; render._pref = (s.settings && s.settings.lang) === 'de' ? 'de' : 'en'; I18N.apply(render._pref); }
  renderEdition(s);
  renderStatus(s.status);
  $('#stSub').textContent = s.status === 'running' ? `Port ${s.port} · EFB ${s.efbVersion}` : s.status === 'crashed' ? `Beendet mit Code ${s.lastExit} – siehe Protokoll` : '';
  $('#addr').textContent = `http://<PC-IP>:${s.port}`;
  $('#ver').textContent = `App ${s.appVersion} · EFB ${s.efbVersion}`;
  if (s.bootNote) $('#uState').textContent = s.bootNote;
  const c = s.settings;
  $('#sAutoStart').checked = c.autoStartServer; $('#sBrowser').checked = c.openBrowserOnStart; $('#sLogin').checked = c.startWithWindows; $('#sClose').checked = c.closeStopsServer;
  $('#sLang').value = c.lang === 'de' ? 'de' : 'en'; $('#sPinEvery').checked = c.pinEvery !== false; $('#sOpenIn').value = c.openIn; $('#sPort').value = s.port; $('#cpOnStart').checked = !!c.copilotOnStart;
  renderHotkeys(c, s.hotkeys || {});
  $('#uRepo').value = c.repo; $('#uToken').value = c.token; $('#uEdition').value = c.edition; $('#uCheck').checked = c.checkOnStart;
  $('#logBox').textContent = s.logs.join('\n');
  renderUpdate(s.update);
}

// ---- Server
$('#bStart').onclick = () => bridge.invoke('server:start');
$('#bDiscord').onclick = () => bridge.invoke('link:open', 'discord');
$('#bStop').onclick = () => bridge.invoke('server:stop');
$('#bRestart').onclick = () => bridge.invoke('server:restart');
$('#bBrowser').onclick = () => bridge.invoke('efb:open', 'browser');
$('#bWindow').onclick = () => bridge.invoke('efb:open', 'window');
$('#bFolder').onclick = () => bridge.invoke('folder:open');
bridge.on('status', (s) => { if (st) { st.status = s; renderStatus(s); bridge.invoke('state').then(render); } });
bridge.on('log', (l) => { const b = $('#logBox'); b.textContent += (b.textContent ? '\n' : '') + l; b.scrollTop = b.scrollHeight; });

// ---- Einstellungen
$('#sSave').onclick = async () => {
  const s = await bridge.invoke('settings:set', { autoStartServer: $('#sAutoStart').checked, openBrowserOnStart: $('#sBrowser').checked, startWithWindows: $('#sLogin').checked, closeStopsServer: $('#sClose').checked, openIn: $('#sOpenIn').value, port: $('#sPort').value, pinEvery: $('#sPinEvery').checked, lang: $('#sLang').value });
  if ((s.settings.lang === 'de' ? 'de' : 'en') !== render._pref) { location.reload(); return; }
  render(s); $('#sMsg').textContent = 'Gespeichert.'; setTimeout(() => ($('#sMsg').textContent = ''), 2500);
};

// ---- Copilot-Fenster und Spracherkennung
$('#cpOpen').onclick = async () => { try { await bridge.invoke('copilot:open'); } catch (e) { $('#sttMsg').textContent = e.message.replace(/^Error invoking remote method[^:]*: /, ''); } };
$('#cpOnStart').onchange = () => bridge.invoke('settings:set', { copilotOnStart: $('#cpOnStart').checked });
let sttInfo = { models: [], binary: false, active: '' };
function renderStt() {
  $('#sttList').innerHTML = sttInfo.models.map((m) => `<div class="v ${m.installed ? 'on' : ''}"><div><b>${esc(m.name)}</b> ${m.id === sttInfo.active ? '<span class="sub">in Benutzung</span>' : ''}</div>
    <span class="sub">${esc(m.desc)} · ${m.mb} MB</span>
    ${m.installed ? `${m.id === sttInfo.active ? '' : `<button data-suse="${m.id}">Benutzen</button>`}<button data-srm="${m.id}">Entfernen</button>` : `<button class="primary" data-sget="${m.id}" id="sb-${m.id}">Installieren</button>`}</div>`).join('');
}
async function loadStt() { sttInfo = await bridge.invoke('stt:status'); renderStt(); }
document.addEventListener('click', async (e) => {
  const g = e.target.closest('[data-sget]'), u = e.target.closest('[data-suse]'), r = e.target.closest('[data-srm]');
  const fail = (er) => { $('#sttMsg').textContent = 'Fehler: ' + er.message.replace(/^Error invoking remote method[^:]*: /, ''); renderStt(); };
  if (g) { g.disabled = true; g.textContent = '0 %'; $('#sttMsg').textContent = 'Lade …'; try { sttInfo = await bridge.invoke('stt:install', g.dataset.sget); renderStt(); $('#sttMsg').textContent = 'Fertig. Das Copilot-Fenster nutzt die Spracherkennung jetzt.'; } catch (er) { fail(er); } }
  if (u) { try { sttInfo = await bridge.invoke('stt:use', u.dataset.suse); renderStt(); } catch (er) { fail(er); } }
  if (r) { try { sttInfo = await bridge.invoke('stt:remove', r.dataset.srm); renderStt(); } catch (er) { fail(er); } }
});
bridge.on('stt:progress', ({ what, p }) => { const b = document.querySelector('[data-sget][disabled]'); if (b) b.textContent = what + ' ' + Math.round(p * 100) + ' %'; });

// ---- Eigene Sounds
const SND_GEN = [['ack', 'Bestätigung („Roger“)'], ['negative', 'Ablehnung („Negative“)'], ['again', 'Nachfragen („Say again“)']];
const SND_SVC = [['boarding', 'Boarding'], ['deboarding', 'Deboarding'], ['catering', 'Catering'], ['refueling', 'Betanken'], ['pushback', 'Pushback'], ['jetway', 'Fluggastbrücke'], ['stairs', 'Treppen'], ['gpu', 'GPU'], ['deice', 'De-Icing']];
const SND_EV = [['ack', 'angefordert / genehmigt'], ['progress', 'läuft'], ['done', 'fertig']];
let snd = [];
const sndRow = (key, label, rm) => { const f = snd.find((x) => x.key.toLowerCase() === key.toLowerCase());
  return `<div class="v ${f ? 'on' : ''}"><div><b>${esc(label)}</b> <span class="sub">${f ? esc(f.file) : 'eingebaute Stimme'}</span></div><span>${f ? `<button data-splay="${esc(key)}">▶</button>` : ''}<button data-sset="${esc(key)}">${f ? 'Ändern' : 'Datei wählen'}</button>${f ? `<button data-srmv="${esc(key)}">${rm ? 'Entfernen' : '×'}</button>` : ''}</span></div>`; };
function renderSounds() {
  const prof = snd.filter((x) => /^pushback\.ack\./i.test(x.key));
  $('#sndProf').innerHTML = prof.map((x) => sndRow(x.key, 'Pushback ' + x.key.slice('pushback.ack.'.length).replace('.', ' · facing '), true)).join('') || '<p class="note">Noch keine Profile.</p>';
  $('#sndList').innerHTML = SND_GEN.map(([k, l]) => sndRow(k, l)).join('') + SND_SVC.map(([s, l]) => SND_EV.map(([e, t]) => sndRow(s + '.' + e, l + ': ' + t)).join('')).join('');
}
async function loadSounds() { snd = await bridge.invoke('sounds:list'); renderSounds(); }
$('#sndFolder').onclick = () => bridge.invoke('sounds:folder');
$('#sndAdd').onclick = async () => {
  const c = $('#sndCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''), d = $('#sndDir').value;
  if (!c && !d) { $('#sndMsg').textContent = 'Bitte einen Namen (z. B. S1) und/oder eine Richtung wählen.'; return; }
  try { snd = await bridge.invoke('sounds:set', 'pushback.ack.' + [c, d].filter(Boolean).join('.')); renderSounds(); $('#sndCode').value = ''; $('#sndMsg').textContent = ''; } catch (e) { $('#sndMsg').textContent = 'Fehler: ' + e.message.replace(/^Error invoking remote method[^:]*: /, ''); }
};
document.addEventListener('click', async (e) => {
  const st = e.target.closest('[data-sset]'), rm = e.target.closest('[data-srmv]'), pl = e.target.closest('[data-splay]');
  try {
    if (st) { snd = await bridge.invoke('sounds:set', st.dataset.sset); renderSounds(); }
    if (rm) { snd = await bridge.invoke('sounds:remove', rm.dataset.srmv); renderSounds(); }
    if (pl) { const f = snd.find((x) => x.key === pl.dataset.splay); if (f) new Audio('file:///' + f.path.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:')).play().catch(() => { $('#sndMsg').textContent = 'Wiedergabe nicht möglich.'; }); }
  } catch (er) { $('#sndMsg').textContent = 'Fehler: ' + er.message.replace(/^Error invoking remote method[^:]*: /, ''); }
});

// ---- Copilot
let cp = {};
const voices = () => speechSynthesis.getVoices();
let vInfo = { voices: [], piper: false };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function fillVoices() {
  const lang = $('#cLang').value, list = voices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  const cur = (cp.voice && cp.voice[lang]) || '';
  const mine = vInfo.voices.filter((v) => v.installed && v.lang === lang);
  $('#cVoice').innerHTML = `<option value="">${mine.length ? 'Automatisch (eingebaut)' : 'Standardstimme'}</option>`
    + mine.map((v) => `<option value="piper:${v.id}" ${'piper:' + v.id === cur ? 'selected' : ''}>★ ${esc(v.name)}</option>`).join('')
    + list.map((v) => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${esc(v.name)}</option>`).join('');
  fillVoiceEn();
}
function fillVoiceEn() {
  const lang = $('#cLang').value; $('#cVoiceEnL').hidden = lang !== 'de';
  const cur = (cp.voice && cp.voice.en) || '', mine = vInfo.voices.filter((v) => v.installed && v.lang === 'en');
  const grCur = (cp.voice && cp.voice.ground) || '';
  $('#cVoiceGr').innerHTML = `<option value="">Automatisch (andere Stimme als der Copilot)</option>` + vInfo.voices.filter((v) => v.installed && v.lang === 'en').map((v) => `<option value="piper:${v.id}" ${'piper:' + v.id === grCur ? 'selected' : ''}>★ ${esc(v.name)}</option>`).join('');
  $('#cVoiceEn').innerHTML = `<option value="">Automatisch (eingebaut)</option>` + mine.map((v) => `<option value="piper:${v.id}" ${'piper:' + v.id === cur ? 'selected' : ''}>★ ${esc(v.name)}</option>`).join('');
}
function renderVoices() {
  $('#vList').innerHTML = vInfo.voices.map((v) => `<div class="v ${v.installed ? 'on' : ''}"><div><b>${esc(v.name)}</b> <span class="sub">${v.lang === 'de' ? 'Deutsch' : 'Englisch'}</span></div>
    <span class="sub">${esc(v.desc)} · ${v.mb} MB</span>
    ${v.installed ? (v.removable ? `<button data-vrm="${v.id}">Entfernen</button>` : '<button disabled>Installiert</button>') : `<button class="primary" data-vget="${v.id}" id="vb-${v.id}">Laden</button>`}</div>`).join('');
  if (!vInfo.piper) $('#vNote').textContent = 'In dieser Entwicklungsversion ist Piper nicht enthalten; im Installer ist es dabei.';
  $('#vStarter').hidden = !(vInfo.piper && vInfo.voices.some((v) => v.bundled && !v.installed));
  fillVoices();
}
$('#vStarterGo').onclick = async () => {
  const b = $('#vStarterGo'); b.disabled = true; $('#vMsg').textContent = '';
  try {
    for (const v of vInfo.voices.filter((x) => x.bundled && !x.installed)) {
      b.textContent = v.name + ' …';
      vInfo.voices = await bridge.invoke('voices:install', v.id);
    }
  } catch (er) { $('#vMsg').textContent = 'Fehler: ' + er.message.replace(/^Error invoking remote method[^:]*: /, ''); }
  b.disabled = false; b.textContent = 'Empfohlene Stimmen laden'; renderVoices();
};
async function loadVoiceList() { vInfo = await bridge.invoke('voices:list'); renderVoices(); }
document.addEventListener('click', async (e) => {
  const g = e.target.closest('[data-vget]'), r = e.target.closest('[data-vrm]');
  if (g) { const id = g.dataset.vget; g.disabled = true; g.textContent = '0 %'; $('#vMsg').textContent = ''; try { vInfo.voices = await bridge.invoke('voices:install', id); renderVoices(); } catch (er) { $('#vMsg').textContent = 'Fehler: ' + er.message.replace(/^Error invoking remote method[^:]*: /, ''); renderVoices(); } }
  if (r) { vInfo.voices = await bridge.invoke('voices:remove', r.dataset.vrm); renderVoices(); }
});
bridge.on('voices:progress', (id, p) => { const b = document.getElementById('vb-' + id); if (b) b.textContent = Math.round(p * 100) + ' %'; });
async function loadCopilot() {
  cp = await bridge.invoke('copilot:get');
  $('#cLang').value = cp.lang || 'de'; $('#cRate').value = cp.rate || 1.05; $('#cRateV').textContent = (+$('#cRate').value).toFixed(2);
  $('#cMic').checked = cp.mic !== false; $('#cAuto').checked = !!cp.autostart; fillVoices();
}
speechSynthesis.onvoiceschanged = fillVoices;
const saveCp = (patch) => bridge.invoke('copilot:set', patch).then((o) => { cp = o; });
$('#cLang').onchange = () => { saveCp({ lang: $('#cLang').value }); fillVoices(); };
$('#cVoiceGr').onchange = () => saveCp({ voice: { ground: $('#cVoiceGr').value } });
$('#cVoiceEn').onchange = () => saveCp({ voice: { en: $('#cVoiceEn').value } });
$('#cVoice').onchange = () => saveCp({ voice: { [$('#cLang').value]: $('#cVoice').value } });
$('#cRate').oninput = () => { $('#cRateV').textContent = (+$('#cRate').value).toFixed(2); saveCp({ rate: +$('#cRate').value }); };
$('#cMic').onchange = () => saveCp({ mic: $('#cMic').checked });
$('#cAuto').onchange = () => saveCp({ autostart: $('#cAuto').checked });
$('#cTest').onclick = async () => {
  const lang = $('#cLang').value, sel = $('#cVoice').value;
  const segs = lang === 'de' ? [['Before Start', 'en'], ['Checkliste ist jetzt dran.', 'de']] : [['Before start checklist is due now.', 'en']];
  const inst = (l) => vInfo.voices.find((v) => v.installed && v.lang === l);
  const pick = (l) => { const w = l === lang ? sel : ((cp.voice || {}).en || ''); if (w.startsWith('piper:')) return w.slice(6); return w ? null : (inst(l) || {}).id; };
  const rate = $('#cRate').value;
  if (st && st.status === 'running' && segs.every(([, l]) => pick(l))) {
    const urls = segs.map(([t, l]) => `http://127.0.0.1:${st.port}/api/tts?voice=${encodeURIComponent(pick(l))}&rate=${rate}&text=${encodeURIComponent(t)}`);
    urls.forEach((u) => fetch(u).catch(() => {}));
    for (const u of urls) await new Promise((res) => { const a = new Audio(u); a.onended = res; a.onerror = () => { $('#vMsg').textContent = 'Hörprobe nicht möglich – läuft der Server?'; res(); }; a.play().catch(res); });
    return;
  }
  speechSynthesis.cancel();
  for (const [t, l] of segs) await new Promise((res) => {
    const u = new SpeechSynthesisUtterance(t); u.lang = l === 'de' ? 'de-DE' : 'en-US'; u.rate = +rate; u.onend = res; u.onerror = res;
    const v = l === lang ? voices().find((x) => x.name === sel) : null; if (v) u.voice = v; speechSynthesis.speak(u);
  });
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
$('#uInstShell').onclick = () => bridge.invoke('update:shell').catch((e) => { $('#uProg').textContent = 'Fehler: ' + e.message; });
$('#uInstCode').onclick = () => bridge.invoke('update:code').catch((e) => { $('#uProg').textContent = 'Fehler: ' + e.message; });
bridge.on('update:info', (u) => { st.update = u; renderUpdate(u); });
bridge.on('update:progress', (p) => { $('#uBar').hidden = false; $('#uBar div').style.width = Math.round(p.p * 100) + '%'; $('#uProg').textContent = p.text; });

bridge.invoke('state').then((s) => { render(s); loadVoiceList(); loadCopilot(); loadStt(); loadSounds(); });

// ---- Sim-Modul im Community-Ordner ----
const cErr = (e) => e.message.replace(/^Error invoking remote method[^:]*: /, '');
function renderCom(c) {
  if (!c) return;
  const t = c.error && !c.dir ? c.error : !c.hasSource ? 'Das Modul fehlt in der EFB. Bitte unter „Updates“ die EFB aktualisieren.'
    : c.upToDate ? `Installiert und aktuell: ${c.target}` : c.installed ? `Installiert, aber veraltet: ${c.target}` : `Noch nicht installiert. Ziel: ${c.target}`;
  $('#comState').textContent = (c.mode === 'manual' ? 'Selbst gewählter Ordner. ' : 'Automatisch gefunden. ') + t;
}
async function loadCom() { try { renderCom(await bridge.invoke('community:status')); } catch (e) { $('#comMsg').textContent = cErr(e); } }
$('#comInstall').onclick = async () => { try { const r = await bridge.invoke('community:install'); renderCom(r); $('#comMsg').textContent = r.changed ? 'Installiert. Starte MSFS neu, falls es läuft.' : 'Schon aktuell.'; } catch (e) { $('#comMsg').textContent = 'Fehler: ' + cErr(e); } };
$('#comPick').onclick = async () => { try { const r = await bridge.invoke('community:pick'); renderCom(r); $('#comMsg').textContent = r.changed ? 'Installiert.' : ''; } catch (e) { $('#comMsg').textContent = 'Fehler: ' + cErr(e); } };
$('#comReset').onclick = async () => { renderCom(await bridge.invoke('community:auto')); $('#comMsg').textContent = ''; };
$('#comAuto').onchange = () => bridge.invoke('settings:set', { communityAuto: $('#comAuto').checked });
bridge.invoke('state').then((s) => { $('#comAuto').checked = s.settings.communityAuto !== false; });
loadCom();

// ---- Kokoro (natürliche englische Stimmen)
let kkInfo = { binary: false, model: false };
function renderKk() {
  const on = kkInfo.binary && kkInfo.model;
  $('#kkBox').innerHTML = `<div class="v ${on ? 'on' : ''}"><div><b>Kokoro</b> ${on ? '<span class="sub">installiert</span>' : ''}</div><span class="sub">6 englische Stimmen, US und britisch · ${kkInfo.mb || 130} MB</span>
    ${on ? '<button data-kkrm="1">Entfernen</button>' : '<button class="primary" data-kkget="1" id="kkGet">Installieren</button>'}</div>`;
}
async function loadKk() { try { kkInfo = await bridge.invoke('kokoro:status'); } catch { /* ältere App */ } renderKk(); }
document.addEventListener('click', async (e) => {
  const g = e.target.closest('[data-kkget]'), r = e.target.closest('[data-kkrm]');
  const fail = (er) => { $('#kkMsg').textContent = 'Fehler: ' + er.message.replace(/^Error invoking remote method[^:]*: /, ''); renderKk(); };
  if (g) { g.disabled = true; g.textContent = '0 %'; $('#kkMsg').textContent = 'Lade …'; try { kkInfo = await bridge.invoke('kokoro:install'); renderKk(); $('#kkMsg').textContent = 'Fertig. Im Copilot-Tab bei „Stimme Bodencrew“ die Kokoro-Stimme wählen (die Bodencrew nimmt sie sonst automatisch).'; } catch (er) { fail(er); } }
  if (r) { try { kkInfo = await bridge.invoke('kokoro:remove'); renderKk(); $('#kkMsg').textContent = ''; } catch (er) { fail(er); } }
});
bridge.on('kokoro:progress', ({ what, p }) => { const b = document.getElementById('kkGet'); if (b && b.disabled) b.textContent = what + ' ' + Math.round(p * 100) + ' %'; });
loadKk();

// ---- Mute-Tastenkürzel (globale Tasten, Electron-Schreibweise wie „Ctrl+Alt+M“)
const HK_NAMES = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Space: 'Space', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Minus: '-', Equal: '=', Comma: ',', Period: '.', Semicolon: ';', Slash: '/', Backslash: '\\', NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec', NumpadEnter: 'Enter' };
function accelFromEvent(e) {
  let k = null; const c = e.code || '';
  if (/^Key[A-Z]$/.test(c)) k = c.slice(3); else if (/^Digit[0-9]$/.test(c)) k = c.slice(5); else if (/^F([1-9]|1\d|2[0-4])$/.test(c)) k = c; else if (/^Numpad[0-9]$/.test(c)) k = 'num' + c.slice(6); else if (HK_NAMES[c]) k = HK_NAMES[c];
  if (!k) return null;
  const mod = e.ctrlKey || e.altKey || e.metaKey;
  if (!mod && !/^(F([1-9]|1\d|2[0-4])|num.*|Insert|Home|End|PageUp|PageDown)$/.test(k)) return 'nomod'; // Schreibtasten nur mit Strg/Alt: sonst sind sie überall im System blockiert
  return [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean).concat(k).join('+');
}
const HK = [['mic', 'hotkeyMic', '#hkMic', '#hkMicClr', '#hkMicMsg'], ['mute', 'hotkeyMute', '#hkMute', '#hkMuteClr', '#hkMuteMsg']];
const HK_TXT = { ok: 'Aktiv.', off: '', belegt: 'Diese Taste ist schon von einem anderen Programm belegt. Nimm eine andere, z. B. mit Strg+Alt.', 'ungültig': 'Diese Taste geht nicht.', doppelt: 'Dieselbe Taste ist schon für „Nur Mikrofon stumm“ belegt.' };
function renderHotkeys(c, st) {
  $('#hkBeep').checked = !!c.hotkeyBeep;
  for (const [k, key, inp, , msg] of HK) { if (document.activeElement !== $(inp)) $(inp).value = c[key] || ''; $(msg).textContent = c[key] ? (HK_TXT[st[k]] || '') : ''; }
}
const msgOf = (inp) => HK.find((h) => h[2] === inp)[4];
for (const [k, key, inp, clr] of HK) {
  const save = async (v) => { const s = await bridge.invoke('settings:set', { [key]: v }); render(s); };
  $(inp).onkeydown = (e) => { if (e.key === 'Tab') return; e.preventDefault(); if (e.key === 'Escape') { $(inp).blur(); return; } const a = accelFromEvent(e); if (a === 'nomod') { $(inp).blur(); $(msgOf(inp)).textContent = 'Diese Taste ist zum Schreiben nötig (z. B. Enter). Kombiniere sie mit Strg oder Alt, oder nimm eine F-Taste oder eine Zehnertastatur-Taste.'; return; } if (a) { $(inp).value = a; $(inp).blur(); save(a); } };
  $(inp).onfocus = () => { $(inp).dataset.old = $(inp).value; $(inp).value = ''; $(inp).placeholder = 'Taste drücken … (Esc bricht ab)'; };
  $(inp).onblur = () => { if (!$(inp).value) $(inp).value = $(inp).dataset.old || ''; $(inp).placeholder = 'Nicht belegt – hier klicken, dann Taste drücken'; };
  $(clr).onclick = () => { $(inp).dataset.old = ''; $(inp).value = ''; save(''); };
}
$('#hkBeep').onchange = () => bridge.invoke('settings:set', { hotkeyBeep: $('#hkBeep').checked });
