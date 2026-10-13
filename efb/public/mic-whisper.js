// Mikrofon-Eingabe für die eingebaute Spracherkennung (Whisper): hört dauernd zu, erkennt Sprechpausen
// und schickt jede Äußerung als kurze WAV-Datei an /api/stt. Alles bleibt auf dem PC.
(function () {
  const RATE = 16000;
  let ctx = null, stream = null, node = null, src = null, on = false, paused = true, cb = null, opts = null;
  let pre = [], buf = [], voiced = 0, silent = 0, speaking = false, floor = 0.004, busy = Promise.resolve(), resumeAt = 0, tok = 0;
  const hop = 2048;

  function wav(samples) {
    const b = new ArrayBuffer(44 + samples.length * 2), v = new DataView(b);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
    return b;
  }
  function down(f, from) {
    if (from === RATE) return f;
    const r = from / RATE, n = Math.floor(f.length / r), o = new Float32Array(n);
    for (let i = 0; i < n; i++) { const a = Math.floor(i * r), e = Math.min(f.length, Math.floor((i + 1) * r)); let s = 0; for (let k = a; k < e; k++) s += f[k]; o[i] = s / Math.max(1, e - a); }
    return o;
  }
  function reset() { pre = []; buf = []; voiced = 0; silent = 0; speaking = false; }
  function flush() {
    const parts = buf; const v = voiced; reset();
    if (v < 0.35) return; // zu kurz (Klick, Husten)
    let n = 0; parts.forEach((p) => { n += p.length; });
    const all = new Float32Array(n + RATE * 0.3); let o = 0; parts.forEach((p) => { all.set(p, o); o += p.length; });
    let pk = 0; for (let i = 0; i < n; i++) { const a = Math.abs(all[i]); if (a > pk) pk = a; }
    if (pk > 0.005) { const g = Math.min(10, 0.8 / pk); if (g > 1.1) for (let i = 0; i < n; i++) all[i] *= g; } // leises Mikrofon anheben
    const o2 = opts ? opts() : {};
    const url = '/api/stt?lang=' + encodeURIComponent(o2.lang || 'auto') + '&prompt=' + encodeURIComponent(o2.prompt || '');
    const my = ++tok, body = wav(all), t0 = performance.now();
    busy = busy.then(() => { if (my !== tok && tok - my >= 2) return; return fetch(url, { method: 'POST', body }).then((r) => r.json()).then((j) => { window.WhisperMic.last = { ms: Math.round(performance.now() - t0), srv: j && j.ms, via: j && j.via }; if (j && j.text && on && !paused) cb(j.text); else if (j && j.text === '' && window.Copilot && window.Copilot.sttEmpty) window.Copilot.sttEmpty(); else if (j && j.error && window.Copilot && window.Copilot.sttError) window.Copilot.sttError(j.error); }).catch(() => {}); });
  }
  function onAudio(ev) {
    if (!on) return;
    const now = performance.now();
    window.WhisperMic._d = { paused, speaking, resumeIn: Math.round(resumeAt - now), floor };
    if (paused || now < resumeAt) { if (speaking || buf.length) reset(); return; }
    const f = down(ev.inputBuffer.getChannelData(0), ctx.sampleRate).slice();
    let s = 0; for (let i = 0; i < f.length; i++) s += f[i] * f[i];
    const rms = Math.sqrt(s / f.length), dur = f.length / RATE, thr = Math.max(0.007, Math.min(0.03, floor * 2.8));
    if (!speaking) {
      if (rms > thr) { speaking = true; buf = pre.concat([f]); voiced = dur; silent = 0; pre = []; if (window.Copilot && window.Copilot.sttLevel) window.Copilot.sttLevel(true); }
      else { floor = Math.min(0.02, floor * 0.95 + rms * 0.05); pre.push(f); if (pre.length > 3) pre.shift(); }
      return;
    }
    buf.push(f);
    if (rms > thr) { voiced += dur; silent = 0; } else silent += dur;
    let len = 0; buf.forEach((p) => { len += p.length; });
    if (silent >= 0.45 || len / RATE > 14) { if (window.Copilot && window.Copilot.sttLevel) window.Copilot.sttLevel(false); flush(); }
  }
  window.WhisperMic = {
    async start(onText, getOpts) {
      cb = onText; opts = getOpts; if (on) { resumeAt = performance.now() + 350; paused = false; return true; }
      const AD = window.AudioDev;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: AD ? AD.micConstraints() : { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }); }
      catch (er) { if (!AD || !AD.cfg().mic) throw er; stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }); } // gewähltes Gerät fehlt → Standard
      try { ctx = new AudioContext({ sampleRate: RATE }); } catch { ctx = new AudioContext(); }
      src = ctx.createMediaStreamSource(stream);
      node = ctx.createScriptProcessor(hop, 1, 1);
      node.onaudioprocess = onAudio;
      const mute = ctx.createGain(); mute.gain.value = 0;
      src.connect(node); node.connect(mute); mute.connect(ctx.destination);
      on = true; paused = false; reset();
      return true;
    },
    async restart() { const c = cb, o = opts, was = paused; this.stop(); await this.start(c, o); if (was) this.pause(); },
    pause() { paused = true; reset(); },
    resume() { resumeAt = performance.now() + 350; paused = false; },
    stop() { on = false; paused = true; reset(); try { node && node.disconnect(); src && src.disconnect(); } catch { /* weg */ } try { stream && stream.getTracks().forEach((t) => t.stop()); } catch { /* weg */ } try { ctx && ctx.close(); } catch { /* weg */ } ctx = stream = node = src = null; },
    get active() { return on && !paused; },
  };
})();
