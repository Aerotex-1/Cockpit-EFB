// Auswahl von Mikrofon und Audioausgabe (Lautsprecher/Kopfhörer) für den Copilot im PC-Fenster.
// Gilt für die eingebauten Stimmen, Funk-/Hintergrundgeräusche und eigene Sounds. Systemstimmen des Browsers folgen dem Windows-Standard.
(function () {
  const KEY = 'efb.audio';
  let cfg = { mic: '', out: '' };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* egal */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* egal */ } };
  const subs = [];
  const canSink = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  // Audio-Element auf das gewählte Ausgabegerät legen (vor play() aufrufen)
  function sink(el) { if (canSink && cfg.out && el && el.setSinkId) { try { return el.setSinkId(cfg.out).catch(() => {}); } catch { /* egal */ } } return Promise.resolve(); }
  function sinkCtx(ctx) { if (ctx && cfg.out && ctx.setSinkId) { try { return Promise.resolve(ctx.setSinkId(cfg.out)).catch(() => {}); } catch { /* egal */ } } return Promise.resolve(); }
  const micConstraints = () => Object.assign({ echoCancellation: true, noiseSuppression: true, channelCount: 1 }, cfg.mic ? { deviceId: { exact: cfg.mic } } : {});
  async function list() {
    let d = []; try { d = await navigator.mediaDevices.enumerateDevices(); } catch { /* egal */ }
    return { mics: d.filter((x) => x.kind === 'audioinput'), outs: d.filter((x) => x.kind === 'audiooutput') };
  }
  async function beep() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = new AC(); await sinkCtx(c);
    const t = c.currentTime;
    [660, 880].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.3); g.gain.linearRampToValueAtTime(0.25, t + i * 0.3 + 0.03); g.gain.linearRampToValueAtTime(0.0001, t + i * 0.3 + 0.26); o.connect(g); g.connect(c.destination); o.start(t + i * 0.3); o.stop(t + i * 0.3 + 0.3); });
    setTimeout(() => c.close().catch(() => {}), 900);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const nice = (d, i, w) => (d.label || (w + ' ' + (i + 1))).replace(/^(Standard|Default) - /, '');
  async function render(box) {
    const { mics, outs } = await list();
    const opt = (arr, cur, w) => `<option value="">Windows-Standard</option>` + arr.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications').map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(nice(d, i, w))}</option>`).join('');
    const missM = cfg.mic && !mics.some((d) => d.deviceId === cfg.mic), missO = cfg.out && !outs.some((d) => d.deviceId === cfg.out);
    box.innerHTML = `<summary>Audio-Geräte</summary><div class="amb-body">
      <label class="cp-rate">Mikrofon <select id="adMic">${opt(mics, cfg.mic, 'Mikrofon')}</select></label>
      <div class="ad-meter"><div id="adBar"></div></div>
      <div class="amb-row"><span id="adMicMsg">${missM ? 'Das gewählte Mikrofon ist nicht angeschlossen, es wird das Standardgerät genutzt.' : ''}</span><button class="btn-s" id="adMicTest">Mikrofon testen (4 s)</button></div>
      <label class="cp-rate">Ausgabe <select id="adOut" ${canSink ? '' : 'disabled'}>${opt(outs, cfg.out, 'Ausgabe')}</select></label>
      <div class="amb-row"><span id="adOutMsg">${!canSink ? 'Dieses Fenster kann die Ausgabe nicht umschalten.' : missO ? 'Das gewählte Ausgabegerät ist nicht verfügbar, es wird das Standardgerät genutzt.' : ''}</span><button class="btn-s" id="adOutTest">Ausgabe testen</button></div>
      <small>Die Auswahl gilt für Copilot-Stimmen, Funk, Geräusche und eigene Sounds. Systemstimmen des Browsers (Ersatz, wenn keine eingebaute Stimme da ist) folgen dem Windows-Standard.</small></div>`;
    const q = (s) => box.querySelector(s);
    q('#adMic').onchange = (e) => { cfg.mic = e.target.value; save(); subs.forEach((f) => f('mic')); };
    q('#adOut').onchange = (e) => { cfg.out = e.target.value; save(); subs.forEach((f) => f('out')); beep(); };
    q('#adOutTest').onclick = beep;
    q('#adMicTest').onclick = async () => {
      const b = q('#adMicTest'), bar = q('#adBar'), msg = q('#adMicMsg'); b.disabled = true; msg.textContent = 'Sprich etwas …';
      let st, ctx;
      try {
        st = await navigator.mediaDevices.getUserMedia({ audio: micConstraints() });
        ctx = new (window.AudioContext || window.webkitAudioContext)(); const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(st).connect(an);
        const buf = new Float32Array(an.fftSize); let peak = 0; const t0 = performance.now();
        await new Promise((res) => { const tick = () => { an.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; const r = Math.sqrt(s / buf.length); peak = Math.max(peak, r); bar.style.width = Math.min(100, r * 400) + '%'; if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else res(); }; tick(); });
        msg.textContent = peak < 0.005 ? 'Kein Signal. Anderes Mikrofon wählen oder Lautstärke in Windows prüfen.' : peak < 0.03 ? 'Sehr leise – Mikrofonpegel in Windows erhöhen.' : 'Mikrofon funktioniert.';
      } catch (er) { msg.textContent = 'Fehler: ' + (er.name === 'NotAllowedError' ? 'Zugriff verweigert.' : er.message); }
      try { st && st.getTracks().forEach((t) => t.stop()); ctx && ctx.close(); } catch { /* egal */ }
      bar.style.width = '0'; b.disabled = false;
    };
  }
  async function mount(parent) {
    const box = document.createElement('details'); box.className = 'amb-box';
    parent.appendChild(box);
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); } catch { /* ohne Freigabe fehlen nur die Gerätenamen */ }
    render(box);
    try { navigator.mediaDevices.addEventListener('devicechange', () => { if (!box.open || !document.activeElement || !box.contains(document.activeElement)) render(box); }); } catch { /* egal */ }
    return box;
  }
  const css = document.createElement('style');
  css.textContent = '.ad-meter{height:6px;background:rgba(128,128,128,.25);border-radius:3px;overflow:hidden}.ad-meter div{height:100%;width:0;background:#3fb27f}.amb-box select{max-width:60%}';
  document.head.appendChild(css);
  window.AudioDev = { sink, sinkCtx, micConstraints, list, mount, beep, cfg: () => cfg, onChange: (f) => subs.push(f) };
})();
