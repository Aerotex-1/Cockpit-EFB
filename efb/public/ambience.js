// Funk-Effekt für das Bodenpersonal und Hintergrundgeräusche (Jetway-Piepen, Rückfahrwarner …).
// Die eingebauten Geräusche werden im Browser erzeugt, brauchen also keine Dateien. Eigene MP3/WAV/OGG lassen sich hochladen.
(function () {
  const KEY = 'efb.amb';
  const def = { radio: true, radioVol: 0.35, amb: true, ambVol: 0.4, chance: 0.5, off: [] };
  let cfg = Object.assign({}, def);
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* egal */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* egal */ } };
  let ctx = null, noiseBuf = null, custom = [];
  const AC = window.AudioContext || window.webkitAudioContext;
  function ac() {
    if (!AC) return null;
    if (!ctx) { try { ctx = new AC(); if (window.AudioDev) window.AudioDev.sinkCtx(ctx); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    return ctx;
  }
  function noise(c, t, dur, { f1 = 300, f2 = 3200, g = 1 } = {}) {
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = f1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f2;
    const gn = c.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + 0.02); gn.gain.setValueAtTime(g, t + Math.max(0.03, dur - 0.04)); gn.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(hp); hp.connect(lp); lp.connect(gn); gn.connect(c.destination);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return { stop: () => { try { gn.gain.cancelScheduledValues(c.currentTime); gn.gain.setValueAtTime(gn.gain.value, c.currentTime); gn.gain.linearRampToValueAtTime(0, c.currentTime + 0.05); s.stop(c.currentTime + 0.08); } catch { /* egal */ } } };
  }
  function tone(c, t, f, dur, g, type) {
    const o = c.createOscillator(); o.type = type || 'sine'; o.frequency.value = f;
    const gn = c.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + 0.01); gn.gain.setValueAtTime(g, t + dur - 0.02); gn.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(gn); gn.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }

  // ---------- Funk ----------
  // Beim Senden: kurzes Knacken, leises Rauschen während des Sprechens, am Ende ein „Squelch“-Knacken
  let bed = null;
  function radioOn() {
    if (!cfg.radio) return; const c = ac(); if (!c) return; const v = cfg.radioVol;
    const t = c.currentTime;
    noise(c, t, 0.09, { f1: 600, f2: 4500, g: v * 0.9 });
    bed = noise(c, t + 0.09, 40, { f1: 700, f2: 3000, g: v * 0.12 });
  }
  function radioOff() {
    if (bed) { bed.stop(); bed = null; }
    if (!cfg.radio) return; const c = ac(); if (!c) return; const v = cfg.radioVol;
    noise(c, c.currentTime + 0.06, 0.07, { f1: 500, f2: 5000, g: v * 0.7 });
    noise(c, c.currentTime + 0.16, 0.18, { f1: 800, f2: 2800, g: v * 0.18 });
  }

  // ---------- Hintergrundgeräusche ----------
  const BUILT = [
    { id: 'jetway', name: 'Jetway-Piepen', play(c, t, g) { for (let i = 0; i < 5; i++) tone(c, t + i * 0.55, 1180, 0.22, g * 0.5, 'square'); } },
    { id: 'reverse', name: 'Rückfahrwarner (Fahrzeug)', play(c, t, g) { for (let i = 0; i < 4; i++) tone(c, t + i * 0.9, 1000, 0.45, g * 0.45, 'square'); } },
    { id: 'gpu', name: 'Bodenstrom-Aggregat (Brummen)', play(c, t, g) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 96; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; const gn = c.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g * 0.5, t + 0.8); gn.gain.linearRampToValueAtTime(0, t + 4); o.connect(lp); lp.connect(gn); gn.connect(c.destination); o.start(t); o.stop(t + 4.1); } },
    { id: 'truck', name: 'Fahrzeug-Motor (entfernt)', play(c, t, g) { noise(c, t, 4, { f1: 40, f2: 260, g: g * 1.4 }); } },
    { id: 'clank', name: 'Metallisches Klacken (Gepäck/Klappen)', play(c, t, g) { tone(c, t, 210, 0.08, g * 0.6, 'triangle'); noise(c, t, 0.06, { f1: 900, f2: 3800, g: g * 0.5 }); tone(c, t + 0.9, 170, 0.09, g * 0.4, 'triangle'); } },
  ];
  async function loadCustom() {
    try { const l = await fetch('/api/sounds').then((r) => r.json()); custom = (l || []).filter((x) => /^amb\./i.test(x.key)).map((x) => ({ id: 'f:' + x.file, name: x.key.slice(4), file: x.file })); } catch { custom = []; }
    return custom;
  }
  const enabled = () => BUILT.concat(custom).filter((s) => !cfg.off.includes(s.id));
  let lastId = '';
  // spielt ein zufälliges aktives Geräusch (nur mit der eingestellten Wahrscheinlichkeit)
  function maybe(force) {
    if (!cfg.amb && !force) return;
    if (!force && Math.random() > cfg.chance) return;
    const l = enabled().filter((s) => s.id !== lastId || enabled().length < 2); if (!l.length) return;
    play(l[Math.floor(Math.random() * l.length)]);
  }
  function play(s) {
    lastId = s.id;
    const delay = 400 + Math.random() * 1500; // etwas versetzt zum Funkspruch
    setTimeout(() => {
      if (s.file) { try { const a = new Audio('/sounds/' + encodeURIComponent(s.file)); a.volume = Math.min(1, cfg.ambVol); (window.AudioDev ? window.AudioDev.sink(a) : Promise.resolve()).then(() => a.play()).catch(() => {}); } catch { /* egal */ } return; }
      const c = ac(); if (c) s.play(c, c.currentTime + 0.02, cfg.ambVol);
    }, delay);
  }

  // ---------- Einstellungen im Copilot-Bereich ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  async function render(box) {
    await loadCustom();
    const rows = BUILT.concat(custom).map((s) => `<div class="amb-row"><label><input type="checkbox" data-amb="${esc(s.id)}" ${cfg.off.includes(s.id) ? '' : 'checked'}> ${esc(s.name)}${s.file ? ' <small>(eigene Datei)</small>' : ''}</label><button class="btn-s" data-test="${esc(s.id)}">Test</button>${s.file ? `<button class="btn-s" data-del="${esc(s.file)}">Löschen</button>` : ''}</div>`).join('');
    box.innerHTML = `<summary>Funk &amp; Geräusche</summary><div class="amb-body">
      <label class="cp-chk"><input type="checkbox" id="ambRadio" ${cfg.radio ? 'checked' : ''}> Funkgerät-Effekt beim Bodenpersonal</label>
      <label class="cp-rate">Lautstärke <input type="range" id="ambRadioVol" min="0.05" max="1" step="0.05" value="${cfg.radioVol}"></label>
      <label class="cp-chk"><input type="checkbox" id="ambOn" ${cfg.amb ? 'checked' : ''}> Hintergrundgeräusche beim Sprechen des Bodenpersonals</label>
      <label class="cp-rate">Lautstärke <input type="range" id="ambVol" min="0.05" max="1" step="0.05" value="${cfg.ambVol}"></label>
      <label class="cp-rate">Häufigkeit <input type="range" id="ambChance" min="0.1" max="1" step="0.05" value="${cfg.chance}"></label>
      <div class="amb-list">${rows}</div>
      <div class="amb-up"><label class="btn-s">Eigene Datei hinzufügen (MP3/WAV/OGG)<input type="file" id="ambFile" accept=".mp3,.wav,.ogg,audio/*" hidden></label> <span id="ambMsg"></span></div></div>`;
    const q = (s) => box.querySelector(s);
    q('#ambRadio').onchange = (e) => { cfg.radio = e.target.checked; save(); };
    q('#ambRadioVol').oninput = (e) => { cfg.radioVol = +e.target.value; save(); };
    q('#ambRadioVol').onchange = () => { radioOn(); setTimeout(radioOff, 900); };
    q('#ambOn').onchange = (e) => { cfg.amb = e.target.checked; save(); };
    q('#ambVol').oninput = (e) => { cfg.ambVol = +e.target.value; save(); };
    q('#ambChance').oninput = (e) => { cfg.chance = +e.target.value; save(); };
    box.querySelectorAll('[data-amb]').forEach((cb) => { cb.onchange = () => { const id = cb.dataset.amb; cfg.off = cfg.off.filter((x) => x !== id); if (!cb.checked) cfg.off.push(id); save(); }; });
    box.querySelectorAll('[data-test]').forEach((b) => { b.onclick = () => { const s = BUILT.concat(custom).find((x) => x.id === b.dataset.test); if (s) play(s); }; });
    box.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => { await fetch('/api/sounds/delete?file=' + encodeURIComponent(b.dataset.del), { method: 'POST' }).catch(() => {}); render(box); }; });
    q('#ambFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      q('#ambMsg').textContent = 'Lade hoch …';
      try {
        const r = await fetch('/api/sounds/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f }).then((x) => x.json());
        if (r.error) throw new Error(r.error);
        render(box);
      } catch (er) { q('#ambMsg').textContent = 'Fehler: ' + er.message; }
    };
  }
  function mount(parent) {
    const box = document.createElement('details'); box.className = 'amb-box';
    parent.appendChild(box); render(box);
    return box;
  }
  const css = document.createElement('style');
  css.textContent = '.amb-box{margin:6px 0;font-size:13px}.amb-box summary{cursor:pointer;opacity:.8}.amb-body{display:flex;flex-direction:column;gap:6px;padding:8px 0}.amb-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.amb-row label{flex:1}.cp-remote .amb-box{display:none}';
  document.head.appendChild(css);
  if (window.AudioDev) window.AudioDev.onChange((w) => { if (w === 'out' && ctx) window.AudioDev.sinkCtx(ctx); });
  window.Ambience = { radioOn, radioOff, maybe, mount, cfg: () => cfg, reload: loadCustom };
})();
