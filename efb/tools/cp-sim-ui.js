// Einstellungsseite „Copilot & Ground“ für das EFB im Simulator (App „Cockpit EFB Link“).
// Reines DOM, keine Bibliotheken: läuft im Sim-EFB und (zum Testen) in jedem Browser. Spricht mit der PC-Brücke (BRIDGE).
function mountCopilotUi(root, BRIDGE, log) {
  var S = { pref: {}, host: {}, voices: { available: false, voices: [] }, err: '', busy: false };
  var el = function (h) { var d = document.createElement('div'); d.innerHTML = h; return d.firstChild; };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var get = function (u) { return fetch(BRIDGE + u, { cache: 'no-store' }).then(function (r) { return r.json(); }); };
  var post = function (u, b) { return fetch(BRIDGE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); };
  var cmd = function (action, id) { return post('/api/cp/event', { type: 'cmd', action: action, id: id || '', from: 'sim-efb' }); };
  var savePref = function (patch) { Object.assign(S.pref, patch); return post('/api/copilot', Object.assign({}, patch, { from: 'sim-efb' })).catch(function (e) { S.err = 'Speichern nicht möglich: ' + e; }).then(draw); };
  var LIFE = [['taxi', 'Rollweg-Ansagen'], ['traffic', 'Verkehrshinweise (VATSIM)'], ['calls', 'Callouts (80 Knoten, V1, Rotate)'], ['ground', 'Bodencrew meldet sich selbst'], ['groundPush', 'Bodencrew spricht beim Pushback']];
  var lifeOf = function () { var L = S.pref.life || {}; return { taxi: L.taxi !== false, traffic: L.traffic !== false, calls: L.calls !== false, ground: L.ground !== false, groundPush: L.groundPush === true }; };
  var lang = function () { return S.pref.lang === 'en' ? 'en' : 'de'; };
  // Auswahl der Stimmen: [{v: Wert, t: Name}]
  var voiceOpts = function (k) { var o = [{ v: '', t: 'Automatisch' }]; (S.voices.voices || []).filter(function (x) { return x.lang === k; }).forEach(function (x) { o.push({ v: 'piper:' + x.id, t: x.label || x.id }); }); return o; };
  var step = function (key, k, dir) { var o = voiceOpts(k), cur = (S.pref.voice || {})[key] || '', i = Math.max(0, o.findIndex(function (x) { return x.v === cur; })); i = (i + dir + o.length) % o.length; var voice = {}; voice[key] = o[i].v; S.pref.voice = Object.assign({}, S.pref.voice, voice); return savePref({ voice: voice }).then(function () { cmd(key === 'ground' ? 'ground' : key === 'en' && lang() === 'de' ? 'voiceEn' : 'voice'); }); };
  var stepper = function (id, label, key, k) { var o = voiceOpts(k), cur = (S.pref.voice || {})[key] || '', sel = o.find(function (x) { return x.v === cur; }) || o[0]; return '<div class="cpu-row"><div class="cpu-l">' + esc(label) + '</div><div class="cpu-step"><button data-a="vs" data-k="' + key + '" data-l="' + k + '" data-d="-1">◀</button><span>' + esc(sel.t) + '</span><button data-a="vs" data-k="' + key + '" data-l="' + k + '" data-d="1">▶</button></div></div>'; };
  var tog = function (a, on, label, data) { return '<button class="cpu-tog' + (on ? ' on' : '') + '" data-a="' + a + '"' + (data || '') + '><i></i><span>' + esc(label) + '</span></button>'; };
  var seg = function (a, cur, items) { return '<div class="cpu-seg">' + items.map(function (x) { return '<button class="' + (x[0] === cur ? 'on' : '') + '" data-a="' + a + '" data-v="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>'; };

  var css = '.cpu{font-family:inherit;color:#e8ecef;background:#0b0f13;height:100%;overflow:auto;box-sizing:border-box;padding:28px 34px 60px;font-size:22px}.cpu h1{font-size:34px;margin:0 0 6px}.cpu h2{font-size:22px;margin:26px 0 10px;color:#8794a0;font-weight:600}.cpu .sub{color:#8794a0;font-size:18px;line-height:1.35}'
    + '.cpu button{font:inherit;color:#e8ecef;background:#1c2630;border:1px solid #2c3a47;border-radius:12px;padding:14px 20px;min-height:56px;cursor:pointer}.cpu button:active{background:#2b3a49}.cpu button.on{background:#1f6f4a;border-color:#3be26a}'
    + '.cpu .cpu-row{display:flex;align-items:center;gap:16px;margin:10px 0;flex-wrap:wrap}.cpu .cpu-l{min-width:190px;color:#c5ced6}.cpu .cpu-step{display:flex;align-items:center;gap:10px;flex:1;min-width:300px}.cpu .cpu-step span{flex:1;text-align:center;background:#121a22;border-radius:10px;padding:14px 10px}'
    + '.cpu .cpu-seg{display:flex;gap:8px}.cpu .cpu-seg button{min-width:110px}.cpu .cpu-big{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0}.cpu .cpu-big button{flex:1;min-width:230px;font-size:24px;min-height:68px}.cpu .cpu-big button.off{background:#7a2a24;border-color:#ff6a5e}'
    + '.cpu .cpu-tog{display:flex;align-items:center;gap:14px;width:100%;text-align:left;margin:8px 0}.cpu .cpu-tog i{width:50px;height:28px;border-radius:14px;background:#3a4652;position:relative;flex:none}.cpu .cpu-tog i:after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:left .15s}.cpu .cpu-tog.on i{background:#3be26a}.cpu .cpu-tog.on i:after{left:25px}'
    + '.cpu .st{display:inline-block;padding:6px 14px;border-radius:999px;background:#1c2630;margin-right:10px;font-size:19px}.cpu .st.ok{background:#1f6f4a}.cpu .st.bad{background:#7a2a24}.cpu .err{color:#ffb3a8;margin:10px 0}';
  var st = document.createElement('style'); st.textContent = css; root.appendChild(st);
  var box = el('<div class="cpu"></div>'); root.appendChild(box);

  function draw() {
    var h = S.host || {}, p = S.pref || {}, L = lifeOf();
    box.innerHTML = '<h1>Copilot &amp; Ground</h1><div class="sub">Einstellungen des Sprach-Copiloten und der Bodencrew. Die Stimmen laufen am PC, hier steuerst du sie nur.</div>'
      + '<div style="margin-top:16px"><span class="st ' + (h.active ? 'ok' : 'bad') + '">' + (h.active ? 'Copilot läuft am PC' : 'Copilot nicht gestartet') + '</span>' + (h.mute ? '<span class="st bad">alles stumm</span>' : h.micmute ? '<span class="st bad">Mikrofon aus</span>' : '') + '</div>'
      + (S.err ? '<div class="err">' + esc(S.err) + '</div>' : '')
      + '<div class="cpu-big"><button data-a="run" class="' + (h.active ? 'on' : '') + '">' + (h.active ? 'Copilot stoppen' : 'Copilot starten') + '</button>'
      + '<button data-a="mute" class="' + (h.mute ? 'off' : '') + '">' + (h.mute ? 'Stumm aufheben' : 'Alles stumm') + '</button>'
      + '<button data-a="micmute" class="' + (h.micmute ? 'off' : '') + '">' + (h.micmute ? 'Mikrofon einschalten' : 'Nur Mikrofon stumm') + '</button></div>'
      + '<h2>Sprache</h2><div class="cpu-row">' + seg('lang', lang(), [['de', 'Deutsch'], ['en', 'English']]) + '</div>'
      + '<h2>Stimmen</h2>'
      + (S.voices.available ? stepper('v1', lang() === 'de' ? 'Copilot (Deutsch)' : 'Copilot', lang(), lang()) + (lang() === 'de' ? stepper('v2', 'Englische Wörter', 'en', 'en') : '') + stepper('v3', 'Bodencrew', 'ground', 'en') + '<div class="cpu-row"><button data-a="try" data-w="voice">Copilot anhören</button><button data-a="try" data-w="ground">Bodencrew anhören</button></div>'
        : '<div class="sub">Keine eingebauten Stimmen gefunden. Installiere sie in der Windows-App unter „Copilot“.</div>')
      + '<h2>Sprechen</h2><div class="cpu-row"><div class="cpu-l">Tempo ' + (Number(p.rate) || 1.05).toFixed(2) + '</div><div class="cpu-step"><button data-a="rate" data-d="-1">−</button><span>' + (Number(p.rate) || 1.05).toFixed(2) + '</span><button data-a="rate" data-d="1">+</button></div></div>'
      + '<div class="cpu-row"><div class="cpu-l">Natürlicher sprechen</div>' + seg('human', p.human || 'low', [['off', 'Aus'], ['low', 'Selten'], ['mid', 'Öfter']]) + '</div>'
      + tog('mic', p.mic !== false, 'Mikrofon benutzen (Spracherkennung)')
      + '<h2>Mehr Leben</h2>' + LIFE.map(function (x) { return tog('life', L[x[0]], x[1], ' data-k="' + x[0] + '"'); }).join('');
  }
  box.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-a]'); if (!b) return; var a = b.dataset.a, h = S.host || {}, p = S.pref || {};
    var done = function () { return refresh(); };
    if (a === 'run') { h.active = !h.active; draw(); return cmd(h.active ? 'start' : 'stop').then(function () { setTimeout(refresh, 1500); }); }
    if (a === 'mute') { h.mute = !h.mute; draw(); return cmd('mute', h.mute ? '1' : '0').then(done); }
    if (a === 'micmute') { h.micmute = !h.micmute; draw(); return cmd('micmute', h.micmute ? '1' : '0').then(done); }
    if (a === 'lang') return savePref({ lang: b.dataset.v });
    if (a === 'vs') return step(b.dataset.k, b.dataset.l, Number(b.dataset.d));
    if (a === 'try') return cmd(b.dataset.w);
    if (a === 'rate') { var r = Math.round(((Number(p.rate) || 1.05) + 0.05 * Number(b.dataset.d)) * 100) / 100; return savePref({ rate: Math.max(0.8, Math.min(1.4, r)) }); }
    if (a === 'human') return savePref({ human: b.dataset.v });
    if (a === 'mic') return savePref({ mic: !(p.mic !== false) });
    if (a === 'life') { var L = lifeOf(); L[b.dataset.k] = !L[b.dataset.k]; return savePref({ life: L }); }
  });
  function refresh() {
    return Promise.all([get('/api/copilot'), get('/api/cp/host'), get('/api/tts/voices')]).then(function (r) { S.pref = r[0] || {}; S.host = r[1] || {}; S.voices = r[2] || S.voices; S.err = ''; var sig = JSON.stringify([S.pref, S.host, S.voices.available, S.voices.voices.length]); if (sig !== S.sig) { S.sig = sig; draw(); } }).catch(function (e) { S.err = 'Keine Verbindung zur PC-Brücke (' + BRIDGE + '). Läuft die Windows-App?'; draw(); if (log) log('CopilotUi: ' + e); });
  }
  draw(); refresh(); var t = setInterval(function () { if (!root.isConnected) { clearInterval(t); return; } refresh(); }, 4000);
  return { refresh: refresh };
}
if (typeof module !== 'undefined') module.exports = { mountCopilotUi: mountCopilotUi };
